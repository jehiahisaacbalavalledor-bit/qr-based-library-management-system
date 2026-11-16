<?php
/**
 * Smart Circulation Desk - Book Return & Fine Calculation Endpoint
 * POST /api/circulation/return.php
 * Automatically calculates ₱20/day penalty skipping Fridays, Saturdays, Sundays, and Holidays.
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

$transactionCode = trim($input['transactionCode'] ?? $input['transaction_code'] ?? '');
$returnDateStr   = trim($input['returnDate'] ?? $input['return_date'] ?? date('Y-m-d'));
$bookCondition   = trim($input['bookCondition'] ?? $input['book_condition'] ?? 'good');
$waiveFine       = !empty($input['waiveFine']);
$librarianId     = !empty($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : (isset($input['librarian_id']) ? (int) $input['librarian_id'] : 1);

if (empty($transactionCode)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Transaction Code is required.']);
    exit;
}

$validConditions = ['good', 'minor_wear', 'damaged', 'lost'];
if (!in_array($bookCondition, $validConditions, true)) {
    $bookCondition = 'good';
}

try {
    $stmt = $pdo->prepare("
        SELECT bt.*, s.student_number, s.full_name, b.book_code, b.title
        FROM borrow_transactions bt
        JOIN students s ON bt.student_id = s.id
        JOIN books b ON bt.book_id = b.id
        WHERE bt.transaction_code = ?
        LIMIT 1
    ");
    $stmt->execute([$transactionCode]);
    $tx = $stmt->fetch();

    if (!$tx) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => "Transaction {$transactionCode} not found."]);
        exit;
    }

    if ($tx['return_status'] === 'returned') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => "Transaction {$transactionCode} is already marked as returned."]);
        exit;
    }

    // Calculate Overdue Fine using FineEngine (skips Fri-Sun & Holidays)
    $holidays = FineEngine::getHolidays($pdo);
    $fineCalc = FineEngine::calculateOverdueFine($tx['due_date'], $returnDateStr, $holidays);

    $finalStatus = 'returned';
    if ($bookCondition === 'lost') {
        $finalStatus = 'lost';
    } elseif ($bookCondition === 'damaged') {
        $finalStatus = 'damaged';
    }

    $pdo->beginTransaction();

    $stmtUpdateTx = $pdo->prepare("
        UPDATE borrow_transactions
        SET actual_return_date = ?,
            return_status = ?,
            book_condition = ?,
            return_librarian_id = ?
        WHERE id = ?
    ");
    $stmtUpdateTx->execute([
        $returnDateStr,
        $finalStatus,
        $bookCondition,
        $librarianId,
        $tx['id']
    ]);

    // Restore available copy if not lost
    if ($bookCondition !== 'lost') {
        $stmtUpdateBook = $pdo->prepare("
            UPDATE books
            SET available_copies = LEAST(total_copies, available_copies + 1),
                status = 'available'
            WHERE id = ?
        ");
        $stmtUpdateBook->execute([$tx['book_id']]);
    }

    // Record Fine if overdue or damaged/lost
    $fineRecordId = null;
    if ($fineCalc['fine_amount'] > 0 || $bookCondition === 'damaged' || $bookCondition === 'lost') {
        $replacementStatus = ($bookCondition === 'damaged' || $bookCondition === 'lost') ? 'pending_replacement' : 'none';
        $fineCondition = ($bookCondition === 'damaged' || $bookCondition === 'lost') ? $bookCondition : 'good';
        $paymentStatus = $waiveFine ? 'waived' : ($fineCalc['fine_amount'] > 0 ? 'unpaid' : 'paid');

        $remarks = "Overdue: {$fineCalc['overdue_days']} chargeable days (Skipped {$fineCalc['skipped_days']} Fri-Sun/holiday days)";
        if ($replacementStatus === 'pending_replacement') {
            $remarks .= " | Book {$bookCondition}: Identical replacement required.";
        }

        $stmtFine = $pdo->prepare("
            INSERT INTO fines
                (transaction_id, student_id, overdue_days, fine_rate, fine_amount, book_condition, replacement_status, payment_status, remarks)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmtFine->execute([
            $tx['id'],
            $tx['student_id'],
            $fineCalc['overdue_days'],
            $fineCalc['fine_rate'],
            $fineCalc['fine_amount'],
            $fineCondition,
            $replacementStatus,
            $paymentStatus,
            $remarks
        ]);
        $fineRecordId = $pdo->lastInsertId();
    }

    $stmtAudit = $pdo->prepare("
        INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details)
        VALUES ('RETURN_QR', ?, ?, ?)
    ");
    $stmtAudit->execute([
        $tx['student_number'],
        $tx['title'],
        "Returned ({$finalStatus}) | Fine: ₱" . number_format($fineCalc['fine_amount'], 2) . " ({$fineCalc['overdue_days']} chargeable days)"
    ]);

    $pdo->commit();

    echo json_encode([
        'status'  => 'success',
        'message' => "Book return processed for {$tx['full_name']}.",
        'data'    => [
            'transaction_code' => $tx['transaction_code'],
            'student_number'   => $tx['student_number'],
            'student_name'     => $tx['full_name'],
            'book_title'       => $tx['title'],
            'due_date'         => $tx['due_date'],
            'return_date'      => $returnDateStr,
            'return_status'    => $finalStatus,
            'fine_id'          => $fineRecordId,
            'fine_calculation' => $fineCalc
        ]
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Return processing failed: ' . $e->getMessage()]);
}
?>
