<?php
/**
 * Circulation & Staff Audit Logs Endpoint
 * GET /api/audit/list.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';

try {
    $actionType = trim($_GET['action_type'] ?? '');
    if ($actionType !== '') {
        $stmt = $pdo->prepare("
            SELECT id, action_type, student_number, book_title, details, created_at
            FROM circulation_audit_logs
            WHERE action_type = ?
            ORDER BY id DESC
            LIMIT 100
        ");
        $stmt->execute([$actionType]);
    } else {
        $stmt = $pdo->query("
            SELECT id, action_type, student_number, book_title, details, created_at
            FROM circulation_audit_logs
            ORDER BY id DESC
            LIMIT 100
        ");
    }

    echo json_encode([
        'status' => 'success',
        'data'   => $stmt->fetchAll()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to load audit logs: ' . $e->getMessage()]);
}
?>
