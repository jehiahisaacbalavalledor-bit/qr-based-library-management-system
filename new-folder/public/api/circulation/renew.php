<?php
/**
 * Smart Circulation Desk - Loan Extension / Renewal Endpoint
 * POST /api/circulation/renew.php
 * Enforces: active loan only, no unpaid fines, not overdue, max 2 renewals per loan.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/FineEngine.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

$authSession = AuthGuard::requireAuth(['admin', 'student']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

$transactionCode = trim($input['transactionCode'] ?? $input['transaction_code'] ?? '');
$extensionType   = trim($input['extensionType'] ?? $input['extension_type'] ?? '1_day');
$todayStr        = trim($input['today'] ?? date('Y-m-d'));

if (empty($transactionCode)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Transaction Code is required.']);
    exit;
}

$validLoanTypes = ['1_day', '2_days', '3_days', 'overnight'];
if (!in_array($extensionType, $validLoanTypes, true)) {
    $extensionType = '1_day';
}

try {
    $stmt = $pdo->prepare("
        SELECT bt.*, s.student_number, s.full_name, b.book_code, b.title
        FROM borrow_transactions bt
        JOIN students s ON bt.student_id = s.id
        JOIN books b ON bt.book_id = b.id
        WHERE bt.transaction_code = ?
        LIMIT 1
    ");
    $stmt->execute([$transactionCode]);
    $tx = $stmt->fetch();

    if (!$tx) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => "Transaction {$transactionCode} not found."]);
        exit;
    }

    if ($authSession['user_type'] === 'student' && $tx['student_number'] !== ($authSession['student_number'] ?? '')) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Permission denied: you may only renew your own borrowed books.']);
        exit;
    }

    if (!in_array($tx['return_status'], ['borrowed', 'overdue'], true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => "Transaction {$transactionCode} is already closed ({$tx['return_status']})."]);
        exit;
    }

    $currentRenewals = (int) ($tx['renewal_count'] ?? 0);
    if ($currentRenewals >= 2) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => "Maximum of 2 renewals already reached for {$transactionCode}."]);
        exit;
    }

    $stmtFines = $pdo->prepare("SELECT COUNT(*) FROM fines WHERE student_id = ? AND payment_status = 'unpaid'");
    $stmtFines->execute([$tx['student_id']]);
    if ((int) $stmtFines->fetchColumn() > 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => "Cannot renew: {$tx['full_name']} has unpaid fines. Please settle fines first."]);
        exit;
    }

    if ($tx['due_date'] < $todayStr) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => "Cannot renew overdue loan {$transactionCode} (due {$tx['due_date']}). Process return/fine settlement first."]);
        exit;
    }

    $baseDate = ($tx['due_date'] >= $todayStr) ? $tx['due_date'] : $todayStr;
    $dueInfo = FineEngine::computeDueDate($baseDate, $extensionType);
    $newDueDate = $dueInfo['due_date'];
    $newRenewalCount = $currentRenewals + 1;

    $pdo->beginTransaction();

    $stmtUpdate = $pdo->prepare("
        UPDATE borrow_transactions
        SET due_date = ?,
            loan_type = ?,
            renewal_count = ?
        WHERE id = ?
    ");
    $stmtUpdate->execute([$newDueDate, $extensionType, $newRenewalCount, $tx['id']]);

    $stmtAudit = $pdo->prepare("
        INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details)
        VALUES ('RENEW_LOAN', ?, ?, ?)
    ");
    $stmtAudit->execute([
        $tx['student_number'],
        $tx['title'],
        "Extended ({$dueInfo['label']}) | Due: {$tx['due_date']} -> {$newDueDate} (Renewal #{$newRenewalCount})"
    ]);

    $pdo->commit();

    echo json_encode([
        'status'  => 'success',
        'message' => "Loan {$transactionCode} extended to {$newDueDate} ({$dueInfo['label']}).",
        'data'    => [
            'transaction_code'  => $tx['transaction_code'],
            'student_number'    => $tx['student_number'],
            'student_name'      => $tx['full_name'],
            'book_title'        => $tx['title'],
            'previous_due_date' => $tx['due_date'],
            'new_due_date'      => $newDueDate,
            'loan_type'         => $extensionType,
            'due_label'         => $dueInfo['label'],
            'renewal_count'     => $newRenewalCount
        ]
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Renewal failed: ' . $e->getMessage()]);
}
?>
