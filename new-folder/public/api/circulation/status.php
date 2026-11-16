<?php
/**
 * Smart Circulation Desk - Status, Active Loans, Fines & Recent Transactions Feed
 * GET /api/circulation/status.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/FineEngine.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

$authSession = AuthGuard::requireAuth(['admin', 'student']);
$isStudentScope = ($authSession['user_type'] === 'student');
$scopedStudentNumber = $authSession['student_number'] ?? '';

try {
    $today = date('Y-m-d');
    $holidays = FineEngine::getHolidays($pdo);

    // 1. Summary Stats
    $totalBooks = (int) $pdo->query("SELECT COALESCE(SUM(total_copies), 0) FROM books")->fetchColumn();
    $availableBooks = (int) $pdo->query("SELECT COALESCE(SUM(available_copies), 0) FROM books")->fetchColumn();
    $totalStudents = (int) $pdo->query("SELECT COUNT(*) FROM students")->fetchColumn();
    $activeBorrowed = (int) $pdo->query("SELECT COUNT(*) FROM borrow_transactions WHERE return_status IN ('borrowed', 'overdue')")->fetchColumn();
    $dueTodayCount = (int) $pdo->query("SELECT COUNT(*) FROM borrow_transactions WHERE return_status IN ('borrowed', 'overdue') AND due_date = CURDATE()")->fetchColumn();
    $overdueCount = (int) $pdo->query("SELECT COUNT(*) FROM borrow_transactions WHERE return_status IN ('borrowed', 'overdue') AND due_date < CURDATE()")->fetchColumn();
    $unpaidFinesTotal = (float) $pdo->query("SELECT COALESCE(SUM(fine_amount), 0) FROM fines WHERE payment_status = 'unpaid'")->fetchColumn();

    // 2. Active Loans with live FineEngine projection & Librarian in charge
    if ($isStudentScope) {
        $stmtLoans = $pdo->prepare("
            SELECT bt.*, s.student_number, s.full_name, s.course, b.book_code, b.title, b.call_number,
                   COALESCE(a1.full_name, 'Library Staff') AS librarian_name
            FROM borrow_transactions bt
            JOIN students s ON bt.student_id = s.id
            JOIN books b ON bt.book_id = b.id
            LEFT JOIN admins a1 ON bt.librarian_id = a1.id
            WHERE bt.return_status IN ('borrowed', 'overdue')
              AND s.student_number = ?
            ORDER BY bt.due_date ASC
        ");
        $stmtLoans->execute([$scopedStudentNumber]);
    } else {
        $stmtLoans = $pdo->query("
            SELECT bt.*, s.student_number, s.full_name, s.course, b.book_code, b.title, b.call_number,
                   COALESCE(a1.full_name, 'Library Staff') AS librarian_name
            FROM borrow_transactions bt
            JOIN students s ON bt.student_id = s.id
            JOIN books b ON bt.book_id = b.id
            LEFT JOIN admins a1 ON bt.librarian_id = a1.id
            WHERE bt.return_status IN ('borrowed', 'overdue')
            ORDER BY bt.due_date ASC
        ");
    }
    $activeLoans = $stmtLoans->fetchAll();

    foreach ($activeLoans as &$loan) {
        $loan['live_fine'] = FineEngine::calculateOverdueFine($loan['due_date'], $today, $holidays);
    }
    unset($loan);

    // 3. Unpaid / Recent Fines & Identical Book Replacement Details
    if ($isStudentScope) {
        $stmtFines = $pdo->prepare("
            SELECT f.*, bt.transaction_code, s.student_number, s.full_name,
                   b.title AS book_title, b.book_code, b.accession_number, b.call_number, b.isbn, b.author
            FROM fines f
            JOIN borrow_transactions bt ON f.transaction_id = bt.id
            JOIN students s ON f.student_id = s.id
            JOIN books b ON bt.book_id = b.id
            WHERE s.student_number = ?
            ORDER BY f.created_at DESC
            LIMIT 30
        ");
        $stmtFines->execute([$scopedStudentNumber]);
    } else {
        $stmtFines = $pdo->query("
            SELECT f.*, bt.transaction_code, s.student_number, s.full_name,
                   b.title AS book_title, b.book_code, b.accession_number, b.call_number, b.isbn, b.author
            FROM fines f
            JOIN borrow_transactions bt ON f.transaction_id = bt.id
            JOIN students s ON f.student_id = s.id
            JOIN books b ON bt.book_id = b.id
            ORDER BY f.created_at DESC
            LIMIT 30
        ");
    }
    $fines = $stmtFines->fetchAll();

    // 4. Recent Borrow & Return Transactions (full lifecycle history)
    if ($isStudentScope) {
        $stmtRecent = $pdo->prepare("
            SELECT bt.transaction_code, bt.borrow_date, bt.due_date, bt.actual_return_date,
                   bt.loan_type, bt.return_status, bt.book_condition,
                   s.student_number, s.full_name,
                   b.book_code, b.title, b.call_number,
                   COALESCE(a1.full_name, 'Library Staff') AS librarian_name,
                   COALESCE(a2.full_name, '') AS return_librarian_name
            FROM borrow_transactions bt
            JOIN students s ON bt.student_id = s.id
            JOIN books b ON bt.book_id = b.id
            LEFT JOIN admins a1 ON bt.librarian_id = a1.id
            LEFT JOIN admins a2 ON bt.return_librarian_id = a2.id
            WHERE s.student_number = ?
            ORDER BY bt.updated_at DESC, bt.id DESC
            LIMIT 15
        ");
        $stmtRecent->execute([$scopedStudentNumber]);
    } else {
        $stmtRecent = $pdo->query("
            SELECT bt.transaction_code, bt.borrow_date, bt.due_date, bt.actual_return_date,
                   bt.loan_type, bt.return_status, bt.book_condition,
                   s.student_number, s.full_name,
                   b.book_code, b.title, b.call_number,
                   COALESCE(a1.full_name, 'Library Staff') AS librarian_name,
                   COALESCE(a2.full_name, '') AS return_librarian_name
            FROM borrow_transactions bt
            JOIN students s ON bt.student_id = s.id
            JOIN books b ON bt.book_id = b.id
            LEFT JOIN admins a1 ON bt.librarian_id = a1.id
            LEFT JOIN admins a2 ON bt.return_librarian_id = a2.id
            ORDER BY bt.updated_at DESC, bt.id DESC
            LIMIT 20
        ");
    }
    $recentTransactions = $stmtRecent->fetchAll();

    echo json_encode([
        'status' => 'success',
        'data'   => [
            'stats' => [
                'total_books'        => $totalBooks,
                'available_books'    => $availableBooks,
                'total_students'     => $totalStudents,
                'active_borrowed'    => $activeBorrowed,
                'due_today'          => $dueTodayCount,
                'overdue_count'      => $overdueCount,
                'unpaid_fines_total' => $unpaidFinesTotal
            ],
            'active_loans'        => $activeLoans,
            'fines'               => $fines,
            'recent_transactions' => $recentTransactions,
            'holidays'            => $holidays
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to load circulation status: ' . $e->getMessage()]);
}
