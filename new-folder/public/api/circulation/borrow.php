<?php
/**
 * Smart Circulation Desk - Borrow / Checkout Endpoint
 * POST /api/circulation/borrow.php
 * Enforces:
 * - Maximum 2 active borrowed books per student
 * - Special Collections (Room Use Only) restriction
 * - Copy availability verification
 * - Loan duration deadline calculation (1_day, 2_days, 3_days, overnight)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/FineEngine.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

AuthGuard::requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

$studentNumber = trim($input['studentNumber'] ?? $input['student_number'] ?? '');
$bookCode      = trim($input['bookCode'] ?? $input['book_code'] ?? '');
$bookTitle     = trim($input['bookTitle'] ?? $input['book'] ?? '');
$loanType      = trim($input['loanType'] ?? $input['loan_type'] ?? '3_days');
$customRef     = trim($input['transactionCode'] ?? $input['ref'] ?? '');
$librarianId   = isset($input['librarian_id']) ? (int) $input['librarian_id'] : 1;

if (empty($studentNumber)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Student Number is required.']);
    exit;
}

$validLoanTypes = ['1_day', '2_days', '3_days', 'overnight'];
if (!in_array($loanType, $validLoanTypes, true)) {
    $loanType = '3_days';
}

try {
    // 1. Verify Student
    $stmtStudent = $pdo->prepare("SELECT id, student_number, full_name, course, account_status FROM students WHERE student_number = ? LIMIT 1");
    $stmtStudent->execute([$studentNumber]);
    $student = $stmtStudent->fetch();

    if (!$student) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'code' => 'student_not_found', 'message' => "Student {$studentNumber} not found in registry."]);
        exit;
    }

    if ($student['account_status'] !== 'active') {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'code' => 'student_suspended', 'message' => "Student account is {$student['account_status']}."]);
        exit;
    }

    // 2. Enforce Maximum 2 Active Books Limit
    $stmtActive = $pdo->prepare("SELECT COUNT(*) FROM borrow_transactions WHERE student_id = ? AND return_status IN ('borrowed', 'overdue')");
    $stmtActive->execute([$student['id']]);
    $activeCount = (int) $stmtActive->fetchColumn();

    if ($activeCount >= FineEngine::MAX_ACTIVE_BOOKS) {
        http_response_code(400);
        echo json_encode([
            'status'       => 'error',
            'code'         => 'limit_reached',
            'active_count' => $activeCount,
            'max_limit'    => FineEngine::MAX_ACTIVE_BOOKS,
            'message'      => "Borrowing Limit Reached: {$student['full_name']} already has {$activeCount} active borrowed books (Maximum " . FineEngine::MAX_ACTIVE_BOOKS . " allowed)."
        ]);
        exit;
    }

    // 3. Enforce Unpaid Fines Check (optional warning or block if unpaid)
    $stmtUnpaid = $pdo->prepare("SELECT COALESCE(SUM(fine_amount), 0) FROM fines WHERE student_id = ? AND payment_status = 'unpaid'");
    $stmtUnpaid->execute([$student['id']]);
    $unpaidTotal = (float) $stmtUnpaid->fetchColumn();
    if ($unpaidTotal > 0) {
        http_response_code(400);
        echo json_encode([
            'status'       => 'error',
            'code'         => 'unpaid_fines',
            'unpaid_total' => $unpaidTotal,
            'message'      => "Checkout Blocked: Student has ₱" . number_format($unpaidTotal, 2) . " in unpaid overdue fines. Please settle fines first."
        ]);
        exit;
    }

    // 4. Find Book (by book_code or title)
    if (!empty($bookCode)) {
        $stmtBook = $pdo->prepare("SELECT * FROM books WHERE book_code = ? LIMIT 1");
        $stmtBook->execute([$bookCode]);
    } else {
        $stmtBook = $pdo->prepare("SELECT * FROM books WHERE title LIKE ? LIMIT 1");
        $stmtBook->execute(['%' . $bookTitle . '%']);
    }
    $book = $stmtBook->fetch();

    if (!$book) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'code' => 'book_not_found', 'message' => 'Requested book was not found in the library catalog.']);
        exit;
    }

    // 5. Enforce Special Collection (Room Use Only) Rule
    if ((int) $book['is_room_use_only'] === 1) {
        http_response_code(400);
        echo json_encode([
            'status'  => 'error',
            'code'    => 'room_use_only',
            'message' => "Room Use Only: '{$book['title']}' is a Special Collection item and cannot be checked out for home use."
        ]);
        exit;
    }

    // 6. Check Available Copies
    if ((int) $book['available_copies'] <= 0) {
        http_response_code(400);
        echo json_encode([
            'status'  => 'error',
            'code'    => 'no_copies',
            'message' => "No available copies left for '{$book['title']}'."
        ]);
        exit;
    }

    // 7. Compute Dates & Transaction Code
    $borrowDateStr = date('Y-m-d');
    $dueInfo = FineEngine::computeDueDate($borrowDateStr, $loanType);
    $transactionCode = !empty($customRef) ? $customRef : ('BRW-' . date('Y') . '-' . random_int(1000, 9999));

    $pdo->beginTransaction();

    $stmtInsert = $pdo->prepare("
        INSERT INTO borrow_transactions
            (transaction_code, student_id, book_id, borrow_date, due_date, loan_type, return_status, book_condition, librarian_id, notes)
        VALUES
            (?, ?, ?, ?, ?, ?, 'borrowed', 'good', ?, ?)
    ");
    $stmtInsert->execute([
        $transactionCode,
        $student['id'],
        $book['id'],
        $borrowDateStr,
        $dueInfo['due_date'],
        $loanType,
        $librarianId,
        "Issued via Smart Circulation Desk ({$dueInfo['label']})"
    ]);

    $stmtUpdateBook = $pdo->prepare("
        UPDATE books
        SET available_copies = available_copies - 1,
            status = IF(available_copies - 1 <= 0, 'borrowed', 'available')
        WHERE id = ?
    ");
    $stmtUpdateBook->execute([$book['id']]);

    $stmtAudit = $pdo->prepare("
        INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details)
        VALUES ('BORROW_QR', ?, ?, ?)
    ");
    $stmtAudit->execute([
        $student['student_number'],
        $book['title'],
        "Checked out ({$dueInfo['label']}) | Due: {$dueInfo['due_date']} | Ref: {$transactionCode}"
    ]);

    $pdo->commit();

    echo json_encode([
        'status'  => 'success',
        'message' => "Book loan approved for {$student['full_name']}.",
        'data'    => [
            'transaction_code' => $transactionCode,
            'student_number'   => $student['student_number'],
            'student_name'     => $student['full_name'],
            'active_books'     => $activeCount + 1,
            'max_books'        => FineEngine::MAX_ACTIVE_BOOKS,
            'book_code'        => $book['book_code'],
            'book_title'       => $book['title'],
            'borrow_date'      => $borrowDateStr,
            'due_date'         => $dueInfo['due_date'],
            'due_time'         => $dueInfo['due_time'],
            'loan_type'        => $loanType
        ]
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Circulation checkout failed: ' . $e->getMessage()]);
}
?>
