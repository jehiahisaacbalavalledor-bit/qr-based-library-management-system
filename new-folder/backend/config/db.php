<?php
/**
 * Database Connection Configuration (MySQL / PDO)
 * Reads optional environment variables or backend/config/.env.php overrides,
 * falling back cleanly to default XAMPP / local MySQL settings.
 */
header('Content-Type: application/json; charset=utf-8');

$envOverrides = [];
$envFile = __DIR__ . '/.env.php';
if (is_file($envFile)) {
    $loaded = include $envFile;
    if (is_array($loaded)) {
        $envOverrides = $loaded;
    }
}

$host     = getenv('CVSU_DB_HOST') ?: ($envOverrides['CVSU_DB_HOST'] ?? 'localhost');
$dbname   = getenv('CVSU_DB_NAME') ?: ($envOverrides['CVSU_DB_NAME'] ?? 'cvsu_library_db');
$username = getenv('CVSU_DB_USER') ?: ($envOverrides['CVSU_DB_USER'] ?? 'root');
$password = getenv('CVSU_DB_PASS');
if ($password === false) {
    $password = $envOverrides['CVSU_DB_PASS'] ?? '';
}

try {
    $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    // Fail gracefully with JSON message if MySQL is unreachable
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit;
}
