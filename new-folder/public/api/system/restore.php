<?php
/**
 * One-Click System Database Restore Endpoint
 * POST /api/system/restore.php
 * Accepts JSON backup exported by /api/system/backup.php?format=json
 */
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed. Use POST.']);
    exit;
}

AuthGuard::requireHeadLibrarian();

$allowedTables = [
    'admins',
    'library_staff',
    'students',
    'books',
    'borrow_transactions',
    'fines',
    'library_holidays',
    'book_reservations',
    'activity_logs',
    'circulation_audit_logs'
];

$rawJson = '';
if (!empty($_FILES['backup_file']) && $_FILES['backup_file']['error'] === UPLOAD_ERR_OK) {
    if ((int) $_FILES['backup_file']['size'] > 20 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Backup file exceeds 20 MB limit.']);
        exit;
    }
    $rawJson = (string) file_get_contents($_FILES['backup_file']['tmp_name']);
} else {
    $rawJson = (string) file_get_contents('php://input');
}

if (trim($rawJson) === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No JSON backup payload uploaded.']);
    exit;
}

$dump = json_decode($rawJson, true);
if (json_last_error() !== JSON_ERROR_NONE || !is_array($dump) || !isset($dump['tables']) || !is_array($dump['tables'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON backup format. Expected exported backup with a "tables" object.']);
    exit;
}

$tablesToRestore = [];
foreach ($allowedTables as $table) {
    if (array_key_exists($table, $dump['tables'])) {
        if (!is_array($dump['tables'][$table])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => "Invalid rows structure for table '{$table}'."]);
            exit;
        }
        $tablesToRestore[] = $table;
    }
}

if (count($tablesToRestore) === 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No recognized CvSU Library tables found in backup file.']);
    exit;
}

if (in_array('admins', $tablesToRestore, true) && count($dump['tables']['admins']) === 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Refusing restore: admins table in backup cannot be empty.']);
    exit;
}

$restoredCounts = [];
$totalRows = 0;

try {
    $existingTables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $tablesToRestore = array_values(array_intersect($tablesToRestore, $existingTables));
    if (count($tablesToRestore) === 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'No matching tables exist in target database.']);
        exit;
    }

    // Load valid column allowlist for every table before starting transaction
    $tableColumns = [];
    foreach ($tablesToRestore as $table) {
        $colStmt = $pdo->query("SHOW COLUMNS FROM `{$table}`");
        $tableColumns[$table] = array_map(static fn($r) => $r['Field'], $colStmt->fetchAll());
    }

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $pdo->beginTransaction();

    // Clear tables in reverse dependency order using DELETE (transaction-safe in MySQL)
    foreach (array_reverse($tablesToRestore) as $table) {
        $pdo->exec("DELETE FROM `{$table}`");
    }

    // Re-insert rows in parent-to-child dependency order with prepared statements
    foreach ($tablesToRestore as $table) {
        $rows = $dump['tables'][$table];
        $validCols = $tableColumns[$table];
        $inserted = 0;

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $insertCols = array_values(array_intersect(array_keys($row), $validCols));
            if (count($insertCols) === 0) {
                continue;
            }

            $colList = implode(', ', array_map(static fn($c) => "`{$c}`", $insertCols));
            $placeholders = implode(', ', array_fill(0, count($insertCols), '?'));
            $stmt = $pdo->prepare("INSERT INTO `{$table}` ({$colList}) VALUES ({$placeholders})");

            $values = [];
            foreach ($insertCols as $c) {
                $val = $row[$c];
                $values[] = is_bool($val) ? (int) $val : $val;
            }
            $stmt->execute($values);
            $inserted++;
        }

        $restoredCounts[$table] = $inserted;
        $totalRows += $inserted;
    }

    // Record restore audit log entry
    $adminEmpId = $_SESSION['employee_id'] ?? 'ADMIN';
    $auditStmt = $pdo->prepare(
        "INSERT INTO `circulation_audit_logs` (`action_type`, `student_number`, `book_title`, `details`) VALUES (?, ?, ?, ?)"
    );
    $auditStmt->execute([
        'SYSTEM_RESTORE',
        $adminEmpId,
        'Database Backup Restore',
        "Restored {$totalRows} row(s) across " . count($restoredCounts) . ' table(s)'
    ]);

    $pdo->commit();
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    echo json_encode([
        'status' => 'success',
        'message' => "Database restored successfully ({$totalRows} row(s) across " . count($restoredCounts) . ' table(s)).',
        'data' => [
            'exported_at' => $dump['exported_at'] ?? null,
            'total_rows' => $totalRows,
            'tables' => $restoredCounts
        ]
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    try {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    } catch (Exception $ignored) {
    }
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Restore failed and rolled back cleanly: ' . $e->getMessage()
    ]);
}
?>
