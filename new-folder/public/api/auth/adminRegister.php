<?php
/**
 * Admin & Librarian Registration API Endpoint
 * Handles staff account creation with server-side validation and password hashing
 * Cavite State University - Imus Campus Library Management System
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

$employeeId = trim($input['employeeId'] ?? $input['regEmployeeId'] ?? '');
$fullName = trim($input['fullName'] ?? $input['regFullName'] ?? '');
$email = trim($input['email'] ?? $input['regAdminEmail'] ?? '');
$role = trim($input['role'] ?? $input['regRole'] ?? 'Circulation Desk Officer');
$password = $input['password'] ?? $input['regAdminPassword'] ?? '';
$confirmPassword = $input['confirmPassword'] ?? $input['regAdminConfirmPassword'] ?? '';

// 1. Required fields check
if (empty($employeeId) || empty($fullName) || empty($email) || empty($password)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'All fields marked with * are required.'
    ]);
    exit;
}

// 2. Email format validation
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Please enter a valid institutional email address.'
    ]);
    exit;
}

// 3. Password length check
if (strlen($password) < 6) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Password must be at least 6 characters long.'
    ]);
    exit;
}

// 4. Confirm password matching
if ($password !== $confirmPassword) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Passwords do not match. Please re-enter.'
    ]);
    exit;
}

// 5. Allowed roles whitelist
$allowedRoles = ['Head Librarian', 'Circulation Desk Officer', 'Cataloger', 'System Administrator'];
if (!in_array($role, $allowedRoles)) {
    $role = 'Circulation Desk Officer';
}

try {
    // Check for existing employee ID or email
    $cleanEmpId = preg_replace('/[\s-]/', '', strtolower($employeeId));
    $checkStmt = $pdo->prepare("
        SELECT id, employee_id, email FROM admins 
        WHERE LOWER(REPLACE(REPLACE(employee_id, '-', ''), ' ', '')) = ? 
           OR LOWER(email) = ? 
        LIMIT 1
    ");
    $checkStmt->execute([$cleanEmpId, strtolower($email)]);
    $existing = $checkStmt->fetch();

    if ($existing) {
        if (strtolower($existing['email']) === strtolower($email)) {
            echo json_encode([
                'status' => 'error',
                'message' => 'This email address is already registered to another staff account.'
            ]);
        } else {
            echo json_encode([
                'status' => 'error',
                'message' => 'This Employee ID is already registered in the system.'
            ]);
        }
        exit;
    }

    // Hash password with bcrypt
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    // Insert new staff member
    $insertStmt = $pdo->prepare("
        INSERT INTO admins (employee_id, full_name, email, role, password_hash, status)
        VALUES (?, ?, ?, ?, ?, 'active')
    ");
    $insertStmt->execute([$employeeId, $fullName, $email, $role, $passwordHash]);

    $newAdminId = $pdo->lastInsertId();

    // Set staff session
    AuthGuard::setAdminSession([
        'id'          => $newAdminId,
        'employee_id' => $employeeId,
        'full_name'   => $fullName,
        'role'        => $role
    ]);
    $_SESSION['admin_id'] = $newAdminId;
    $_SESSION['employee_id'] = $employeeId;
    $_SESSION['admin_name'] = $fullName;
    $_SESSION['admin_role'] = $role;
    $_SESSION['admin_email'] = $email;

    // Record action in audit log
    try {
        $auditStmt = $pdo->prepare("
            INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details)
            VALUES ('ADMIN_REGISTER', ?, 'Staff Account Registered', ?)
        ");
        $auditStmt->execute([$employeeId, "Role: {$role} | Name: {$fullName}"]);
    } catch (Exception $auditEx) {
        // Non-blocking
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Staff account successfully created! Redirecting to Admin Console...',
        'data' => [
            'id' => $newAdminId,
            'employeeId' => $employeeId,
            'fullName' => $fullName,
            'email' => $email,
            'role' => $role,
            'campus' => 'Imus Campus'
        ]
    ]);
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

