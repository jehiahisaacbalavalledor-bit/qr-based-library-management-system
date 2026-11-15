<?php
/**
 * System Database Backup Endpoint
 * GET /api/system/backup.php?format=sql|json
 */
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

AuthGuard::requireHeadLibrarian();

$format = strtolower(trim($_GET['format'] ?? 'sql'));
$timestamp = date('Y-m-d_His');
$candidateTables = [
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

try {
    $existingStmt = $pdo->query('SHOW TABLES');
    $existingTables = $existingStmt->fetchAll(PDO::FETCH_COLUMN);
    $tables = array_values(array_intersect($candidateTables, $existingTables));

    if ($format === 'json') {
        $dump = ['exported_at' => date('c'), 'database' => 'cvsu_library_db', 'tables' => []];
        foreach ($tables as $t) {
            $stmt = $pdo->query("SELECT * FROM `{$t}`");
            $dump['tables'][$t] = $stmt->fetchAll();
        }
        header('Content-Type: application/json; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"cvsu_library_backup_{$timestamp}.json\"");
        echo json_encode($dump, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Content-Type: application/sql; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"cvsu_library_backup_{$timestamp}.sql\"");

    echo "-- CvSU Imus Library Management System Database Backup\n";
    echo "-- Generated: " . date('Y-m-d H:i:s') . "\n\n";
    echo "SET FOREIGN_KEY_CHECKS=0;\n\n";

    foreach ($tables as $t) {
        $stmt = $pdo->query("SELECT * FROM `{$t}`");
        $rows = $stmt->fetchAll();
        echo "-- Table: {$t} (" . count($rows) . " rows)\n";
        if (count($rows) === 0) {
            echo "\n";
            continue;
        }
        $cols = array_keys($rows[0]);
        $colList = '`' . implode('`, `', $cols) . '`';
        foreach ($rows as $row) {
            $vals = [];
            foreach ($cols as $c) {
                $v = $row[$c];
                $vals[] = ($v === null) ? 'NULL' : $pdo->quote((string) $v);
            }
            echo "INSERT INTO `{$t}` ({$colList}) VALUES (" . implode(', ', $vals) . ");\n";
        }
        echo "\n";
    }

    echo "SET FOREIGN_KEY_CHECKS=1;\n";
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'Backup failed: ' . $e->getMessage()]);
}
?>
