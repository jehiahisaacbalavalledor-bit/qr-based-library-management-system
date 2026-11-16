<?php
/**
 * Smart Circulation Desk - Settle / Waive Fine & Record Identical Book Replacement
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
$action = trim($input['action'] ?? 'paid'); // 'paid', 'waived', or 'replaced'
$receivedBy = !empty($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : (isset($input['librarian_id']) ? (int) $input['librarian_id'] : 1);

if ($fineId <= 0 || !in_array($action, ['paid', 'waived', 'replaced'], true)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Valid fineId and action (paid|waived|replaced) are required.']);
    exit;
}

try {
    $stmtFetch = $pdo->prepare("
        SELECT f.*, bt.book_id, bt.transaction_code, s.student_number, b.title, b.isbn, b.author
        FROM fines f
        JOIN borrow_transactions bt ON f.transaction_id = bt.id
        JOIN students s ON f.student_id = s.id
        JOIN books b ON bt.book_id = b.id
        WHERE f.id = ?
        LIMIT 1
    ");
    $stmtFetch->execute([$fineId]);
    $fine = $stmtFetch->fetch();

    if (!$fine) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Fine / replacement record not found.']);
        exit;
    }

    $pdo->beginTransaction();

    if ($action === 'replaced') {
        if ($fine['replacement_status'] !== 'pending_replacement') {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'This record is not awaiting book replacement.']);
            exit;
        }

        // Mark identical replacement received & restore copy to shelf if previously marked lost
        $stmtUpd = $pdo->prepare("UPDATE fines SET replacement_status = 'replaced', settled_at = NOW(), received_by = ?, remarks = CONCAT(COALESCE(remarks, ''), ' | Identical copy verified & replaced.') WHERE id = ?");
        $stmtUpd->execute([$receivedBy, $fineId]);

        if ($fine['book_condition'] === 'lost') {
            $pdo->prepare("UPDATE books SET available_copies = LEAST(total_copies, available_copies + 1), status = 'available' WHERE id = ?")
                ->execute([$fine['book_id']]);
        }

        $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES ('REPLACEMENT_COMPLETE', ?, ?, ?)")
            ->execute([$fine['student_number'], $fine['title'], "Identical replacement verified for {$fine['transaction_code']} (ISBN: {$fine['isbn']})"]);

        $pdo->commit();
        echo json_encode([
            'status'  => 'success',
            'message' => "Identical replacement recorded for '{$fine['title']}' ({$fine['transaction_code']})."
        ]);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE fines SET payment_status = ?, settled_at = NOW(), received_by = ? WHERE id = ?");
    $stmt->execute([$action, $receivedBy, $fineId]);

    $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES ('SETTLE_FINE', ?, ?, ?)")
        ->execute([$fine['student_number'], $fine['title'], "Fine #{$fineId} ({$fine['transaction_code']}) marked {$action}"]);

    $pdo->commit();

    echo json_encode([
        'status'  => 'success',
        'message' => "Fine #{$fineId} marked as {$action}."
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to update fine/replacement record: ' . $e->getMessage()]);
}
