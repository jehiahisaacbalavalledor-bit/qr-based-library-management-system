<?php
/**
 * Student Registration API Endpoint
 * Handles student account creation with input validation
 */
header('Content-Type: application/json; charset=utf-8');
session_start();

require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

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
$email = trim($input['email'] ?? '');
$mobile = trim($input['mobile'] ?? '');
$dob = trim($input['dob'] ?? '');
$password = $input['password'] ?? '';
$confirmPassword = $input['confirmPassword'] ?? '';

// Validation
if (empty($studentNumber) || empty($email) || empty($mobile) || empty($dob) || empty($password)) {
    echo json_encode(['status' => 'error', 'message' => 'All fields marked with * are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid email address format.']);
    exit;
}

if (!preg_match('/^09\d{9}$/', $mobile)) {
    echo json_encode(['status' => 'error', 'message' => 'Mobile number must be 11 digits starting with 09 (e.g. 09123456789).']);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode(['status' => 'error', 'message' => 'Password must be at least 6 characters long.']);
    exit;
}

if ($password !== $confirmPassword) {
    echo json_encode(['status' => 'error', 'message' => 'Passwords do not match.']);
    exit;
}

try {
    // Check if student number or email is already registered
    $cleanStudentNo = preg_replace('/[\s-]/', '', $studentNumber);
    $checkStmt = $pdo->prepare("SELECT id FROM students WHERE REPLACE(REPLACE(student_number, '-', ''), ' ', '') = ? OR email = ?");
    $checkStmt->execute([$cleanStudentNo, $email]);
    if ($checkStmt->fetch()) {
        echo json_encode(['status' => 'error', 'message' => 'Student Number or Email is already registered.']);
        exit;
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $fullName = "Student " . $studentNumber;

    $insertStmt = $pdo->prepare("
        INSERT INTO students (student_number, email, mobile_number, date_of_birth, password_hash, full_name)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $insertStmt->execute([$studentNumber, $email, $mobile, $dob, $passwordHash, $fullName]);

    $newId = $pdo->lastInsertId();
    AuthGuard::setStudentSession([
        'id'             => $newId,
        'student_number' => $studentNumber,
        'full_name'      => $fullName
    ]);
    $_SESSION['student_id'] = $newId;
    $_SESSION['student_number'] = $studentNumber;
    $_SESSION['full_name'] = $fullName;

    echo json_encode([
        'status' => 'success',
        'message' => 'Student account created successfully!',
        'data' => [
            'id' => $newId,
            'studentNumber' => $studentNumber,
            'email' => $email,
            'fullName' => $fullName
        ]
    ]);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
}
?>

