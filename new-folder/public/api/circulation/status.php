<?php
/**
 * Smart Circulation Desk - Status, Active Loans & Live Fine Engine Feed
 * GET /api/circulation/status.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/FineEngine.php';

try {
    $today = date('Y-m-d');
    $holidays = FineEngine::getHolidays($pdo);

    // 1. Summary Stats
    $totalBooks = (int) $pdo->query("SELECT COALESCE(SUM(total_copies), 0) FROM books")->fetchColumn();
    $availableBooks = (int) $pdo->query("SELECT COALESCE(SUM(available_copies), 0) FROM books")->fetchColumn();
    $activeBorrowed = (int) $pdo->query("SELECT COUNT(*) FROM borrow_transactions WHERE return_status IN ('borrowed', 'overdue')")->fetchColumn();
    $dueTodayCount = (int) $pdo->query("SELECT COUNT(*) FROM borrow_transactions WHERE return_status IN ('borrowed', 'overdue') AND due_date = CURDATE()")->fetchColumn();
    $overdueCount = (int) $pdo->query("SELECT COUNT(*) FROM borrow_transactions WHERE return_status IN ('borrowed', 'overdue') AND due_date < CURDATE()")->fetchColumn();
    $unpaidFinesTotal = (float) $pdo->query("SELECT COALESCE(SUM(fine_amount), 0) FROM fines WHERE payment_status = 'unpaid'")->fetchColumn();

    // 2. Active Loans with live FineEngine projection
    $stmtLoans = $pdo->query("
        SELECT bt.*, s.student_number, s.full_name, s.course, b.book_code, b.title, b.call_number
        FROM borrow_transactions bt
        JOIN students s ON bt.student_id = s.id
        JOIN books b ON bt.book_id = b.id
        WHERE bt.return_status IN ('borrowed', 'overdue')
        ORDER BY bt.due_date ASC
    ");
    $activeLoans = $stmtLoans->fetchAll();

    foreach ($activeLoans as &$loan) {
        $loan['live_fine'] = FineEngine::calculateOverdueFine($loan['due_date'], $today, $holidays);
    }

    // 3. Unpaid / Recent Fines
    $stmtFines = $pdo->query("
        SELECT f.*, bt.transaction_code, s.student_number, s.full_name, b.title AS book_title
        FROM fines f
        JOIN borrow_transactions bt ON f.transaction_id = bt.id
        JOIN students s ON f.student_id = s.id
        JOIN books b ON bt.book_id = b.id
        ORDER BY f.created_at DESC
        LIMIT 30
    ");
    $fines = $stmtFines->fetchAll();

    echo json_encode([
        'status' => 'success',
        'data'   => [
            'stats' => [
                'total_books'        => $totalBooks,
                'available_books'    => $availableBooks,
                'active_borrowed'    => $activeBorrowed,
                'due_today'          => $dueTodayCount,
                'overdue_count'      => $overdueCount,
                'unpaid_fines_total' => $unpaidFinesTotal
            ],
            'active_loans' => $activeLoans,
            'fines'        => $fines,
            'holidays'     => $holidays
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to load circulation status: ' . $e->getMessage()]);
}
?>
