<?php
/**
 * Book Hold & Reservation Queue Endpoint
 * GET  /api/books/reservations.php -> List reservations (scoped to student if student session; all if admin)
 * POST /api/books/reservations.php -> Create, cancel, mark_ready, or fulfill reservation
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

$authSession = AuthGuard::requireAuth(['admin', 'student']);

function ensureReservationsTable(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `book_reservations` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `student_id` INT NOT NULL,
            `book_id` INT NOT NULL,
            `status` ENUM('pending', 'ready_for_pickup', 'fulfilled', 'cancelled') NOT NULL DEFAULT 'pending',
            `notes` VARCHAR(255) DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_res_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_res_book` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB
    ");
}

try {
    ensureReservationsTable($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $isStudent = ($authSession['user_type'] === 'student');
        if ($isStudent) {
            $stmt = $pdo->prepare("
                SELECT r.id, r.student_id, r.book_id, r.status, r.notes, r.created_at, r.updated_at,
                       s.student_number, s.full_name,
                       b.book_code, b.title, b.author, b.call_number, b.available_copies, b.total_copies
                FROM book_reservations r
                JOIN students s ON r.student_id = s.id
                JOIN books b ON r.book_id = b.id
                WHERE s.student_number = ?
                ORDER BY FIELD(r.status, 'ready_for_pickup', 'pending', 'fulfilled', 'cancelled'), r.created_at DESC
            ");
            $stmt->execute([$authSession['student_number'] ?? '']);
        } else {
            $stmt = $pdo->query("
                SELECT r.id, r.student_id, r.book_id, r.status, r.notes, r.created_at, r.updated_at,
                       s.student_number, s.full_name, s.course,
                       b.book_code, b.title, b.author, b.call_number, b.available_copies, b.total_copies
                FROM book_reservations r
                JOIN students s ON r.student_id = s.id
                JOIN books b ON r.book_id = b.id
                ORDER BY FIELD(r.status, 'ready_for_pickup', 'pending', 'fulfilled', 'cancelled'), r.created_at ASC
            ");
        }
        echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = trim($input['action'] ?? 'reserve');

    if ($action === 'reserve') {
        $studentNumber = ($authSession['user_type'] === 'student')
            ? ($authSession['student_number'] ?? '')
            : trim($input['studentNumber'] ?? $input['student_number'] ?? '');
        $bookCode = trim($input['bookCode'] ?? $input['book_code'] ?? '');
        $notes = substr(trim($input['notes'] ?? ''), 0, 200);

        if ($studentNumber === '' || $bookCode === '') {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Student number and book code are required.']);
            exit;
        }

        $stmtStu = $pdo->prepare("SELECT id, student_number, full_name, account_status FROM students WHERE student_number = ? LIMIT 1");
        $stmtStu->execute([$studentNumber]);
        $student = $stmtStu->fetch();
        if (!$student || $student['account_status'] !== 'active') {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Active student account is required to place a hold.']);
            exit;
        }

        $stmtBook = $pdo->prepare("SELECT id, book_code, title, available_copies, is_room_use_only FROM books WHERE book_code = ? LIMIT 1");
        $stmtBook->execute([$bookCode]);
        $book = $stmtBook->fetch();
        if (!$book) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Book not found in catalog.']);
            exit;
        }

        if ((int) $book['is_room_use_only'] === 1) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Room-Use-Only references cannot be reserved for checkout.']);
            exit;
        }

        if ((int) $book['available_copies'] > 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Copies are currently on shelf. Present your QR ID at the circulation desk to borrow.']);
            exit;
        }

        $stmtDup = $pdo->prepare("SELECT COUNT(*) FROM book_reservations WHERE student_id = ? AND book_id = ? AND status IN ('pending', 'ready_for_pickup')");
        $stmtDup->execute([$student['id'], $book['id']]);
        if ((int) $stmtDup->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'You already have an active reservation hold for this title.']);
            exit;
        }

        $stmtMax = $pdo->prepare("SELECT COUNT(*) FROM book_reservations WHERE student_id = ? AND status IN ('pending', 'ready_for_pickup')");
        $stmtMax->execute([$student['id']]);
        if ((int) $stmtMax->fetchColumn() >= 3) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Maximum of 3 active book holds reached.']);
            exit;
        }

        $pdo->prepare("INSERT INTO book_reservations (student_id, book_id, status, notes) VALUES (?, ?, 'pending', ?)")
            ->execute([$student['id'], $book['id'], $notes ?: null]);
        $newId = (int) $pdo->lastInsertId();

        $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES (?, ?, ?, ?)")
            ->execute(['BOOK_RESERVE', $student['student_number'], $book['title'], "Placed reservation hold (#{$newId})"]);

        echo json_encode([
            'status' => 'success',
            'message' => "Reservation placed for \"{$book['title']}\". You will be notified when a copy is returned.",
            'data' => ['id' => $newId, 'status' => 'pending']
        ]);
        exit;
    }

    $resId = isset($input['id']) ? (int) $input['id'] : 0;
    if ($resId <= 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Valid reservation ID is required.']);
        exit;
    }

    $stmtFind = $pdo->prepare("
        SELECT r.*, s.student_number, b.title
        FROM book_reservations r
        JOIN students s ON r.student_id = s.id
        JOIN books b ON r.book_id = b.id
        WHERE r.id = ?
        LIMIT 1
    ");
    $stmtFind->execute([$resId]);
    $resRow = $stmtFind->fetch();
    if (!$resRow) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Reservation not found.']);
        exit;
    }

    if ($action === 'cancel') {
        if ($authSession['user_type'] === 'student' && $resRow['student_number'] !== ($authSession['student_number'] ?? '')) {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'Permission denied: cannot cancel another student reservation.']);
            exit;
        }
        $pdo->prepare("UPDATE book_reservations SET status = 'cancelled' WHERE id = ?")->execute([$resId]);
        $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES (?, ?, ?, ?)")
            ->execute(['RESERVATION_UPDATE', $resRow['student_number'], $resRow['title'], "Reservation #{$resId} cancelled"]);
        echo json_encode(['status' => 'success', 'message' => 'Reservation hold cancelled.']);
        exit;
    }

    // mark_ready & fulfill are admin-only actions
    AuthGuard::requireAdmin();

    $statusMap = [
        'mark_ready' => 'ready_for_pickup',
        'fulfill'    => 'fulfilled'
    ];
    if (!isset($statusMap[$action])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid reservation action.']);
        exit;
    }

    $nextStatus = $statusMap[$action];
    $pdo->prepare("UPDATE book_reservations SET status = ? WHERE id = ?")->execute([$nextStatus, $resId]);
    $pdo->prepare("INSERT INTO circulation_audit_logs (action_type, student_number, book_title, details) VALUES (?, ?, ?, ?)")
        ->execute(['RESERVATION_UPDATE', $resRow['student_number'], $resRow['title'], "Reservation #{$resId} -> {$nextStatus}"]);

    echo json_encode(['status' => 'success', 'message' => "Reservation updated to {$nextStatus}."]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Reservation system error: ' . $e->getMessage()]);
}
?>
