<?php
/**
 * Library Books Catalog - Create Book Endpoint
 * POST /api/books/create.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

$bookCode      = trim($input['bookCode'] ?? $input['book_code'] ?? '');
$title         = trim($input['title'] ?? '');
$author        = trim($input['author'] ?? '');
$category      = trim($input['category'] ?? 'Computer Science & IT');
$callNo        = trim($input['callNumber'] ?? $input['call_number'] ?? ('QA ' . random_int(100, 999) . ' .CVSU'));
$copies        = max(1, (int) ($input['totalCopies'] ?? $input['total_copies'] ?? 1));
$isRoomUseOnly = !empty($input['isRoomUseOnly']) ? 1 : 0;

if (empty($bookCode) || empty($title) || empty($author)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Book code, title, and author are required.']);
    exit;
}

try {
    $accessionNo = 'ACC-' . date('Y') . '-' . random_int(10000, 99999);
    $isbn = trim($input['isbn'] ?? ('978-' . random_int(1000000000, 9999999999)));
    $classification = trim($input['classification'] ?? '005.1');

    $stmt = $pdo->prepare("
        INSERT INTO books
            (book_code, accession_number, call_number, classification_number, isbn, title, author, category, total_copies, available_copies, is_room_use_only, status)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
    ");
    $stmt->execute([
        $bookCode,
        $accessionNo,
        $callNo,
        $classification,
        $isbn,
        $title,
        $author,
        $category,
        $copies,
        $copies,
        $isRoomUseOnly
    ]);

    echo json_encode([
        'status'  => 'success',
        'message' => "Book '{$title}' added to MySQL catalog.",
        'data'    => [
            'id'               => $pdo->lastInsertId(),
            'book_code'        => $bookCode,
            'accession_number' => $accessionNo,
            'call_number'      => $callNo,
            'title'            => $title,
            'author'           => $author,
            'category'         => $category,
            'total_copies'     => $copies,
            'available_copies' => $copies,
            'is_room_use_only' => $isRoomUseOnly
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Could not add book: ' . $e->getMessage()]);
}
?>
