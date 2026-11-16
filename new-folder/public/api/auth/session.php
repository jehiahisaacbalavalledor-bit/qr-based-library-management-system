<?php
/**
 * Current Auth Session Status Endpoint
 * GET /api/auth/session.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../backend/helpers/AuthGuard.php';

$session = AuthGuard::currentSession();

if (!empty($session['authenticated']) && ($session['user_type'] ?? '') === 'student' && !empty($session['user_id'])) {
    try {
        require_once __DIR__ . '/../../../backend/config/db.php';
        $stmt = $pdo->prepare("SELECT student_number, full_name, email, mobile_number, course, year_level, campus FROM students WHERE id = ? LIMIT 1");
        $stmt->execute([(int) $session['user_id']]);
        if ($stu = $stmt->fetch()) {
            $session['student_number'] = $stu['student_number'];
            $session['full_name'] = $stu['full_name'];
            $session['email'] = $stu['email'];
            $session['mobile'] = $stu['mobile_number'];
            $session['course'] = $stu['course'];
            $session['yearLevel'] = $stu['year_level'];
            $session['campus'] = $stu['campus'];
        }
    } catch (Throwable $e) {
        // Keep base session payload if DB lookup fails
    }
}

echo json_encode([
    'status' => 'success',
    'data'   => $session
]);
