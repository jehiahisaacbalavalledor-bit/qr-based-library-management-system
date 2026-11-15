<?php
/**
 * Admin & Librarian Login API Endpoint
 * Handles staff authentication via Employee ID or Email & Password
 * Cavite State University - Imus Campus Library Management System
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

$username = trim($input['adminUsername'] ?? $input['username'] ?? $input['employeeId'] ?? '');
$password = $input['adminPassword'] ?? $input['password'] ?? '';
$requestedRole = trim($input['adminRole'] ?? $input['role'] ?? '');

// Sanitize Employee ID (strip dashes and spaces for normalized lookup)
$cleanEmpId = preg_replace('/[\s-]/', '', strtolower($username));
$cleanEmail = strtolower($username);

if (empty($username) || empty($password)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Please enter both Employee ID / Email and Password.'
    ]);
    exit;
}

try {
    // Search by normalized employee_id or email
    $stmt = $pdo->prepare("
        SELECT * FROM admins 
        WHERE LOWER(REPLACE(REPLACE(employee_id, '-', ''), ' ', '')) = ? 
           OR LOWER(email) = ? 
        LIMIT 1
    ");
    $stmt->execute([$cleanEmpId, $cleanEmail]);
    $admin = $stmt->fetch();

    // Verify password via bcrypt hash or demo emergency password
    $passwordValid = false;
    if ($admin) {
        $passwordValid = password_verify($password, $admin['password_hash']) || ($password === 'AdminPassword123!');
    }

    if ($admin && $passwordValid) {
        // Check if account status is active
        if (isset($admin['status']) && $admin['status'] !== 'active') {
            echo json_encode([
                'status' => 'error',
                'message' => 'Your staff account is currently inactive. Please contact the Chief Librarian.'
            ]);
            exit;
        }

        // Set session variables for staff
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['employee_id'] = $admin['employee_id'];
        $_SESSION['admin_name'] = $admin['full_name'];
        $_SESSION['admin_role'] = $admin['role'];
        $_SESSION['admin_email'] = $admin['email'];

        // Optionally record in audit log if table exists
        try {
            $logStmt = $pdo->prepare("
                INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) 
                VALUES ('ADMIN_LOGIN', ?, 'Staff Session Login', ?)
            ");
            $logStmt->execute([$admin['employee_id'], 'Logged in as ' . $admin['role']]);
        } catch (Exception $logEx) {
            // Ignore audit log error if table is not yet migrated
        }

        echo json_encode([
            'status' => 'success',
            'message' => 'Admin authentication successful! Loading Admin Console...',
            'data' => [
                'id' => $admin['id'],
                'employeeId' => $admin['employee_id'],
                'fullName' => $admin['full_name'],
                'email' => $admin['email'],
                'role' => $admin['role'],
                'campus' => 'Imus Campus'
            ]
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid Employee ID/Email or Password. Access denied.'
        ]);
    }
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Database server error: ' . $e->getMessage()
    ]);
}
?>

