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
if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Password must be at least 8 characters long.'
    ]);
    exit;
}

// 4. Confirm password matching
if ($password !== $confirmPassword) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Passwords do not match. Please re-enter.'
    ]);
    exit;
}

// 5. Role & privilege gate: only an authenticated Head Librarian/System Administrator
// can directly provision active staff or grant Head Librarian / System Administrator roles.
$currentSession = AuthGuard::currentSession();
$isHeadLibrarianSession = !empty($currentSession['authenticated'])
    && ($currentSession['user_type'] ?? '') === 'admin'
    && in_array($currentSession['role'] ?? '', ['Head Librarian', 'System Administrator'], true);

$allowedRoles = ['Head Librarian', 'Circulation Desk Officer', 'Cataloger', 'System Administrator'];
if (!in_array($role, $allowedRoles, true)) {
    $role = 'Circulation Desk Officer';
}
if (!$isHeadLibrarianSession && in_array($role, ['Head Librarian', 'System Administrator'], true)) {
    $role = 'Circulation Desk Officer';
}
$initialStatus = $isHeadLibrarianSession ? 'active' : 'inactive';

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
    // Hash password with bcrypt
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    // Insert new staff member (public self-registration stays inactive until Head Librarian activates it)
    $insertStmt = $pdo->prepare("
        INSERT INTO admins (employee_id, full_name, email, role, password_hash, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $insertStmt->execute([$employeeId, $fullName, $email, $role, $passwordHash, $initialStatus]);

    $newAdminId = $pdo->lastInsertId();

    // Record action in audit log
    try {
        $auditStmt = $pdo->prepare("
            INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details)
            VALUES ('ADMIN_REGISTER', ?, 'Staff Account Registered', ?)
        ");
        $auditStmt->execute([$employeeId, "Role: {$role} | Status: {$initialStatus} | Name: {$fullName}"]);
    } catch (Exception $auditEx) {
        // Non-blocking
    }

    if (!$isHeadLibrarianSession) {
        echo json_encode([
            'status' => 'success',
            'pendingApproval' => true,
            'message' => 'Staff registration submitted! A Head Librarian must activate your account before you can sign in.',
            'data' => [
                'id' => $newAdminId,
                'employeeId' => $employeeId,
                'fullName' => $fullName,
                'email' => $email,
                'role' => $role,
                'status' => $initialStatus,
                'campus' => 'Imus Campus'
            ]
        ]);
        exit;
    }

    echo json_encode([
        'status' => 'success',
        'pendingApproval' => false,
        'message' => 'Staff account created and activated!',
        'data' => [
            'id' => $newAdminId,
            'employeeId' => $employeeId,
            'fullName' => $fullName,
            'email' => $email,
            'role' => $role,
            'status' => $initialStatus,
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

