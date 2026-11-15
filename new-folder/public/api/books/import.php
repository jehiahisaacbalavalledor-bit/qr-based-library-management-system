<?php
/**
 * Library Books Catalog - Bulk CSV Import Endpoint
 * POST /api/books/import.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$items = $input['books'] ?? [];

if (!is_array($items) || count($items) === 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No book rows provided for import.']);
    exit;
}

$inserted = 0;
$updated  = 0;
$skipped  = 0;

try {
    $pdo->beginTransaction();

    $stmtCheck = $pdo->prepare("SELECT id, total_copies, available_copies FROM books WHERE book_code = ? LIMIT 1");
    $stmtInsert = $pdo->prepare("
        INSERT INTO books
            (book_code, accession_number, call_number, classification_number, isbn, title, author, category, publisher, publication_year, total_copies, available_copies, is_room_use_only, status)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
    ");
    $stmtUpdate = $pdo->prepare("
        UPDATE books
        SET title = ?, author = ?, category = ?, isbn = ?, call_number = ?, publisher = ?, publication_year = ?, total_copies = ?, available_copies = ?, is_room_use_only = ?
        WHERE id = ?
    ");

    foreach ($items as $row) {
        $bookCode = trim($row['book_code'] ?? $row['bookCode'] ?? '');
        $title    = trim($row['title'] ?? '');
        $author   = trim($row['author'] ?? '');

        if ($bookCode === '' || $title === '' || $author === '') {
            $skipped++;
            continue;
        }

        $category  = trim($row['category'] ?? 'General Collection') ?: 'General Collection';
        $callNo    = trim($row['call_number'] ?? $row['callNo'] ?? 'QA 76 .CVSU') ?: 'QA 76 .CVSU';
        $classNo   = trim($row['classification_number'] ?? $row['classification'] ?? '005.1') ?: '005.1';
        $isbn      = trim($row['isbn'] ?? '') ?: ('978-' . random_int(1000000000, 9999999999));
        $publisher = trim($row['publisher'] ?? '');
        $pubYearRaw = trim((string) ($row['publication_year'] ?? $row['publicationYear'] ?? ''));
        $pubYear   = preg_match('/^\d{4}$/', $pubYearRaw) ? (int) $pubYearRaw : null;
        $copies    = max(1, (int) ($row['total_copies'] ?? $row['totalCopies'] ?? 1));
        $roomUse   = !empty($row['is_room_use_only']) || strtoupper(trim((string) ($row['room_use'] ?? ''))) === 'YES' ? 1 : 0;

        $stmtCheck->execute([$bookCode]);
        $existing = $stmtCheck->fetch();

        if ($existing) {
            $borrowed = max(0, (int) $existing['total_copies'] - (int) $existing['available_copies']);
            $newAvail = max(0, $copies - $borrowed);
            $stmtUpdate->execute([
                $title, $author, $category, $isbn, $callNo,
                $publisher !== '' ? $publisher : null, $pubYear,
                $copies, $newAvail, $roomUse, $existing['id']
            ]);
            $updated++;
        } else {
            $accNo = trim($row['accession_number'] ?? '') ?: ('ACC-' . date('Y') . '-' . random_int(10000, 99999));
            $stmtInsert->execute([
                $bookCode, $accNo, $callNo, $classNo, $isbn,
                $title, $author, $category,
                $publisher !== '' ? $publisher : null, $pubYear,
                $copies, $copies, $roomUse
            ]);
            $inserted++;
        }
    }

    $pdo->commit();

    echo json_encode([
        'status'   => 'success',
        'message'  => "Book import complete: {$inserted} added, {$updated} updated, {$skipped} skipped.",
        'inserted' => $inserted,
        'updated'  => $updated,
        'skipped'  => $skipped
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Book import failed: ' . $e->getMessage()]);
}
?>
