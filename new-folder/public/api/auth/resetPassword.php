<?php
/**
 * Password Reset Endpoint
 * POST /api/auth/resetPassword.php
 * - Student reset: requires matching Student Number + Registered Email + Date of Birth.
 * - Admin/Staff reset: requires an active Head Librarian / System Administrator session.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

$userType    = trim($input['userType'] ?? 'student');
$email       = strtolower(trim($input['email'] ?? ''));
$newPassword = (string) ($input['newPassword'] ?? '');

if ($email === '' || strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Valid email and new password (minimum 8 characters) are required.']);
    exit;
}

try {
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);

    if ($userType === 'admin') {
        $session = AuthGuard::currentSession();
        $callerRole = $session['role'] ?? '';
        $isHead = !empty($session['authenticated'])
            && ($session['user_type'] ?? '') === 'admin'
            && in_array($callerRole, ['Head Librarian', 'System Administrator'], true);

        if (!$isHead) {
            http_response_code(403);
            echo json_encode([
                'status' => 'error',
                'message' => 'Staff password resets require an active Head Librarian session. Ask your Head Librarian to reset your password in Staff Management.'
            ]);
            exit;
        }

        $employeeId = strtoupper(trim($input['employeeId'] ?? ''));
        if ($employeeId === '') {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Employee ID is required.']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, employee_id, full_name FROM admins WHERE UPPER(employee_id) = ? AND LOWER(email) = ? LIMIT 1");
        $stmt->execute([$employeeId, $email]);
        $user = $stmt->fetch();
        if (!$user) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'No matching librarian/admin account found.']);
            exit;
        }

        $upd = $pdo->prepare("UPDATE admins SET password_hash = ? WHERE id = ?");
        $upd->execute([$hash, $user['id']]);

        try {
            $actorEmpId = $session['employee_id'] ?? 'ADMIN';
            $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES (?, ?, ?, ?)")
                ->execute(['ADMIN_PASSWORD_RESET', $actorEmpId, $user['full_name'], "Password reset for {$user['employee_id']}"]);
        } catch (Exception $auditErr) {
            // Non-blocking
        }

        echo json_encode(['status' => 'success', 'message' => "Password updated for {$user['full_name']}. They may now sign in."]);
        exit;
    }

    $studentNumber = trim($input['studentNumber'] ?? '');
    $dob = trim($input['dateOfBirth'] ?? $input['dob'] ?? '');
    if ($studentNumber === '' || $dob === '') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Student Number, Email, and Date of Birth are required.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, student_number, full_name, date_of_birth FROM students WHERE student_number = ? AND LOWER(email) = ? LIMIT 1");
    $stmt->execute([$studentNumber, $email]);
    $student = $stmt->fetch();
    if (!$student || trim((string) ($student['date_of_birth'] ?? '')) !== $dob) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Student credentials could not be verified (check Student Number, Email, and Date of Birth).']);
        exit;
    }

    $upd = $pdo->prepare("UPDATE students SET password_hash = ? WHERE id = ?");
    $upd->execute([$hash, $student['id']]);

    try {
        $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES (?, ?, ?, ?)")
            ->execute(['PASSWORD_RESET', $student['student_number'], $student['full_name'], 'Self-service password reset verified via Student No, Email & DOB']);
    } catch (Exception $auditErr) {
        // Non-blocking
    }

    echo json_encode(['status' => 'success', 'message' => "Password updated for {$student['full_name']}. You may now sign in."]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Password reset failed: ' . $e->getMessage()]);
}
