<?php
/**
 * Library Books Catalog - Update Book Endpoint
 * POST /api/books/update.php
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
$title    = trim($input['title'] ?? '');
$author   = trim($input['author'] ?? '');

if (($bookId <= 0 && empty($bookCode)) || empty($title) || empty($author)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Book identifier, title, and author are required.']);
    exit;
}

try {
    if ($bookId > 0) {
        $stmtFind = $pdo->prepare("SELECT * FROM books WHERE id = ? LIMIT 1");
        $stmtFind->execute([$bookId]);
    } else {
        $stmtFind = $pdo->prepare("SELECT * FROM books WHERE book_code = ? LIMIT 1");
        $stmtFind->execute([$bookCode]);
    }
    $existing = $stmtFind->fetch();

    if (!$existing) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Book record not found.']);
        exit;
    }

    $category       = trim($input['category'] ?? $existing['category']);
    $isbn           = trim($input['isbn'] ?? $existing['isbn'] ?? '');
    $callNo         = trim($input['callNumber'] ?? $input['call_number'] ?? $existing['call_number']);
    $classification = trim($input['classification'] ?? $input['classification_number'] ?? $existing['classification_number']);
    $publisher      = trim($input['publisher'] ?? '');
    $pubYearRaw     = trim((string) ($input['publicationYear'] ?? $input['publication_year'] ?? ''));
    $pubYear        = preg_match('/^\d{4}$/', $pubYearRaw) ? (int) $pubYearRaw : null;
    $newTotal       = max(1, (int) ($input['totalCopies'] ?? $input['total_copies'] ?? $existing['total_copies']));
    $isRoomUseOnly  = isset($input['isRoomUseOnly'])
        ? (!empty($input['isRoomUseOnly']) ? 1 : 0)
        : (int) $existing['is_room_use_only'];

    $borrowedCount = max(0, (int) $existing['total_copies'] - (int) $existing['available_copies']);
    $newAvailable  = max(0, $newTotal - $borrowedCount);

    $marcInput = $input['marcTags'] ?? $input['marc_tags'] ?? null;
    if (is_string($marcInput) && trim($marcInput) !== '') {
        $marcJson = trim($marcInput);
    } elseif (is_array($marcInput)) {
        $marcJson = json_encode($marcInput, JSON_UNESCAPED_UNICODE);
    } else {
        $marcJson = json_encode([
            '020' => $isbn !== '' ? $isbn : 'N/A',
            '082' => $classification,
            '100' => $author,
            '245' => $title,
            '264' => trim(($publisher !== '' ? $publisher : 'N/A') . ($pubYear ? ", {$pubYear}" : '')),
            '650' => $category,
            '852' => $callNo
        ], JSON_UNESCAPED_UNICODE);
    }

    $stmtUpdate = $pdo->prepare("
        UPDATE books
        SET title = ?,
            author = ?,
            category = ?,
            isbn = ?,
            call_number = ?,
            classification_number = ?,
            publisher = ?,
            publication_year = ?,
            marc_tags = ?,
            total_copies = ?,
            available_copies = ?,
            is_room_use_only = ?
        WHERE id = ?
    ");
    $stmtUpdate->execute([
        $title,
        $author,
        $category,
        $isbn !== '' ? $isbn : null,
        $callNo,
        $classification,
        $publisher !== '' ? $publisher : null,
        $pubYear,
        $marcJson,
        $newTotal,
        $newAvailable,
        $isRoomUseOnly,
        $existing['id']
    ]);

    echo json_encode([
        'status'  => 'success',
        'message' => "Book '{$title}' updated.",
        'data'    => [
            'id'                    => $existing['id'],
            'book_code'             => $existing['book_code'],
            'title'                 => $title,
            'author'                => $author,
            'category'              => $category,
            'isbn'                  => $isbn !== '' ? $isbn : null,
            'call_number'           => $callNo,
            'classification_number' => $classification,
            'publisher'             => $publisher !== '' ? $publisher : null,
            'publication_year'      => $pubYear,
            'total_copies'          => $newTotal,
            'available_copies'      => $newAvailable,
            'is_room_use_only'      => $isRoomUseOnly
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Could not update book: ' . $e->getMessage()]);
}
?>
