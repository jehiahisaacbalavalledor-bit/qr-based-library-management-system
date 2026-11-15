<?php
/**
 * Student Records - Delete Student Endpoint
 * POST /api/students/delete.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

AuthGuard::requireHeadLibrarian();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$studentId     = isset($input['id']) ? (int) $input['id'] : 0;
$studentNumber = trim($input['studentNumber'] ?? $input['student_number'] ?? '');

if ($studentId <= 0 && empty($studentNumber)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Student ID or Student Number is required.']);
    exit;
}

try {
    if ($studentId > 0) {
        $stmtFind = $pdo->prepare("SELECT id, student_number, full_name FROM students WHERE id = ? LIMIT 1");
        $stmtFind->execute([$studentId]);
    } else {
        $stmtFind = $pdo->prepare("SELECT id, student_number, full_name FROM students WHERE student_number = ? LIMIT 1");
        $stmtFind->execute([$studentNumber]);
    }
    $student = $stmtFind->fetch();

    if (!$student) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Student not found.']);
        exit;
    }

    $stmtActive = $pdo->prepare("SELECT COUNT(*) FROM borrow_transactions WHERE student_id = ? AND return_status IN ('borrowed', 'overdue')");
    $stmtActive->execute([$student['id']]);
    if ((int) $stmtActive->fetchColumn() > 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => "Cannot delete '{$student['full_name']}' while they have active borrowed books."]);
        exit;
    }

    $stmtDel = $pdo->prepare("DELETE FROM students WHERE id = ?");
    $stmtDel->execute([$student['id']]);

    echo json_encode([
        'status'  => 'success',
        'message' => "Student '{$student['full_name']}' deleted."
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Could not delete student: ' . $e->getMessage()]);
}
?>
