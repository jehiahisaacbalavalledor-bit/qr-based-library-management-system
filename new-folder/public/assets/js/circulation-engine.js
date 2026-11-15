/**
 * Cavite State University - Imus Campus
 * Smart Circulation Desk & Fine Engine (Shared JS Module)
 *
 * Implements:
 * - Maximum 2 active borrowed books per student
 * - Loan duration deadlines (1_day, 2_days, 3_days, overnight due 10:00 AM)
 * - Automatic ₱20.00/day overdue penalty skipping Fri–Sun & Library Holidays
 * - Special Collections (Room Use Only) checkout protection
 */

(function (global) {
  'use strict';

  const LOANS_STORAGE_KEY = 'cvsu_circulation_active_loans';
  const FINES_STORAGE_KEY = 'cvsu_circulation_fines_ledger';
  const HOLIDAYS_STORAGE_KEY = 'cvsu_library_holidays';

  const MAX_ACTIVE_BOOKS = 2;
  const FINE_RATE_PER_DAY = 20; // ₱20.00 per chargeable day

  const DEFAULT_HOLIDAYS = [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-04-09', name: 'Araw ng Kagitingan' },
    { date: '2026-05-01', name: 'Labor Day' },
    { date: '2026-06-12', name: 'Independence Day' },
    { date: '2026-08-31', name: 'National Heroes Day' },
    { date: '2026-11-15', name: 'Special Campus Holiday (Test)' },
    { date: '2026-11-30', name: 'Bonifacio Day' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2026-12-30', name: 'Rizal Day' }
  ];

  function toYmd(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseYmdLocal(ymd) {
    if (!ymd) return new Date();
    const parts = ymd.split('-').map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function addDaysYmd(ymd, days) {
    const dt = parseYmdLocal(ymd);
    dt.setDate(dt.getDate() + days);
    return toYmd(dt);
  }

  function getHolidays() {
    try {
      const saved = JSON.parse(localStorage.getItem(HOLIDAYS_STORAGE_KEY));
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch (e) {}
    localStorage.setItem(HOLIDAYS_STORAGE_KEY, JSON.stringify(DEFAULT_HOLIDAYS));
    return DEFAULT_HOLIDAYS;
  }

  /**
   * Seed realistic initial loans so Due Today, Overdue Fine Engine, and 2-Book Limit
   * can be tested immediately.
   */
  function ensureSeededLoans() {
    let loans = [];
    try {
      loans = JSON.parse(localStorage.getItem(LOANS_STORAGE_KEY));
    } catch (e) {
      loans = null;
    }

    if (!Array.isArray(loans)) {
      const today = toYmd(new Date());
      const sixDaysAgo = addDaysYmd(today, -9);
      const sixDaysAgoDue = addDaysYmd(today, -6); // Overdue by 6 calendar days (skips Fri-Sun)
      const threeDaysAgo = addDaysYmd(today, -3);

      loans = [
        {
          ref: 'BRW-2026-0001',
          studentNo: '202410001',
          studentName: 'Juan C. Dela Cruz',
          course: 'BS Information Technology',
          bookCode: 'BK-CVSU-001',
          bookTitle: 'Clean Code: A Handbook of Agile Software Craftsmanship',
          callNo: 'QA 76.6 .C67',
          loanType: '3_days',
          borrowDate: threeDaysAgo,
          dueDate: today, // Due Today!
          dueTime: '17:00',
          status: 'borrowed',
          bookCondition: 'good',
          actualReturnDate: null
        },
        {
          ref: 'BRW-2026-0002',
          studentNo: '202410002',
          studentName: 'Maria Clara De Los Reyes',
          course: 'BS Computer Science',
          bookCode: 'BK-CVSU-003',
          bookTitle: 'Database System Concepts (7th Edition)',
          callNo: 'QA 76.9 .D3 S54',
          loanType: '3_days',
          borrowDate: sixDaysAgo,
          dueDate: sixDaysAgoDue, // Overdue!
          dueTime: '17:00',
          status: 'borrowed',
          bookCondition: 'good',
          actualReturnDate: null
        }
      ];
      localStorage.setItem(LOANS_STORAGE_KEY, JSON.stringify(loans));
    }
    return loans;
  }

  function getLoans() {
    return ensureSeededLoans();
  }

  function saveLoans(loans) {
    localStorage.setItem(LOANS_STORAGE_KEY, JSON.stringify(loans));
  }

  function getFines() {
    try {
      const fines = JSON.parse(localStorage.getItem(FINES_STORAGE_KEY));
      return Array.isArray(fines) ? fines : [];
    } catch (e) {
      return [];
    }
  }

  function saveFines(fines) {
    localStorage.setItem(FINES_STORAGE_KEY, JSON.stringify(fines));
  }

  /**
   * Compute Due Date & Time based on loanType ('1_day', '2_days', '3_days', 'overnight')
   */
  function computeDueDate(borrowDateStr, loanType) {
    const base = borrowDateStr || toYmd(new Date());
    if (loanType === '1_day') {
      return { dueDate: addDaysYmd(base, 1), dueTime: '17:00', label: '1-Day Loan' };
    }
    if (loanType === '2_days') {
      return { dueDate: addDaysYmd(base, 2), dueTime: '17:00', label: '2-Day Loan' };
    }
    if (loanType === 'overnight') {
      return { dueDate: addDaysYmd(base, 1), dueTime: '10:00 AM', label: 'Overnight (Due 10:00 AM)' };
    }
    return { dueDate: addDaysYmd(base, 3), dueTime: '17:00', label: '3-Day Loan' };
  }

  /**
   * Calculate overdue penalty skipping Fridays (5), Saturdays (6), Sundays (0), and Holidays.
   * Rate: ₱20.00 per chargeable day (Mon–Thu non-holiday).
   */
  function calculateOverdueFine(dueDateStr, returnDateStr, customHolidays) {
    const due = parseYmdLocal(dueDateStr);
    const ret = parseYmdLocal(returnDateStr || toYmd(new Date()));

    if (ret <= due) {
      return {
        isOverdue: false,
        calendarDays: 0,
        overdueDays: 0,
        skippedDays: 0,
        fineRate: FINE_RATE_PER_DAY,
        fineAmount: 0,
        chargeableDates: [],
        skippedDates: []
      };
    }

    const holidaysList = customHolidays || getHolidays();
    const holidayMap = {};
    holidaysList.forEach(h => {
      const d = typeof h === 'string' ? h : h.date;
      const n = typeof h === 'string' ? 'Library Holiday' : h.name;
      holidayMap[d] = n;
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const cursor = new Date(due.getTime());
    cursor.setDate(cursor.getDate() + 1);

    let calendarDays = 0;
    let chargeableDays = 0;
    let skippedDays = 0;
    const chargeableDates = [];
    const skippedDates = [];

    while (cursor <= ret) {
      calendarDays++;
      const ymd = toYmd(cursor);
      const dow = cursor.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

      if (dow === 5 || dow === 6 || dow === 0) {
        skippedDays++;
        skippedDates.push({ date: ymd, reason: `${dayNames[dow]} (Fri–Sun Exempt)` });
      } else if (holidayMap[ymd]) {
        skippedDays++;
        skippedDates.push({ date: ymd, reason: `Holiday: ${holidayMap[ymd]}` });
      } else {
        chargeableDays++;
        chargeableDates.push(ymd);
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      isOverdue: calendarDays > 0,
      calendarDays,
      overdueDays: chargeableDays,
      skippedDays,
      fineRate: FINE_RATE_PER_DAY,
      fineAmount: chargeableDays * FINE_RATE_PER_DAY,
      chargeableDates,
      skippedDates
    };
  }

  function getActiveLoansForStudent(studentNo) {
    const loans = getLoans();
    return loans.filter(l => l.studentNo === studentNo && (l.status === 'borrowed' || l.status === 'overdue'));
  }

  function getUnpaidFinesForStudent(studentNo) {
    const fines = getFines();
    return fines.filter(f => f.studentNo === studentNo && f.paymentStatus === 'unpaid');
  }

  /**
   * Attempt to checkout / borrow a book.
   * Enforces:
   * 1. Room-Use-Only protection
   * 2. Maximum 2 active books per student
   * 3. Unpaid fines block
   */
  function checkoutBook(payload) {
    if (payload.isRoomUseOnly) {
      return {
        ok: false,
        code: 'room_use_only',
        message: `Room Use Only: "${payload.bookTitle}" is a Special Collection item and cannot be taken outside the library.`
      };
    }

    const activeLoans = getActiveLoansForStudent(payload.studentNo);
    if (activeLoans.length >= MAX_ACTIVE_BOOKS) {
      return {
        ok: false,
        code: 'limit_reached',
        activeCount: activeLoans.length,
        maxLimit: MAX_ACTIVE_BOOKS,
        message: `2-Book Limit Reached: ${payload.studentName} (${payload.studentNo}) already has ${activeLoans.length} active borrowed books.`
      };
    }

    const unpaidFines = getUnpaidFinesForStudent(payload.studentNo);
    const unpaidSum = unpaidFines.reduce((sum, f) => sum + Number(f.fineAmount || 0), 0);
    if (unpaidSum > 0) {
      return {
        ok: false,
        code: 'unpaid_fines',
        unpaidTotal: unpaidSum,
        message: `Checkout Blocked: ${payload.studentName} has ₱${unpaidSum.toFixed(2)} in unpaid overdue fines.`
      };
    }

    const borrowDate = payload.borrowDate || toYmd(new Date());
    const loanType = payload.loanType || '3_days';
    const dueInfo = payload.dueDate
      ? { dueDate: payload.dueDate, dueTime: loanType === 'overnight' ? '10:00 AM' : '17:00', label: loanType }
      : computeDueDate(borrowDate, loanType);

    const ref = payload.ref || ('BRW-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000));

    const newLoan = {
      ref,
      studentNo: payload.studentNo,
      studentName: payload.studentName || `Student ${payload.studentNo}`,
      course: payload.course || 'BS Information Technology',
      bookCode: payload.bookCode || 'BK-LIB',
      bookTitle: payload.bookTitle,
      callNo: payload.callNo || 'GEN-LIB',
      loanType,
      borrowDate,
      dueDate: dueInfo.dueDate,
      dueTime: dueInfo.dueTime,
      status: 'borrowed',
      bookCondition: 'good',
      actualReturnDate: null
    };

    const loans = getLoans();
    loans.push(newLoan);
    saveLoans(loans);

    return {
      ok: true,
      loan: newLoan,
      activeCount: activeLoans.length + 1,
      message: `Book checked out! Due on ${newLoan.dueDate} (${dueInfo.dueTime}).`
    };
  }

  /**
   * Process a book return and compute overdue fine (skipping Fri–Sun & holidays).
   */
  function returnBook(ref, returnDateStr, bookCondition) {
    const loans = getLoans();
    const idx = loans.findIndex(l => l.ref === ref);
    if (idx === -1) {
      return { ok: false, message: `Transaction ${ref} not found.` };
    }

    const loan = loans[idx];
    if (loan.status === 'returned') {
      return { ok: false, message: `Transaction ${ref} was already returned.` };
    }

    const retDate = returnDateStr || toYmd(new Date());
    const condition = bookCondition || 'good';
    const fineCalc = calculateOverdueFine(loan.dueDate, retDate);

    loan.actualReturnDate = retDate;
    loan.bookCondition = condition;
    loan.status = condition === 'lost' ? 'lost' : (condition === 'damaged' ? 'damaged' : 'returned');
    loans[idx] = loan;
    saveLoans(loans);

    let createdFine = null;
    if (fineCalc.fineAmount > 0 || condition === 'damaged' || condition === 'lost') {
      const fines = getFines();
      createdFine = {
        id: 'FINE-' + Date.now(),
        ref: loan.ref,
        studentNo: loan.studentNo,
        studentName: loan.studentName,
        bookTitle: loan.bookTitle,
        dueDate: loan.dueDate,
        returnDate: retDate,
        overdueDays: fineCalc.overdueDays,
        skippedDays: fineCalc.skippedDays,
        fineAmount: fineCalc.fineAmount,
        bookCondition: condition,
        replacementStatus: (condition === 'damaged' || condition === 'lost') ? 'pending_replacement' : 'none',
        paymentStatus: fineCalc.fineAmount > 0 ? 'unpaid' : 'paid',
        createdAt: new Date().toISOString()
      };
      fines.unshift(createdFine);
      saveFines(fines);
    }

    return {
      ok: true,
      loan,
      fineCalculation: fineCalc,
      fineRecord: createdFine,
      message: fineCalc.fineAmount > 0
        ? `Returned with ₱${fineCalc.fineAmount.toFixed(2)} overdue fine (${fineCalc.overdueDays} chargeable days; ${fineCalc.skippedDays} Fri–Sun/holiday days skipped).`
        : `Book returned on time! No overdue fine.`
    };
  }

  function settleFine(fineId, action) {
    const fines = getFines();
    const idx = fines.findIndex(f => f.id === fineId);
    if (idx === -1) return false;
    fines[idx].paymentStatus = action === 'waived' ? 'waived' : 'paid';
    fines[idx].settledAt = new Date().toISOString();
    saveFines(fines);
    return true;
  }

  function getDashboardStats() {
    const loans = getLoans();
    const fines = getFines();
    const today = toYmd(new Date());

    const active = loans.filter(l => l.status === 'borrowed' || l.status === 'overdue');
    const dueToday = active.filter(l => l.dueDate === today);
    const overdue = active.filter(l => l.dueDate < today);
    const unpaidFines = fines.filter(f => f.paymentStatus === 'unpaid');
    const unpaidTotal = unpaidFines.reduce((sum, f) => sum + Number(f.fineAmount || 0), 0);

    // Also include live projected overdue fines for currently active overdue books
    const projectedOverdueTotal = overdue.reduce((sum, l) => {
      return sum + calculateOverdueFine(l.dueDate, today).fineAmount;
    }, 0);

    return {
      activeBorrowedCount: active.length,
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      unpaidFinesTotal: unpaidTotal,
      projectedOverdueTotal,
      today
    };
  }

  global.CvsuCirculationEngine = {
    MAX_ACTIVE_BOOKS,
    FINE_RATE_PER_DAY,
    toYmd,
    getHolidays,
    getLoans,
    getFines,
    computeDueDate,
    calculateOverdueFine,
    getActiveLoansForStudent,
    getUnpaidFinesForStudent,
    checkoutBook,
    returnBook,
    settleFine,
    getDashboardStats
  };
})(window);
