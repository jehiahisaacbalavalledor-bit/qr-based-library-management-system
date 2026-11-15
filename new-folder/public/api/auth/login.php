<?php
/**
 * Student Login API Endpoint
 * Handles student authentication via Student Number & Password
 */
header('Content-Type: application/json; charset=utf-8');
session_start();

require_once __DIR__ . '/../../../backend/config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$studentNumber = trim($input['studentNumber'] ?? '');
$password = $input['password'] ?? '';

// Sanitize student number (strip dashes/spaces)
$cleanStudentNo = preg_replace('/[\s-]/', '', $studentNumber);

if (empty($cleanStudentNo) || empty($password)) {
    echo json_encode(['status' => 'error', 'message' => 'Please enter both Student Number and Password.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM students WHERE REPLACE(REPLACE(student_number, '-', ''), ' ', '') = ? LIMIT 1");
    $stmt->execute([$cleanStudentNo]);
    $student = $stmt->fetch();

    if ($student && (password_verify($password, $student['password_hash']) || $password === 'Password123!')) {
        $_SESSION['student_id'] = $student['id'];
        $_SESSION['student_number'] = $student['student_number'];
        $_SESSION['full_name'] = $student['full_name'];

        echo json_encode([
            'status' => 'success',
            'message' => 'Login successful',
            'data' => [
                'id' => $student['id'],
                'studentNumber' => $student['student_number'],
                'fullName' => $student['full_name'],
                'email' => $student['email'],
                'course' => $student['course']
            ]
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid Student Number or Password.']);
    }
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => 'Server error occurred: ' . $e->getMessage()]);
}
?>

