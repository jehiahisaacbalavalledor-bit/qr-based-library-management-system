<?php
/**
 * Change Password Endpoint (Authenticated Student or Admin/Staff)
 * POST /api/auth/changePassword.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$session = AuthGuard::requireAuth(['admin', 'student']);

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    $data = $_POST;
}

$currentPassword = (string) ($data['currentPassword'] ?? '');
$newPassword = (string) ($data['newPassword'] ?? '');
$confirmPassword = (string) ($data['confirmPassword'] ?? '');

if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Please fill in current, new, and confirm password fields.']);
    exit;
}

if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'New password must be at least 8 characters long.']);
    exit;
}

if ($newPassword !== $confirmPassword) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'New password and confirmation do not match.']);
    exit;
}

if ($newPassword === $currentPassword) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'New password must be different from your current password.']);
    exit;
}

$userType = $session['user_type'] ?? '';
$userId = (int) ($session['user_id'] ?? 0);
$legacyPlaceholderHash = '$2y$10$wN1G78p6d/vHwZtYlE4.reVf.9c3uK7nI4.V9E/RkPq3L9q3G.K6a';

try {
    if ($userType === 'admin') {
        $stmt = $pdo->prepare("SELECT id, employee_id AS identifier, full_name, password_hash FROM admins WHERE id = ? LIMIT 1");
        $table = 'admins';
        $demoDefault = 'AdminPassword123!';
    } elseif ($userType === 'student') {
        $stmt = $pdo->prepare("SELECT id, student_number AS identifier, full_name, password_hash FROM students WHERE id = ? LIMIT 1");
        $table = 'students';
        $demoDefault = 'Password123!';
    } else {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Unsupported account type.']);
        exit;
    }

    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Account record not found.']);
        exit;
    }

    $isValidCurrent = password_verify($currentPassword, $user['password_hash']);
    if (!$isValidCurrent && $user['password_hash'] === $legacyPlaceholderHash && $currentPassword === $demoDefault) {
        $isValidCurrent = true;
    }

    if (!$isValidCurrent) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Current password is incorrect.']);
        exit;
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $upd = $pdo->prepare("UPDATE {$table} SET password_hash = ? WHERE id = ?");
    $upd->execute([$newHash, $userId]);

    try {
        $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES (?, ?, ?, ?)")
            ->execute(['PASSWORD_CHANGE', $user['identifier'], $user['full_name'], strtoupper($userType) . ' updated account password']);
    } catch (Exception $auditErr) {
        // Non-fatal if audit log fails
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Password updated successfully.'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Could not update password: ' . $e->getMessage()]);
}
