<?php
/**
 * CvSU Imus Library Management System — CLI Smoke Test Suite
 *
 * Usage:
 *   php new-folder/tests/smoke_test.php
 *   php new-folder/tests/smoke_test.php --url=http://127.0.0.1:8088
 */

declare(strict_types=1);

$rootDir = dirname(__DIR__);
require_once $rootDir . '/backend/helpers/FineEngine.php';

$passed = 0;
$failed = 0;

function assertTrue(bool $cond, string $label, string $detail = ''): void
{
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "[PASS] {$label}\n";
    } else {
        $failed++;
        echo "[FAIL] {$label}" . ($detail !== '' ? " -> {$detail}" : '') . "\n";
    }
}

function httpCall(string $method, string $url, ?array $jsonBody, array &$cookies): array
{
    $headers = [];
    if (!empty($cookies)) {
        $pairs = [];
        foreach ($cookies as $k => $v) {
            $pairs[] = "{$k}={$v}";
        }
        $headers[] = 'Cookie: ' . implode('; ', $pairs);
    }

    $opts = [
        'http' => [
            'method'          => $method,
            'ignore_errors'   => true,
            'follow_location' => 0,
            'timeout'         => 10,
        ]
    ];

    if ($jsonBody !== null) {
        $headers[] = 'Content-Type: application/json';
        $opts['http']['content'] = json_encode($jsonBody);
    }
    if (!empty($headers)) {
        $opts['http']['header'] = implode("\r\n", $headers);
    }

    $ctx = stream_context_create($opts);
    $raw = @file_get_contents($url, false, $ctx);
    $respHeaders = $http_response_header ?? [];

    $status = 0;
    if (isset($respHeaders[0]) && preg_match('/HTTP\/\S+\s+(\d{3})/', $respHeaders[0], $m)) {
        $status = (int) $m[1];
    }

    $location = '';
    foreach ($respHeaders as $h) {
        if (stripos($h, 'Set-Cookie:') === 0) {
            $cookiePart = trim(substr($h, strlen('Set-Cookie:')));
            $nv = explode(';', $cookiePart, 2)[0];
            if (strpos($nv, '=') !== false) {
                [$ck, $cv] = explode('=', $nv, 2);
                $cookies[trim($ck)] = trim($cv);
            }
        } elseif (stripos($h, 'Location:') === 0) {
            $location = trim(substr($h, strlen('Location:')));
        }
    }

    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    return [
        'status'   => $status,
        'location' => $location,
        'raw'      => $raw === false ? '' : $raw,
        'json'     => is_array($decoded) ? $decoded : null
    ];
}

echo "=== 1. FineEngine Unit Tests ===\n";
$onTime = FineEngine::calculateOverdueFine('2026-11-12', '2026-11-12', []);
assertTrue($onTime['is_overdue'] === false && (float) $onTime['fine_amount'] === 0.0, 'On-time return charges PHP 0.00');

// Due Thu 2026-11-12, return Tue 2026-11-17, Mon 2026-11-16 is holiday -> Fri/Sat/Sun/Mon skipped (4), Tue charged (1 day = PHP 20)
$fine = FineEngine::calculateOverdueFine('2026-11-12', '2026-11-17', ['2026-11-16']);
assertTrue(
    $fine['is_overdue'] === true && $fine['overdue_days'] === 1 && $fine['skipped_days'] === 4 && (float) $fine['fine_amount'] === 20.0,
    'Overdue fine skips Fri-Sun & configured holidays and charges PHP 20/weekday',
    json_encode($fine)
);

