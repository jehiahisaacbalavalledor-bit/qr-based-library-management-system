<?php
/**
 * Library Books Catalog - List Endpoint
 * GET /api/books/list.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';

try {
    $stmt = $pdo->query("
        SELECT id, book_code, accession_number, call_number, classification_number,
               isbn, title, author, category, publisher, publication_year, marc_tags,
               total_copies, available_copies, is_room_use_only, status
        FROM books
        ORDER BY id ASC
    ");
    $books = $stmt->fetchAll();

    echo json_encode([
        'status' => 'success',
        'data'   => $books
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to load books catalog: ' . $e->getMessage()]);
}
?>
