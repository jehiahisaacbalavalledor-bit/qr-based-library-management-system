<?php
/**
 * Per-Copy Book Tracking Endpoint (Accession Copy Barcodes & Condition Status)
 * GET  /api/books/copies.php?book_code=BK-CVSU-001 -> List / auto-sync copy items for a book
 * POST /api/books/copies.php                        -> Update individual copy status
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

AuthGuard::requireAdmin();

function ensureBookCopiesTable(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `book_copies` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `book_id` INT NOT NULL,
          `copy_number` INT NOT NULL,
          `copy_barcode` VARCHAR(64) NOT NULL UNIQUE,
          `condition_status` ENUM('available', 'borrowed', 'damaged', 'lost', 'room_use') NOT NULL DEFAULT 'available',
          `notes` VARCHAR(255) DEFAULT NULL,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT `fk_copy_book` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB
    ");
}

function syncCopiesForBook(PDO $pdo, array $book): array
{
    $stmt = $pdo->prepare("SELECT * FROM book_copies WHERE book_id = ? ORDER BY copy_number ASC");
    $stmt->execute([$book['id']]);
    $existing = $stmt->fetchAll();

    $total = max(1, (int) $book['total_copies']);
    $avail = max(0, (int) $book['available_copies']);
    $borrowedCount = max(0, $total - $avail);

    if (count($existing) < $total) {
        $ins = $pdo->prepare("INSERT IGNORE INTO book_copies (book_id, copy_number, copy_barcode, condition_status) VALUES (?, ?, ?, ?)");
        for ($i = count($existing) + 1; $i <= $total; $i++) {
            $barcode = $book['book_code'] . '-C' . $i;
            $status = !empty($book['is_room_use_only'])
                ? 'room_use'
                : ($i <= $borrowedCount ? 'borrowed' : 'available');
            $ins->execute([$book['id'], $i, $barcode, $status]);
        }
        $stmt->execute([$book['id']]);
        $existing = $stmt->fetchAll();
    }
    return $existing;
}

try {
    ensureBookCopiesTable($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $bookCode = trim($_GET['book_code'] ?? '');
        if ($bookCode === '') {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'book_code parameter is required.']);
            exit;
        }
        $bStmt = $pdo->prepare("SELECT * FROM books WHERE book_code = ? LIMIT 1");
        $bStmt->execute([$bookCode]);
        $book = $bStmt->fetch();
        if (!$book) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Book not found.']);
            exit;
        }
        $copies = syncCopiesForBook($pdo, $book);
        echo json_encode(['status' => 'success', 'book' => $book, 'data' => $copies]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $copyId = isset($input['id']) ? (int) $input['id'] : 0;
        $status = trim($input['condition_status'] ?? 'available');
        $notes  = trim($input['notes'] ?? '');
        if ($copyId <= 0 || !in_array($status, ['available', 'borrowed', 'damaged', 'lost', 'room_use'], true)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Valid copy id and condition_status are required.']);
            exit;
        }
        $upd = $pdo->prepare("UPDATE book_copies SET condition_status = ?, notes = ? WHERE id = ?");
        $upd->execute([$status, $notes !== '' ? $notes : null, $copyId]);
        echo json_encode(['status' => 'success', 'message' => "Copy #{$copyId} status updated to {$status}."]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Book copy tracking error: ' . $e->getMessage()]);
}
