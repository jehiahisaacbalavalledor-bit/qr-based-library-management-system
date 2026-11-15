<?php
/**
 * Student Records - Bulk CSV Import Endpoint
 * POST /api/students/import.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

AuthGuard::requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$items = $input['students'] ?? [];

if (!is_array($items) || count($items) === 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No student rows provided for import.']);
    exit;
}

$inserted = 0;
$updated  = 0;
$skipped  = 0;

try {
    $pdo->beginTransaction();

    $stmtCheck = $pdo->prepare("SELECT id FROM students WHERE student_number = ? OR email = ? LIMIT 1");
    $stmtInsert = $pdo->prepare("
        INSERT INTO students
            (student_number, full_name, email, mobile_number, course, year_level, campus, date_of_birth, password_hash, account_status)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmtUpdate = $pdo->prepare("
        UPDATE students
        SET full_name = ?, email = ?, mobile_number = ?, course = ?, year_level = ?, campus = ?, account_status = ?
        WHERE id = ?
    ");

    $defaultHash = password_hash('Password123!', PASSWORD_BCRYPT);

    foreach ($items as $row) {
        $studentNo = trim($row['student_number'] ?? $row['studentNumber'] ?? '');
        $fullName  = trim($row['full_name'] ?? $row['fullName'] ?? '');
        $email     = trim($row['email'] ?? '');

        if ($studentNo === '' || $fullName === '' || $email === '') {
            $skipped++;
            continue;
        }

        $mobile = trim($row['mobile_number'] ?? $row['mobileNumber'] ?? '09170000000') ?: '09170000000';
        $course = trim($row['course'] ?? 'BS Information Technology') ?: 'BS Information Technology';
        $year   = trim($row['year_level'] ?? $row['yearLevel'] ?? '1st Year');
        if (!in_array($year, ['1st Year', '2nd Year', '3rd Year', '4th Year'], true)) {
            $year = '1st Year';
        }
        $campus = trim($row['campus'] ?? 'Imus Campus') ?: 'Imus Campus';
        $dob    = trim($row['date_of_birth'] ?? '2004-01-01');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) {
            $dob = '2004-01-01';
        }
        $status = trim($row['account_status'] ?? 'active');
        if (!in_array($status, ['active', 'suspended', 'graduated'], true)) {
            $status = 'active';
        }

        $stmtCheck->execute([$studentNo, $email]);
        $existing = $stmtCheck->fetch();

        if ($existing) {
            $stmtUpdate->execute([$fullName, $email, $mobile, $course, $year, $campus, $status, $existing['id']]);
            $updated++;
        } else {
            $stmtInsert->execute([$studentNo, $fullName, $email, $mobile, $course, $year, $campus, $dob, $defaultHash, $status]);
            $inserted++;
        }
    }

    $pdo->commit();

    echo json_encode([
        'status'   => 'success',
        'message'  => "Student import complete: {$inserted} added, {$updated} updated, {$skipped} skipped.",
        'inserted' => $inserted,
        'updated'  => $updated,
        'skipped'  => $skipped
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Student import failed: ' . $e->getMessage()]);
}
?>
