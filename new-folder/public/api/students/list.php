<?php
/**
 * Student Records - List Students Endpoint
 * GET /api/students/list.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';

try {
    $stmt = $pdo->query("
        SELECT
            s.id,
            s.student_number,
            s.full_name,
            s.email,
            s.mobile_number,
            s.course,
            s.year_level,
            s.campus,
            s.account_status,
            s.created_at,
            (
                SELECT COUNT(*)
                FROM borrow_transactions bt
                WHERE bt.student_id = s.id
                  AND bt.return_status IN ('borrowed', 'overdue')
            ) AS active_loans_count
        FROM students s
        ORDER BY s.id DESC
    ");
    $students = $stmt->fetchAll();

    echo json_encode([
        'status' => 'success',
        'data'   => $students
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to load students: ' . $e->getMessage()]);
}
?>
