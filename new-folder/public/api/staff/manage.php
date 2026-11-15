<?php
/**
 * Head Librarian - Staff & Admin Account Management Endpoint
 * GET  /api/staff/manage.php -> List admin/staff accounts
 * POST /api/staff/manage.php -> Update role/status or remove staff account
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

AuthGuard::requireHeadLibrarian();

$allowedRoles = [
    'Head Librarian',
    'Circulation Desk Officer',
    'Cataloger',
    'System Administrator'
];

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->query("
            SELECT id, employee_id, full_name, email, role, status, created_at
            FROM admins
            ORDER BY FIELD(role, 'Head Librarian', 'System Administrator', 'Circulation Desk Officer', 'Cataloger'), id ASC
        ");
        echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = trim($input['action'] ?? 'update');
    $staffId = isset($input['id']) ? (int) $input['id'] : 0;

    if ($staffId <= 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Valid staff ID is required.']);
        exit;
    }

    $stmtTarget = $pdo->prepare("SELECT id, employee_id, full_name, email, role, status FROM admins WHERE id = ? LIMIT 1");
    $stmtTarget->execute([$staffId]);
    $target = $stmtTarget->fetch();

    if (!$target) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Staff account not found.']);
        exit;
    }

    $currentAdminId = (int) ($_SESSION['user_id'] ?? 0);
    $actorEmpId = $_SESSION['employee_id'] ?? 'ADMIN';

    if ($action === 'delete') {
        if ($target['id'] == $currentAdminId) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'You cannot delete your own currently signed-in account.']);
            exit;
        }
        $pdo->prepare("DELETE FROM admins WHERE id = ?")->execute([$staffId]);
        $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES (?, ?, ?, ?)")
            ->execute(['STAFF_DELETE', $actorEmpId, $target['full_name'], "Removed staff account {$target['employee_id']} ({$target['role']})"]);
        echo json_encode(['status' => 'success', 'message' => "Removed staff account {$target['full_name']}."]);
        exit;
    }

    $newRole = trim($input['role'] ?? $target['role']);
    $newStatus = trim($input['status'] ?? $target['status']);

    if (!in_array($newRole, $allowedRoles, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid staff role selected.']);
        exit;
    }
    if (!in_array($newStatus, ['active', 'inactive'], true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid account status. Use active or inactive.']);
        exit;
    }

    if ($target['id'] == $currentAdminId && ($newStatus !== 'active' || !in_array($newRole, ['Head Librarian', 'System Administrator'], true))) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Cannot deactivate or demote your own active Head Librarian session.']);
        exit;
    }

    $stmtUpd = $pdo->prepare("UPDATE admins SET role = ?, status = ? WHERE id = ?");
    $stmtUpd->execute([$newRole, $newStatus, $staffId]);

    $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES (?, ?, ?, ?)")
        ->execute(['STAFF_UPDATE', $actorEmpId, $target['full_name'], "{$target['employee_id']} -> {$newRole} ({$newStatus})"]);

    echo json_encode([
        'status' => 'success',
        'message' => "Updated {$target['full_name']} to {$newRole} ({$newStatus}).",
        'data' => [
            'id' => $staffId,
            'employee_id' => $target['employee_id'],
            'full_name' => $target['full_name'],
            'role' => $newRole,
            'status' => $newStatus
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Staff management error: ' . $e->getMessage()]);
}
?>
