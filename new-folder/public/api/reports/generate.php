<?php
/**
 * Library Reports Generator Endpoint
 * GET /api/reports/generate.php?type=daily_borrowing|daily_return|monthly_transactions|overdue_books|book_inventory|student_borrowing
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/FineEngine.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

AuthGuard::requireAdmin();

$type  = trim($_GET['type'] ?? 'daily_borrowing');
$date  = trim($_GET['date'] ?? date('Y-m-d'));
$month = trim($_GET['month'] ?? date('Y-m'));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    $date = date('Y-m-d');
}
if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
    $month = date('Y-m');
}

try {
    $holidays = FineEngine::getHolidays($pdo);
    $columns = [];
    $rows = [];
    $title = '';
    $subtitle = '';

    switch ($type) {
        case 'daily_borrowing':
            $title = 'Daily Borrowing Report';
            $subtitle = "Date: {$date}";
            $columns = ['Transaction Code', 'Student No.', 'Student Name', 'Book Code', 'Book Title', 'Loan Type', 'Borrow Date', 'Due Date', 'Status'];
            $stmt = $pdo->prepare("
                SELECT bt.transaction_code, s.student_number, s.full_name, b.book_code, b.title,
                       bt.loan_type, bt.borrow_date, bt.due_date, bt.return_status
                FROM borrow_transactions bt
                JOIN students s ON bt.student_id = s.id
                JOIN books b ON bt.book_id = b.id
                WHERE bt.borrow_date = ?
                ORDER BY bt.id DESC
            ");
            $stmt->execute([$date]);
            foreach ($stmt->fetchAll() as $r) {
                $rows[] = [
                    $r['transaction_code'], $r['student_number'], $r['full_name'],
                    $r['book_code'], $r['title'], $r['loan_type'],
                    $r['borrow_date'], $r['due_date'], strtoupper($r['return_status'])
                ];
            }
            break;

        case 'daily_return':
            $title = 'Daily Return Report';
            $subtitle = "Return Date: {$date}";
            $columns = ['Transaction Code', 'Student No.', 'Student Name', 'Book Title', 'Borrow Date', 'Due Date', 'Actual Return', 'Condition', 'Status'];
            $stmt = $pdo->prepare("
                SELECT bt.transaction_code, s.student_number, s.full_name, b.title,
                       bt.borrow_date, bt.due_date, bt.actual_return_date, bt.book_condition, bt.return_status
                FROM borrow_transactions bt
                JOIN students s ON bt.student_id = s.id
                JOIN books b ON bt.book_id = b.id
                WHERE bt.actual_return_date = ?
                ORDER BY bt.id DESC
            ");
            $stmt->execute([$date]);
            foreach ($stmt->fetchAll() as $r) {
                $rows[] = [
                    $r['transaction_code'], $r['student_number'], $r['full_name'],
                    $r['title'], $r['borrow_date'], $r['due_date'],
                    $r['actual_return_date'], strtoupper($r['book_condition']), strtoupper($r['return_status'])
                ];
            }
            break;

        case 'monthly_transactions':
            $title = 'Monthly Transaction Report';
            $subtitle = "Month: {$month}";
            $columns = ['Transaction Code', 'Student No.', 'Student Name', 'Book Title', 'Borrow Date', 'Due Date', 'Return Date', 'Renewals', 'Status'];
            $stmt = $pdo->prepare("
                SELECT bt.transaction_code, s.student_number, s.full_name, b.title,
                       bt.borrow_date, bt.due_date, bt.actual_return_date, bt.renewal_count, bt.return_status
                FROM borrow_transactions bt
                JOIN students s ON bt.student_id = s.id
                JOIN books b ON bt.book_id = b.id
                WHERE DATE_FORMAT(bt.borrow_date, '%Y-%m') = ?
                ORDER BY bt.borrow_date DESC, bt.id DESC
            ");
            $stmt->execute([$month]);
            foreach ($stmt->fetchAll() as $r) {
                $rows[] = [
                    $r['transaction_code'], $r['student_number'], $r['full_name'],
                    $r['title'], $r['borrow_date'], $r['due_date'],
                    $r['actual_return_date'] ?: '—', (int) ($r['renewal_count'] ?? 0), strtoupper($r['return_status'])
                ];
            }
            break;

        case 'overdue_books':
            $title = 'Overdue Books & Accrued Fines Report';
            $subtitle = "As of: {$date} (₱20.00/day excluding Fri–Sun & Holidays)";
            $columns = ['Transaction Code', 'Student No.', 'Student Name', 'Book Title', 'Due Date', 'Chargeable Days', 'Skipped Days', 'Accrued Fine (PHP)'];
            $stmt = $pdo->prepare("
                SELECT bt.transaction_code, s.student_number, s.full_name, b.title, bt.due_date
                FROM borrow_transactions bt
                JOIN students s ON bt.student_id = s.id
                JOIN books b ON bt.book_id = b.id
                WHERE bt.return_status IN ('borrowed', 'overdue') AND bt.due_date < ?
                ORDER BY bt.due_date ASC
            ");
            $stmt->execute([$date]);
            foreach ($stmt->fetchAll() as $r) {
                $calc = FineEngine::calculateOverdueFine($r['due_date'], $date, $holidays);
                $rows[] = [
                    $r['transaction_code'], $r['student_number'], $r['full_name'],
                    $r['title'], $r['due_date'], $calc['overdue_days'],
                    $calc['skipped_days'], number_format((float) $calc['fine_amount'], 2)
                ];
            }
            break;

        case 'book_inventory':
            $title = 'Book Inventory Report';
            $subtitle = "Generated on: " . date('Y-m-d H:i');
            $columns = ['Book Code', 'ISBN', 'Title', 'Author', 'Publisher', 'Year', 'Category', 'Call No.', 'Available', 'Total', 'Room Use'];
            $stmt = $pdo->query("SELECT * FROM books ORDER BY id ASC");
            foreach ($stmt->fetchAll() as $r) {
                $rows[] = [
                    $r['book_code'], $r['isbn'] ?: 'N/A', $r['title'], $r['author'],
                    $r['publisher'] ?: 'N/A', $r['publication_year'] ?: '—',
                    $r['category'], $r['call_number'],
                    (int) $r['available_copies'], (int) $r['total_copies'],
                    !empty($r['is_room_use_only']) ? 'YES' : 'NO'
                ];
            }
            break;

        case 'student_borrowing':
            $title = 'Student Borrowing Summary Report';
            $subtitle = "Generated on: " . date('Y-m-d H:i');
            $columns = ['Student No.', 'Full Name', 'Course', 'Year Level', 'Active Loans', 'Total Borrowed', 'Unpaid Fines (PHP)', 'Status'];
            $stmt = $pdo->query("
                SELECT
                    s.student_number, s.full_name, s.course, s.year_level, s.account_status,
                    (SELECT COUNT(*) FROM borrow_transactions bt WHERE bt.student_id = s.id AND bt.return_status IN ('borrowed', 'overdue')) AS active_loans,
                    (SELECT COUNT(*) FROM borrow_transactions bt WHERE bt.student_id = s.id) AS total_loans,
                    (SELECT COALESCE(SUM(f.fine_amount), 0) FROM fines f WHERE f.student_id = s.id AND f.payment_status = 'unpaid') AS unpaid_fines
                FROM students s
                ORDER BY s.student_number ASC
            ");
            foreach ($stmt->fetchAll() as $r) {
                $rows[] = [
                    $r['student_number'], $r['full_name'], $r['course'], $r['year_level'],
                    (int) $r['active_loans'], (int) $r['total_loans'],
                    number_format((float) $r['unpaid_fines'], 2), strtoupper($r['account_status'])
                ];
            }
            break;

        default:
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Unknown report type.']);
            exit;
    }

    echo json_encode([
        'status'   => 'success',
        'title'    => $title,
        'subtitle' => $subtitle,
        'columns'  => $columns,
        'rows'     => $rows
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Report generation failed: ' . $e->getMessage()]);
}
?>
