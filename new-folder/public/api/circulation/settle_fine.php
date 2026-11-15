<?php
/**
 * Smart Circulation Desk - Settle / Waive Fine Endpoint
 * POST /api/circulation/settle_fine.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

AuthGuard::requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$fineId = isset($input['fineId']) ? (int) $input['fineId'] : 0;
$action = trim($input['action'] ?? 'paid'); // 'paid' or 'waived'
$receivedBy = isset($input['librarian_id']) ? (int) $input['librarian_id'] : 1;

if ($fineId <= 0 || !in_array($action, ['paid', 'waived'], true)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Valid fineId and action (paid|waived) are required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE fines SET payment_status = ?, settled_at = NOW(), received_by = ? WHERE id = ?");
    $stmt->execute([$action, $receivedBy, $fineId]);

    echo json_encode([
        'status'  => 'success',
        'message' => "Fine #{$fineId} marked as {$action}."
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to settle fine: ' . $e->getMessage()]);
}
?>
