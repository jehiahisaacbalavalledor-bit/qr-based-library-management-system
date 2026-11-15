<?php
/**
 * Student Records - Update Student Endpoint
 * POST /api/students/update.php
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

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

$studentId     = isset($input['id']) ? (int) $input['id'] : 0;
$studentNumber = trim($input['studentNumber'] ?? $input['student_number'] ?? '');
$fullName      = trim($input['fullName'] ?? $input['full_name'] ?? '');
$email         = trim($input['email'] ?? '');

if (($studentId <= 0 && empty($studentNumber)) || empty($fullName) || empty($email)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Student identifier, full name, and email are required.']);
    exit;
}

try {
    if ($studentId > 0) {
        $stmtFind = $pdo->prepare("SELECT * FROM students WHERE id = ? LIMIT 1");
        $stmtFind->execute([$studentId]);
    } else {
        $stmtFind = $pdo->prepare("SELECT * FROM students WHERE student_number = ? LIMIT 1");
        $stmtFind->execute([$studentNumber]);
    }
    $existing = $stmtFind->fetch();

    if (!$existing) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Student record not found.']);
        exit;
    }

    $mobile        = trim($input['mobileNumber'] ?? $input['mobile_number'] ?? $existing['mobile_number']);
    $course        = trim($input['course'] ?? $existing['course']);
    $yearLevel     = trim($input['yearLevel'] ?? $input['year_level'] ?? $existing['year_level']);
    $campus        = trim($input['campus'] ?? $existing['campus']);
    $accountStatus = trim($input['accountStatus'] ?? $input['account_status'] ?? $existing['account_status']);

    if (!in_array($yearLevel, ['1st Year', '2nd Year', '3rd Year', '4th Year'], true)) {
        $yearLevel = $existing['year_level'];
    }
    if (!in_array($accountStatus, ['active', 'suspended', 'graduated'], true)) {
        $accountStatus = $existing['account_status'];
    }

    $stmtUpdate = $pdo->prepare("
        UPDATE students
        SET full_name = ?,
            email = ?,
            mobile_number = ?,
            course = ?,
            year_level = ?,
            campus = ?,
            account_status = ?
        WHERE id = ?
    ");
    $stmtUpdate->execute([
        $fullName,
        $email,
        $mobile,
        $course,
        $yearLevel,
        $campus,
        $accountStatus,
        $existing['id']
    ]);

    echo json_encode([
        'status'  => 'success',
        'message' => "Student '{$fullName}' updated.",
        'data'    => [
            'id'             => $existing['id'],
            'student_number' => $existing['student_number'],
            'full_name'      => $fullName,
            'email'          => $email,
            'mobile_number'  => $mobile,
            'course'         => $course,
            'year_level'     => $yearLevel,
            'campus'         => $campus,
            'account_status' => $accountStatus
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Could not update student: ' . $e->getMessage()]);
}
?>
