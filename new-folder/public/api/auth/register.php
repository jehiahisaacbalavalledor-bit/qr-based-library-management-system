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
if (!is_array($input)) {
    $input = $_POST;
}

$studentNumber = trim($input['studentNumber'] ?? '');
$fullName = trim($input['fullName'] ?? '');
$course = trim($input['course'] ?? 'BS Information Technology');
$yearLevel = trim($input['yearLevel'] ?? '1st Year');
$email = trim($input['email'] ?? '');
$mobile = trim($input['mobile'] ?? '');
$dob = trim($input['dob'] ?? '');
$password = (string) ($input['password'] ?? '');
$confirmPassword = (string) ($input['confirmPassword'] ?? '');

$allowedYearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
if (!in_array($yearLevel, $allowedYearLevels, true)) {
    $yearLevel = '1st Year';
}
if ($course === '') {
    $course = 'BS Information Technology';
}
if ($fullName === '') {
    $fullName = 'Student ' . $studentNumber;
}

// Validation
if ($studentNumber === '' || $email === '' || $mobile === '' || $dob === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'All fields marked with * are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid email address format.']);
    exit;
}

if (!preg_match('/^09\d{9}$/', $mobile)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Mobile number must be 11 digits starting with 09 (e.g. 09123456789).']);
    exit;
}

if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Password must be at least 8 characters long.']);
    exit;
}

if ($password !== $confirmPassword) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Passwords do not match.']);
    exit;
}

try {
    // Check if student number or email is already registered
    $cleanStudentNo = preg_replace('/[\s-]/', '', $studentNumber);
    $checkStmt = $pdo->prepare("SELECT id FROM students WHERE REPLACE(REPLACE(student_number, '-', ''), ' ', '') = ? OR LOWER(email) = ?");
    $checkStmt->execute([$cleanStudentNo, strtolower($email)]);
    if ($checkStmt->fetch()) {
        http_response_code(409);
        echo json_encode(['status' => 'error', 'message' => 'Student Number or Email is already registered.']);
        exit;
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $insertStmt = $pdo->prepare("
        INSERT INTO students (student_number, full_name, email, mobile_number, course, year_level, campus, date_of_birth, password_hash, account_status)
        VALUES (?, ?, ?, ?, ?, ?, 'Imus Campus', ?, ?, 'active')
    ");
    $insertStmt->execute([$studentNumber, $fullName, $email, $mobile, $course, $yearLevel, $dob, $passwordHash]);

    $newId = $pdo->lastInsertId();
    AuthGuard::setStudentSession([
        'id'             => $newId,
        'student_number' => $studentNumber,
        'full_name'      => $fullName
    ]);
    $_SESSION['student_id'] = $newId;
    $_SESSION['student_number'] = $studentNumber;
    $_SESSION['full_name'] = $fullName;

    try {
        $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES (?, ?, ?, ?)")
            ->execute(['ACCOUNT_REG', $studentNumber, $fullName, "{$course} ({$yearLevel})"]);
    } catch (Exception $auditEx) {
        // Non-blocking
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Student account created successfully!',
        'data' => [
            'id' => $newId,
            'studentNumber' => $studentNumber,
            'fullName' => $fullName,
            'email' => $email,
            'mobile' => $mobile,
            'course' => $course,
            'yearLevel' => $yearLevel,
            'campus' => 'Imus Campus'
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
}
