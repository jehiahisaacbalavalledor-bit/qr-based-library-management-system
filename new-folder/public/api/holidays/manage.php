<?php
/**
 * Library Holidays Manager Endpoint
 * GET  /api/holidays/manage.php -> List all exempted holidays
 * POST /api/holidays/manage.php -> Add or delete a holiday (action=add|delete)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->query("SELECT id, holiday_date, description, holiday_type, created_at FROM library_holidays ORDER BY holiday_date ASC");
        echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
        exit;
    }

    AuthGuard::requireAdmin();

    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = trim($input['action'] ?? 'add');

    if ($action === 'delete') {
        $id = isset($input['id']) ? (int) $input['id'] : 0;
        $date = trim($input['holiday_date'] ?? $input['holidayDate'] ?? '');
        if ($id > 0) {
            $stmt = $pdo->prepare("DELETE FROM library_holidays WHERE id = ?");
            $stmt->execute([$id]);
        } elseif ($date !== '') {
            $stmt = $pdo->prepare("DELETE FROM library_holidays WHERE holiday_date = ?");
            $stmt->execute([$date]);
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Holiday ID or date is required.']);
            exit;
        }
        echo json_encode(['status' => 'success', 'message' => 'Holiday removed from fine exemption calendar.']);
        exit;
    }

    $holidayDate = trim($input['holiday_date'] ?? $input['holidayDate'] ?? '');
    $description = trim($input['description'] ?? '');
    $holidayType = trim($input['holiday_type'] ?? $input['holidayType'] ?? 'school_holiday');

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $holidayDate) || $description === '') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Valid holiday date (YYYY-MM-DD) and description are required.']);
        exit;
    }

    if (!in_array($holidayType, ['regular', 'special_non_working', 'school_holiday'], true)) {
        $holidayType = 'school_holiday';
    }

    $stmt = $pdo->prepare("
        INSERT INTO library_holidays (holiday_date, description, holiday_type)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description), holiday_type = VALUES(holiday_type)
    ");
    $stmt->execute([$holidayDate, $description, $holidayType]);

    echo json_encode([
        'status'  => 'success',
        'message' => "Holiday '{$description}' ({$holidayDate}) saved."
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Holiday operation failed: ' . $e->getMessage()]);
}
?>
