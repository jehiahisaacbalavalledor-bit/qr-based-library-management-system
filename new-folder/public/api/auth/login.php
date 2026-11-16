<?php
/**
 * Student Login API Endpoint
 * Handles student authentication via Student Number & Password
 */
header('Content-Type: application/json; charset=utf-8');
session_start();

require_once __DIR__ . '/../../../backend/config/db.php';
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$studentNumber = trim($input['studentNumber'] ?? '');
$password = $input['password'] ?? '';

// Sanitize student number (strip dashes/spaces)
$cleanStudentNo = preg_replace('/[\s-]/', '', $studentNumber);

if (empty($cleanStudentNo) || empty($password)) {
    echo json_encode(['status' => 'error', 'message' => 'Please enter both Student Number and Password.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM students WHERE REPLACE(REPLACE(student_number, '-', ''), ' ', '') = ? LIMIT 1");
    $stmt->execute([$cleanStudentNo]);
    $student = $stmt->fetch();

    $legacyPlaceholderHash = '$2y$10$wN1G78p6d/vHwZtYlE4.reVf.9c3uK7nI4.V9E/RkPq3L9q3G.K6a';
    $passwordValid = false;
    if ($student) {
        if (password_verify($password, $student['password_hash'])) {
            $passwordValid = true;
        } elseif ($student['password_hash'] === $legacyPlaceholderHash && $password === 'Password123!') {
            // Migrate legacy placeholder seed hash to real bcrypt on first login
            $newHash = password_hash($password, PASSWORD_BCRYPT);
            $pdo->prepare("UPDATE students SET password_hash = ? WHERE id = ?")->execute([$newHash, $student['id']]);
            $passwordValid = true;
        }
    }

    if ($student && $passwordValid) {
        if (isset($student['account_status']) && $student['account_status'] !== 'active') {
            echo json_encode([
                'status' => 'error',
                'message' => "Your student account is currently {$student['account_status']}. Please contact the Library Desk."
            ]);
            exit;
        }

        AuthGuard::setStudentSession($student);
        $_SESSION['student_id'] = $student['id'];
        $_SESSION['student_number'] = $student['student_number'];
        $_SESSION['full_name'] = $student['full_name'];

        echo json_encode([
            'status' => 'success',
            'message' => 'Login successful',
            'data' => [
                'id' => $student['id'],
                'studentNumber' => $student['student_number'],
                'fullName' => $student['full_name'],
                'email' => $student['email'],
                'mobile' => $student['mobile_number'] ?? '',
                'course' => $student['course'] ?? 'BS Information Technology',
                'yearLevel' => $student['year_level'] ?? '1st Year',
                'campus' => $student['campus'] ?? 'Imus Campus'
            ]
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid Student Number or Password.']);
    }
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => 'Server error occurred: ' . $e->getMessage()]);
}
?>

