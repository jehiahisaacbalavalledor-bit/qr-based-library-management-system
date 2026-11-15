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
  const CATALOG_STORAGE_KEY = 'cvsu_library_mysql_catalog';

  const SCRIPT_SRC = document.currentScript ? document.currentScript.src : '';
  const API_BASE = (SCRIPT_SRC && window.location.protocol.startsWith('http'))
    ? new URL('../../api/', SCRIPT_SRC).href
    : null;

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

  function getCatalog() {
    try {
      const saved = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY));
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch (e) {}
    return [];
  }

  /**
   * Live MySQL Sync: Fetches circulation status, active loans, fines, holidays & catalog
   */
  async function syncFromServer() {
    if (!API_BASE) return { ok: false, offline: true };
    try {
      const [statusRes, booksRes] = await Promise.all([
        fetch(`${API_BASE}circulation/status.php`, { credentials: 'same-origin' }),
        fetch(`${API_BASE}books/list.php`, { credentials: 'same-origin' })
      ]);

      const statusJson = await statusRes.json();
      const booksJson = await booksRes.json();

      if (statusJson.status === 'success' && statusJson.data) {
        const d = statusJson.data;
        if (Array.isArray(d.holidays) && d.holidays.length > 0) {
          localStorage.setItem(HOLIDAYS_STORAGE_KEY, JSON.stringify(d.holidays.map(dt => ({ date: dt, name: 'Library Holiday' }))));
        }
        if (Array.isArray(d.active_loans)) {
          const mappedLoans = d.active_loans.map(l => ({
            ref: l.transaction_code,
            studentNo: l.student_number,
            studentName: l.full_name,
            course: l.course || 'BS Information Technology',
            bookCode: l.book_code,
            bookTitle: l.title,
            callNo: l.call_number,
            loanType: l.loan_type,
            renewalCount: Number(l.renewal_count || 0),
            borrowDate: l.borrow_date,
            dueDate: l.due_date,
            dueTime: l.loan_type === 'overnight' ? '10:00 AM' : '17:00',
            status: l.return_status,
            bookCondition: l.book_condition || 'good',
            actualReturnDate: l.actual_return_date
          }));
          saveLoans(mappedLoans);
        }
        if (Array.isArray(d.fines)) {
          const mappedFines = d.fines.map(f => ({
            id: f.id,
            ref: f.transaction_code,
            studentNo: f.student_number,
            studentName: f.full_name,
            bookTitle: f.book_title,
            overdueDays: Number(f.overdue_days || 0),
            skippedDays: 0,
            fineAmount: Number(f.fine_amount || 0),
            bookCondition: f.book_condition || 'good',
            replacementStatus: f.replacement_status || 'none',
            paymentStatus: f.payment_status || 'unpaid',
            createdAt: f.created_at
          }));
          saveFines(mappedFines);
        }
      }

      if (booksJson.status === 'success' && Array.isArray(booksJson.data)) {
        localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(booksJson.data));
      }

      return {
        ok: true,
        stats: statusJson.data ? statusJson.data.stats : null,
        catalog: booksJson.data || []
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function borrowRemote(payload) {
    if (!API_BASE) return checkoutBook(payload);
    try {
      const res = await fetch(`${API_BASE}circulation/borrow.php`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentNumber: payload.studentNo,
          bookCode: payload.bookCode,
          bookTitle: payload.bookTitle,
          loanType: payload.loanType || '3_days',
          transactionCode: payload.ref
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        await syncFromServer();
        return { ok: true, message: json.message, data: json.data };
      }
      return { ok: false, code: json.code, message: json.message };
    } catch (err) {
      return checkoutBook(payload);
    }
  }

  function renewBook(ref, extensionType = '1_day', todayStr = getTodayISO()) {
    const loans = getLoans();
    const idx = loans.findIndex(l => l.ref === ref);
    if (idx === -1) return { ok: false, message: `Transaction ${ref} not found.` };

    const loan = loans[idx];
    if (loan.status !== 'borrowed' && loan.status !== 'overdue') {
      return { ok: false, message: `Transaction ${ref} is already closed (${loan.status}).` };
    }
    if (Number(loan.renewalCount || 0) >= 2) {
      return { ok: false, message: `Maximum of 2 renewals already reached for ${ref}.` };
    }
    if (getUnpaidFinesForStudent(loan.studentNo).length > 0) {
      return { ok: false, message: `Cannot renew: ${loan.studentName} has unpaid fines.` };
    }
    if (loan.dueDate < todayStr) {
      return { ok: false, message: `Cannot renew overdue loan ${ref}. Process return/fine settlement first.` };
    }

    const baseDate = loan.dueDate >= todayStr ? loan.dueDate : todayStr;
    const dueInfo = computeDueDate(baseDate, extensionType);
    loan.dueDate = dueInfo.dueDate;
    loan.dueTime = dueInfo.dueTime;
    loan.loanType = extensionType;
    loan.renewalCount = Number(loan.renewalCount || 0) + 1;
    saveLoans(loans);

    return {
      ok: true,
      message: `Loan ${ref} extended to ${loan.dueDate} (${dueInfo.label}).`,
      loan
    };
  }

  async function renewRemote(transactionCode, extensionType = '1_day', today = getTodayISO()) {
    if (!API_BASE) return renewBook(transactionCode, extensionType, today);
    try {
      const res = await fetch(`${API_BASE}circulation/renew.php`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionCode, extensionType, today })
      });
      const json = await res.json();
      if (json.status === 'success') {
        await syncFromServer();
        return {
          ok: true,
          message: json.message,
          loan: json.data
        };
      }
      return { ok: false, message: json.message || 'Renewal failed.' };
    } catch (err) {
      return renewBook(transactionCode, extensionType, today);
    }
  }

  async function returnRemote(transactionCode, returnDate, bookCondition) {
    if (!API_BASE) return returnBook(transactionCode, returnDate, bookCondition);
    try {
      const res = await fetch(`${API_BASE}circulation/return.php`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionCode, returnDate, bookCondition })
      });
      const json = await res.json();
      if (json.status === 'success') {
        await syncFromServer();
        return {
          ok: true,
          message: json.message,
          loan: json.data,
          fineCalculation: json.data.fine_calculation
        };
      }
      return { ok: false, message: json.message };
    } catch (err) {
      return returnBook(transactionCode, returnDate, bookCondition);
    }
  }

  async function settleFineRemote(fineId, action) {
    if (!API_BASE) return settleFine(fineId, action);
    try {
      const res = await fetch(`${API_BASE}circulation/settle_fine.php`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fineId, action })
      });
      const json = await res.json();
      if (json.status === 'success') {
        await syncFromServer();
        return true;
      }
      return false;
    } catch (err) {
      return settleFine(fineId, action);
    }
  }

  async function addBookRemote(bookData) {
    if (!API_BASE) return { ok: false, offline: true };
    const res = await fetch(`${API_BASE}books/create.php`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookData)
    });
    const json = await res.json();
    if (json.status === 'success') {
      await syncFromServer();
      return { ok: true, message: json.message, data: json.data };
    }
    return { ok: false, message: json.message };
  }

  async function updateBookRemote(bookData) {
    if (!API_BASE) return { ok: false, offline: true };
    const res = await fetch(`${API_BASE}books/update.php`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookData)
    });
    const json = await res.json();
    if (json.status === 'success') {
      await syncFromServer();
      return { ok: true, message: json.message, data: json.data };
    }
    return { ok: false, message: json.message || 'Could not update book.' };
  }

  async function deleteBookRemote(identifier) {
    if (!API_BASE) return { ok: false, offline: true };
    const payload = typeof identifier === 'number' ? { id: identifier } : { bookCode: identifier };
    const res = await fetch(`${API_BASE}books/delete.php`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.status === 'success') {
      await syncFromServer();
      return { ok: true, message: json.message };
    }
    return { ok: false, message: json.message || 'Could not delete book.' };
  }

  async function listStudentsRemote() {
    if (!API_BASE) return { ok: false, offline: true, data: [] };
    try {
      const res = await fetch(`${API_BASE}students/list.php`, { credentials: 'same-origin' });
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        return { ok: true, data: json.data };
      }
      return { ok: false, message: json.message || 'Failed to load students.', data: [] };
    } catch (err) {
      return { ok: false, message: err.message, data: [] };
    }
  }

  async function updateStudentRemote(studentData) {
    if (!API_BASE) return { ok: false, offline: true };
    const res = await fetch(`${API_BASE}students/update.php`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    });
    const json = await res.json();
    if (json.status === 'success') {
      return { ok: true, message: json.message, data: json.data };
    }
    return { ok: false, message: json.message || 'Could not update student.' };
  }

  async function deleteStudentRemote(identifier) {
    if (!API_BASE) return { ok: false, offline: true };
    const payload = typeof identifier === 'number' ? { id: identifier } : { studentNumber: identifier };
    const res = await fetch(`${API_BASE}students/delete.php`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.status === 'success') {
      return { ok: true, message: json.message };
    }
    return { ok: false, message: json.message || 'Could not delete student.' };
  }

  global.CvsuCirculationEngine = {
    MAX_ACTIVE_BOOKS,
    FINE_RATE_PER_DAY,
    API_BASE,
    toYmd,
    getHolidays,
    getLoans,
    getFines,
    getCatalog,
    computeDueDate,
    calculateOverdueFine,
    getActiveLoansForStudent,
    getUnpaidFinesForStudent,
    checkoutBook,
    renewBook,
    returnBook,
    settleFine,
    getDashboardStats,
    syncFromServer,
    borrowRemote,
    renewRemote,
    returnRemote,
    settleFineRemote,
    addBookRemote,
    updateBookRemote,
    deleteBookRemote,
    listStudentsRemote,
    updateStudentRemote,
    deleteStudentRemote
  };
})(window);
