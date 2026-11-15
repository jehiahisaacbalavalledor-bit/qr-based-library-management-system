<?php
/**
 * Library Books Catalog - Delete Book Endpoint
 * POST /api/books/delete.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$bookId   = isset($input['id']) ? (int) $input['id'] : 0;
$bookCode = trim($input['bookCode'] ?? $input['book_code'] ?? '');

if ($bookId <= 0 && empty($bookCode)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Book ID or Book Code is required.']);
    exit;
}

try {
    if ($bookId > 0) {
        $stmtFind = $pdo->prepare("SELECT id, book_code, title FROM books WHERE id = ? LIMIT 1");
        $stmtFind->execute([$bookId]);
    } else {
        $stmtFind = $pdo->prepare("SELECT id, book_code, title FROM books WHERE book_code = ? LIMIT 1");
        $stmtFind->execute([$bookCode]);
    }
    $book = $stmtFind->fetch();

    if (!$book) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Book not found.']);
        exit;
    }

    $stmtActive = $pdo->prepare("SELECT COUNT(*) FROM borrow_transactions WHERE book_id = ? AND return_status IN ('borrowed', 'overdue')");
    $stmtActive->execute([$book['id']]);
    if ((int) $stmtActive->fetchColumn() > 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => "Cannot delete '{$book['title']}' while copies are currently borrowed."]);
        exit;
    }

    $stmtDel = $pdo->prepare("DELETE FROM books WHERE id = ?");
    $stmtDel->execute([$book['id']]);

    echo json_encode([
        'status'  => 'success',
        'message' => "Book '{$book['title']}' deleted from catalog."
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Could not delete book: ' . $e->getMessage()]);
}
?>
