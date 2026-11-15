<?php
/**
 * Cavite State University - Imus Campus
 * Smart Circulation Desk & Fine Engine
 *
 * Implements CvSU Library Policy:
 * - Maximum 2 active books per student
 * - Loan durations: 1_day, 2_days, 3_days, overnight (due 10:00 AM next day)
 * - Overdue Penalty: ₱20.00 per chargeable day
 * - Skips Fridays, Saturdays, Sundays (Fri-Sun), and official Library Holidays
 */

class FineEngine
{
    public const MAX_ACTIVE_BOOKS = 2;
    public const FINE_RATE_PER_DAY = 20.00;

    /**
     * Fetch active holiday dates (YYYY-MM-DD) from the database.
     */
    public static function getHolidays(PDO $pdo): array
    {
        try {
            $stmt = $pdo->query("SELECT holiday_date FROM library_holidays");
            return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        } catch (PDOException $e) {
            return [];
        }
    }

    /**
     * Compute due date & time based on borrow date and loan duration type.
     */
    public static function computeDueDate(string $borrowDateStr, string $loanType): array
    {
        $borrowDate = new DateTime($borrowDateStr);
        $dueDate = clone $borrowDate;

        switch ($loanType) {
            case '1_day':
                $dueDate->modify('+1 day');
                $dueTime = '17:00:00';
                $label = '1-Day Loan';
                break;
            case '2_days':
                $dueDate->modify('+2 days');
                $dueTime = '17:00:00';
                $label = '2-Day Loan';
                break;
            case 'overnight':
                $dueDate->modify('+1 day');
                $dueTime = '10:00:00';
                $label = 'Overnight (Due 10:00 AM)';
                break;
            case '3_days':
            default:
                $dueDate->modify('+3 days');
                $dueTime = '17:00:00';
                $label = '3-Day Loan';
                break;
        }

        return [
            'due_date' => $dueDate->format('Y-m-d'),
            'due_time' => $dueTime,
            'label'    => $label
        ];
    }

    /**
     * Calculate overdue penalty skipping Fridays (5), Saturdays (6), Sundays (7), and Holidays.
     *
     * @param string $dueDateStr    Format: YYYY-MM-DD
     * @param string $returnDateStr Format: YYYY-MM-DD (or current date)
     * @param array  $holidays      List of YYYY-MM-DD holiday strings
     * @return array
     */
    public static function calculateOverdueFine(string $dueDateStr, string $returnDateStr, array $holidays = []): array
    {
        $due = new DateTime($dueDateStr);
        $due->setTime(0, 0, 0);

        $ret = new DateTime($returnDateStr);
        $ret->setTime(0, 0, 0);

        if ($ret <= $due) {
            return [
                'is_overdue'       => false,
                'calendar_days'    => 0,
                'overdue_days'     => 0,
                'skipped_days'     => 0,
                'fine_rate'        => self::FINE_RATE_PER_DAY,
                'fine_amount'      => 0.00,
                'chargeable_dates' => [],
                'skipped_dates'    => []
            ];
        }

        $holidaySet = array_flip($holidays);
        $cursor = clone $due;
        $cursor->modify('+1 day');

        $calendarDays = 0;
        $chargeableDays = 0;
        $skippedDays = 0;
        $chargeableDates = [];
        $skippedDates = [];

        while ($cursor <= $ret) {
            $calendarDays++;
            $dateStr = $cursor->format('Y-m-d');
            $dayOfWeek = (int) $cursor->format('N'); // 1 (Mon) .. 5 (Fri), 6 (Sat), 7 (Sun)

            if ($dayOfWeek >= 5) {
                $skippedDays++;
                $skippedDates[] = [
                    'date'   => $dateStr,
                    'reason' => $cursor->format('l') . ' (Fri-Sun Exempt)'
                ];
            } elseif (isset($holidaySet[$dateStr])) {
                $skippedDays++;
                $skippedDates[] = [
                    'date'   => $dateStr,
                    'reason' => 'Library Holiday'
                ];
            } else {
                $chargeableDays++;
                $chargeableDates[] = $dateStr;
            }

            $cursor->modify('+1 day');
        }

        return [
            'is_overdue'       => $calendarDays > 0,
            'calendar_days'    => $calendarDays,
            'overdue_days'     => $chargeableDays,
            'skipped_days'     => $skippedDays,
            'fine_rate'        => self::FINE_RATE_PER_DAY,
            'fine_amount'      => round($chargeableDays * self::FINE_RATE_PER_DAY, 2),
            'chargeable_dates' => $chargeableDates,
            'skipped_dates'    => $skippedDates
        ];
    }
}
?>
