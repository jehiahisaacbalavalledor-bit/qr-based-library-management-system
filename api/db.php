<?php
/**
 * Database Connection Configuration (MySQL / PDO)
 * Fits standard XAMPP, WAMP, or local MySQL environments
 */
header('Content-Type: application/json; charset=utf-8');

$host = 'localhost';
$dbname = 'cvsu_library_db';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    // If running in development without active MySQL, fail gracefully with JSON message
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit;
}
?>

