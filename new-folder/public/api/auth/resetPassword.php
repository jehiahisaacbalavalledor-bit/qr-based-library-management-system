<?php
/**
 * Password Reset Endpoint (Student & Admin)
 * POST /api/auth/resetPassword.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

$userType    = trim($input['userType'] ?? 'student');
$email       = strtolower(trim($input['email'] ?? ''));
$newPassword = (string) ($input['newPassword'] ?? '');

if ($email === '' || strlen($newPassword) < 6) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Valid email and new password (min 6 characters) are required.']);
    exit;
}

try {
    $hash = password_hash($newPassword, PASSWORD_BCRYPT);

    if ($userType === 'admin') {
        $employeeId = strtoupper(trim($input['employeeId'] ?? ''));
        if ($employeeId === '') {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Employee ID is required.']);
            exit;
        }
        $stmt = $pdo->prepare("SELECT id, full_name FROM users_admin WHERE UPPER(employee_id) = ? AND LOWER(email) = ? LIMIT 1");
        $stmt->execute([$employeeId, $email]);
        $user = $stmt->fetch();
        if (!$user) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'No matching librarian/admin account found.']);
            exit;
        }
        $upd = $pdo->prepare("UPDATE users_admin SET password_hash = ? WHERE id = ?");
        $upd->execute([$hash, $user['id']]);
        echo json_encode(['status' => 'success', 'message' => "Password updated for {$user['full_name']}. You may now sign in."]);
        exit;
    }

    $studentNumber = trim($input['studentNumber'] ?? '');
    if ($studentNumber === '') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Student Number is required.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, full_name FROM students WHERE student_number = ? AND LOWER(email) = ? LIMIT 1");
    $stmt->execute([$studentNumber, $email]);
    $student = $stmt->fetch();
    if (!$student) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'No matching student account found for that Student Number and Email.']);
        exit;
    }

    $upd = $pdo->prepare("UPDATE students SET password_hash = ? WHERE id = ?");
    $upd->execute([$hash, $student['id']]);
    echo json_encode(['status' => 'success', 'message' => "Password updated for {$student['full_name']}. You may now sign in."]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Password reset failed: ' . $e->getMessage()]);
}
?>
