<?php
/**
 * Current Auth Session Status Endpoint
 * GET /api/auth/session.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

echo json_encode([
    'status' => 'success',
    'data'   => AuthGuard::currentSession()
]);
?>