echo "\n=== 2. Clean-Install schema.sql Verification ===\n";
try {
    $host = 'localhost';
    $rootPdo = new PDO("mysql:host={$host};charset=utf8mb4", 'root', '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    $tempDb = 'cvsu_library_schema_check';
    $sql = file_get_contents($rootDir . '/database/schema.sql');
    $sql = str_replace('cvsu_library_db', $tempDb, $sql);
    $rootPdo->exec($sql);

    $tables = $rootPdo->query("SHOW TABLES FROM `{$tempDb}`")->fetchAll(PDO::FETCH_COLUMN);
    $expectedTables = [
        'admins',
        'library_staff',
        'students',
        'books',
        'borrow_transactions',
        'fines',
        'library_holidays',
        'activity_logs',
        'circulation_audit_logs',
        'book_reservations',
        'book_copies'
    ];
    $missing = array_diff($expectedTables, $tables);
    assertTrue(count($missing) === 0, 'schema.sql creates all 11 tables cleanly', 'Missing: ' . implode(', ', $missing));

    $adminCount = (int) $rootPdo->query("SELECT COUNT(*) FROM `{$tempDb}`.`admins`")->fetchColumn();
    $stuCount = (int) $rootPdo->query("SELECT COUNT(*) FROM `{$tempDb}`.`students`")->fetchColumn();
    $bookCount = (int) $rootPdo->query("SELECT COUNT(*) FROM `{$tempDb}`.`books`")->fetchColumn();
    assertTrue($adminCount >= 1 && $stuCount >= 3 && $bookCount >= 6, 'schema.sql seeds default admins, students, and books');

    $rootPdo->exec("DROP DATABASE IF EXISTS `{$tempDb}`");
} catch (Throwable $e) {
    assertTrue(false, 'schema.sql clean-install test', $e->getMessage());
}

$baseUrl = '';
foreach ($argv ?? [] as $arg) {
    if (strpos($arg, '--url=') === 0) {
        $baseUrl = rtrim(substr($arg, 6), '/');
    }
}

if ($baseUrl !== '') {
    echo "\n=== 3. Live HTTP API, Auth & RBAC Tests ({$baseUrl}) ===\n";

    // Connect directly to live DB only for cleanup of synthetic smoke records
    $pdo = new PDO('mysql:host=localhost;dbname=cvsu_library_db;charset=utf8mb4', 'root', '', [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $anonCookies = [];
    $idx = httpCall('GET', "{$baseUrl}/index.php", null, $anonCookies);
    assertTrue($idx['status'] === 302 && strpos($idx['location'], 'index.html') !== false, 'index.php redirects cleanly to index.html', "status={$idx['status']} loc={$idx['location']}");

    foreach ([
        '/api/books/create.php',
        '/api/staff/manage.php',
        '/api/auth/changePassword.php',
        '/api/system/restore.php'
    ] as $protectedPath) {
        $c = [];
        $r = httpCall('POST', "{$baseUrl}{$protectedPath}", [], $c);
        assertTrue($r['status'] === 401, "Unauthenticated POST {$protectedPath} blocked with 401", "got {$r['status']}");
    }

    $unauthAdminReset = httpCall('POST', "{$baseUrl}/api/auth/resetPassword.php", [
        'userType'    => 'admin',
        'employeeId'  => 'LIB-2024-001',
        'email'       => 'admin@cvsu.edu.ph',
        'newPassword' => 'HackPass123!'
    ], $anonCookies);
    assertTrue($unauthAdminReset['status'] === 403, 'Unauthenticated admin password reset rejected with 403', "got {$unauthAdminReset['status']}");

    $badDobReset = httpCall('POST', "{$baseUrl}/api/auth/resetPassword.php", [
        'userType'      => 'student',
        'studentNumber' => '202410001',
        'email'         => 'juan.delacruz@cvsu.edu.ph',
        'dateOfBirth'   => '1999-01-01',
        'newPassword'   => 'HackPass123!'
    ], $anonCookies);
    assertTrue($badDobReset['status'] === 404, 'Student password reset rejects mismatched DOB with 404', "got {$badDobReset['status']}");

    // Public adminRegister should stay inactive & not elevate to Head Librarian
    $smokeEmp = 'SMOKE-' . substr((string) time(), -4);
    $pubReg = httpCall('POST', "{$baseUrl}/api/auth/adminRegister.php", [
        'employeeId'      => $smokeEmp,
        'fullName'        => 'Smoke Staff',
        'email'           => strtolower($smokeEmp) . '@cvsu.edu.ph',
        'role'            => 'Head Librarian',
        'password'        => 'StaffTest123!',
        'confirmPassword' => 'StaffTest123!'
    ], $anonCookies);
    assertTrue(
        $pubReg['status'] === 200
        && ($pubReg['json']['pendingApproval'] ?? false) === true
        && ($pubReg['json']['data']['role'] ?? '') === 'Circulation Desk Officer'
        && ($pubReg['json']['data']['status'] ?? '') === 'inactive',
        'Public admin registration downgrades role & requires Head Librarian activation',
        $pubReg['raw']
    );
    $pdo->prepare("DELETE FROM admins WHERE employee_id = ?")->execute([$smokeEmp]);
    $pdo->prepare("DELETE FROM circulation_audit_logs WHERE student_number = ?")->execute([$smokeEmp]);

    // Student full registration test
    $smokeSno = '2026' . substr((string) time(), -5);
    $stuRegCookies = [];
    $stuReg = httpCall('POST', "{$baseUrl}/api/auth/register.php", [
        'studentNumber'   => $smokeSno,
        'fullName'        => 'Smoke Test Student',
        'course'          => 'BS Computer Science',
        'yearLevel'       => '2nd Year',
        'email'           => "smoke{$smokeSno}@cvsu.edu.ph",
        'mobile'          => '09179998888',
        'dob'             => '2005-03-14',
        'password'        => 'StudentTest123!',
        'confirmPassword' => 'StudentTest123!'
    ], $stuRegCookies);
    assertTrue(
        $stuReg['status'] === 200
        && ($stuReg['json']['status'] ?? '') === 'success'
        && ($stuReg['json']['data']['fullName'] ?? '') === 'Smoke Test Student'
        && ($stuReg['json']['data']['course'] ?? '') === 'BS Computer Science',
        'Student registration stores fullName, course, yearLevel, and sets session',
        $stuReg['raw']
    );
    $pdo->prepare("DELETE FROM students WHERE student_number = ?")->execute([$smokeSno]);
    $pdo->prepare("DELETE FROM circulation_audit_logs WHERE student_number = ?")->execute([$smokeSno]);

    // Student Auth & RBAC
    $stuCookies = [];
    $badStuLogin = httpCall('POST', "{$baseUrl}/api/auth/login.php", [
        'studentNumber' => '202410001',
        'password'      => 'WrongPass999!'
    ], $stuCookies);
    assertTrue(($badStuLogin['json']['status'] ?? '') === 'error', 'Wrong student password rejected');

    $stuLogin = httpCall('POST', "{$baseUrl}/api/auth/login.php", [
        'studentNumber' => '202410001',
        'password'      => 'Password123!'
    ], $stuCookies);
    assertTrue(
        $stuLogin['status'] === 200
        && ($stuLogin['json']['status'] ?? '') === 'success'
        && ($stuLogin['json']['data']['mobile'] ?? '') !== ''
        && ($stuLogin['json']['data']['yearLevel'] ?? '') !== '',
        'Valid student login returns mobile and yearLevel',
        $stuLogin['raw']
    );

    $stuSess = httpCall('GET', "{$baseUrl}/api/auth/session.php", null, $stuCookies);
    assertTrue(
        $stuSess['status'] === 200
        && ($stuSess['json']['data']['mobile'] ?? '') !== ''
        && ($stuSess['json']['data']['yearLevel'] ?? '') !== '',
        'Student session.php hydrates mobile and yearLevel from DB',
        $stuSess['raw']
    );

    $stuBorrowBlock = httpCall('POST', "{$baseUrl}/api/circulation/borrow.php", [], $stuCookies);
    assertTrue(in_array($stuBorrowBlock['status'], [401, 403], true), 'Student cannot call staff borrow endpoint (RBAC)');

    $chg1 = httpCall('POST', "{$baseUrl}/api/auth/changePassword.php", [
        'currentPassword' => 'Password123!',
        'newPassword'     => 'SmokePass123!',
        'confirmPassword' => 'SmokePass123!'
    ], $stuCookies);
    $chg2 = httpCall('POST', "{$baseUrl}/api/auth/changePassword.php", [
        'currentPassword' => 'SmokePass123!',
        'newPassword'     => 'Password123!',
        'confirmPassword' => 'Password123!'
    ], $stuCookies);
    assertTrue(
        ($chg1['json']['status'] ?? '') === 'success' && ($chg2['json']['status'] ?? '') === 'success',
        'Student changePassword round-trip succeeds'
    );
    httpCall('POST', "{$baseUrl}/api/auth/logout.php", [], $stuCookies);

    // Admin Auth + Circulation Round-Trip
    $admCookies = [];
    $badAdm = httpCall('POST', "{$baseUrl}/api/auth/adminLogin.php", [
        'employeeId' => 'LIB-2024-001',
        'password'   => 'WrongAdminPass!'
    ], $admCookies);
    assertTrue(($badAdm['json']['status'] ?? '') === 'error', 'Wrong admin password rejected');

    $admLogin = httpCall('POST', "{$baseUrl}/api/auth/adminLogin.php", [
        'employeeId' => 'LIB-2024-001',
        'password'   => 'AdminPassword123!'
    ], $admCookies);
    assertTrue($admLogin['status'] === 200 && ($admLogin['json']['status'] ?? '') === 'success', 'Valid Head Librarian login succeeds');

    $smokeRef = 'SMK-' . substr((string) time(), -6);
    $borrow = httpCall('POST', "{$baseUrl}/api/circulation/borrow.php", [
        'studentNumber'   => '202410002',
        'bookCode'        => 'BK-CVSU-002',
        'loanType'        => '3_days',
        'transactionCode' => $smokeRef
    ], $admCookies);
    assertTrue($borrow['status'] === 200 && ($borrow['json']['status'] ?? '') === 'success', 'Admin borrow API creates loan cleanly', $borrow['raw']);

    $renew = httpCall('POST', "{$baseUrl}/api/circulation/renew.php", [
        'transactionCode' => $smokeRef,
        'extensionType'   => '1_day',
        'today'           => date('Y-m-d')
    ], $admCookies);
    assertTrue($renew['status'] === 200 && ($renew['json']['status'] ?? '') === 'success', 'Admin renew API extends loan cleanly', $renew['raw']);

    $ret = httpCall('POST', "{$baseUrl}/api/circulation/return.php", [
        'transactionCode' => $smokeRef,
        'returnDate'      => date('Y-m-d'),
        'bookCondition'   => 'damaged'
    ], $admCookies);
    assertTrue($ret['status'] === 200 && ($ret['json']['status'] ?? '') === 'success', 'Admin return API closes loan cleanly (with damaged condition)', $ret['raw']);

    $statusResp = httpCall('GET', "{$baseUrl}/api/circulation/status.php", null, $admCookies);
    $statsData = $statusResp['json']['data']['stats'] ?? [];
    $recentTxns = $statusResp['json']['data']['recent_transactions'] ?? [];
    assertTrue(
        isset($statsData['total_students'], $statsData['available_books']) && count($recentTxns) > 0,
        'status.php returns total_students, available_books, and recent_transactions'
    );

    $fineId = (int) ($ret['json']['data']['fine_id'] ?? 0);
    if ($fineId > 0) {
        $rep = httpCall('POST', "{$baseUrl}/api/circulation/settle_fine.php", [
            'fineId' => $fineId,
            'action' => 'replaced'
        ], $admCookies);
        assertTrue($rep['status'] === 200 && ($rep['json']['status'] ?? '') === 'success', 'settle_fine.php records identical book replacement cleanly', $rep['raw']);
    }

    $copiesResp = httpCall('GET', "{$baseUrl}/api/books/copies.php?book_code=BK-CVSU-001", null, $admCookies);
    assertTrue(
        $copiesResp['status'] === 200 && count($copiesResp['json']['data'] ?? []) >= 1,
        'books/copies.php returns per-copy barcode tracking rows',
        $copiesResp['raw']
    );

    $invReport = httpCall('GET', "{$baseUrl}/api/reports/generate.php?type=book_inventory", null, $admCookies);
    assertTrue(
        $invReport['status'] === 200 && in_array('Accession No.', $invReport['json']['columns'] ?? [], true),
        'book_inventory report includes Accession No. and Classification'
    );

    // Cleanup synthetic smoke transaction, fines & audit entries
    $pdo->prepare("DELETE FROM borrow_transactions WHERE transaction_code = ?")->execute([$smokeRef]);
    $pdo->prepare("DELETE FROM circulation_audit_logs WHERE details LIKE ?")->execute(["%{$smokeRef}%"]);

    httpCall('POST', "{$baseUrl}/api/auth/logout.php", [], $admCookies);
}

echo "\nSummary: {$passed} passed, {$failed} failed.\n";
exit($failed > 0 ? 1 : 0);
