<?php
/**
 * Server-Side Session & Role-Based Access Control Helper
 */
class AuthGuard
{
    public static function startSession(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    public static function setStudentSession(array $student): void
    {
        self::startSession();
        $_SESSION['user_type'] = 'student';
        $_SESSION['user_id'] = (int) $student['id'];
        $_SESSION['student_number'] = $student['student_number'];
        $_SESSION['full_name'] = $student['full_name'];
        $_SESSION['role'] = 'Student';
    }

    public static function setAdminSession(array $admin): void
    {
        self::startSession();
        $_SESSION['user_type'] = 'admin';
        $_SESSION['user_id'] = (int) $admin['id'];
        $_SESSION['employee_id'] = $admin['employee_id'];
        $_SESSION['full_name'] = $admin['full_name'];
        $_SESSION['role'] = $admin['role'] ?? 'Library Staff';
    }

    public static function currentSession(): array
    {
        self::startSession();
        if (empty($_SESSION['user_type'])) {
            return ['authenticated' => false];
        }
        return [
            'authenticated'  => true,
            'user_type'      => $_SESSION['user_type'],
            'user_id'        => $_SESSION['user_id'] ?? null,
            'role'           => $_SESSION['role'] ?? null,
            'full_name'      => $_SESSION['full_name'] ?? null,
            'employee_id'    => $_SESSION['employee_id'] ?? null,
            'student_number' => $_SESSION['student_number'] ?? null
        ];
    }

    public static function requireAuth(array $allowedTypes = ['admin', 'student']): array
    {
        self::startSession();
        if (empty($_SESSION['user_type'])) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['status' => 'error', 'message' => 'Authentication required. Please sign in.']);
            exit;
        }
        if (!in_array($_SESSION['user_type'], $allowedTypes, true)) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['status' => 'error', 'message' => 'Access denied for this account type.']);
            exit;
        }
        return self::currentSession();
    }

    public static function requireAdmin(array $allowedRoles = [
        'Head Librarian',
        'Library Staff',
        'Library Admin',
        'Admin',
        'Circulation Desk Officer',
        'Cataloger',
        'System Administrator'
    ]): void
    {
        self::startSession();
        if (empty($_SESSION['user_type']) || $_SESSION['user_type'] !== 'admin') {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['status' => 'error', 'message' => 'Admin authentication required. Please sign in at Admin Portal.']);
            exit;
        }
        $role = $_SESSION['role'] ?? 'Library Staff';
        if (!in_array($role, $allowedRoles, true)) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['status' => 'error', 'message' => "Permission denied for role '{$role}'."]);
            exit;
        }
    }

    public static function requireHeadLibrarian(): void
    {
        self::requireAdmin(['Head Librarian', 'Library Admin', 'Admin', 'System Administrator']);
    }

    public static function enforceRoleIfAuthenticated(array $allowedRoles = ['Head Librarian', 'Library Admin', 'Admin']): void
    {
        self::startSession();
        if (empty($_SESSION['user_type'])) {
            return;
        }
        if ($_SESSION['user_type'] !== 'admin' || !in_array($_SESSION['role'] ?? '', $allowedRoles, true)) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
            $role = $_SESSION['role'] ?? $_SESSION['user_type'];
            echo json_encode(['status' => 'error', 'message' => "Permission denied for role '{$role}'. Head Librarian access required."]);
            exit;
        }
    }
}
?>
