/**
 * Cavite State University - Imus Campus
 * Library Management System - Dashboard Controller
 * Handles Statistics, Dual QR Generation, Due Today Alerts, Theme Toggling & Navigation
 */

(function () {
  'use strict';

  const SESSION_USER_KEY = 'cvsu_library_current_user';
  const LATEST_BORROW_PASS_KEY = 'cvsu_latest_borrow_pass';
  const THEME_STORAGE_KEY = 'cvsu_library_theme';
  const STATS_STORAGE_KEY = 'cvsu_library_system_stats';

  // Helper: Toast notification
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `${iconSvg} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // Get active session user or fallback
  function getActiveUser() {
    let sessionUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (sessionUser) {
      try {
        return JSON.parse(sessionUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // 1. Initialize Active User Data
    let currentUser = getActiveUser();
    if (!currentUser) {
      currentUser = {
        studentNumber: '202410001',
        fullName: 'Juan C. Dela Cruz',
        email: 'juan.delacruz@cvsu.edu.ph',
        mobile: '09171234567',
        dob: '2004-05-15',
        course: 'BS Information Technology',
        yearLevel: '3rd Year',
        campus: 'Imus Campus'
      };
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(currentUser));
    }

    const studentNameDisplay = currentUser.fullName || `Student ${currentUser.studentNumber}`;

    // 2. Populate UI Names & Header Info
    const topNavStudentName = document.getElementById('topNavStudentName');
    const userAvatarText = document.getElementById('userAvatarText');
    const badgeStudentNo = document.getElementById('badgeStudentNo');
    const badgeStudentName = document.getElementById('badgeStudentName');
    const badgeCourse = document.getElementById('badgeCourse');

    const profileStudentNo = document.getElementById('profileStudentNo');
    const profileFullName = document.getElementById('profileFullName');
    const profileEmail = document.getElementById('profileEmail');
    const profileMobile = document.getElementById('profileMobile');
    const profileCourse = document.getElementById('profileCourse');
    const profileYearLevel = document.getElementById('profileYearLevel');
    const profileCampus = document.getElementById('profileCampus');

    if (topNavStudentName) topNavStudentName.textContent = studentNameDisplay;
    if (userAvatarText) {
      const parts = studentNameDisplay.split(' ');
      userAvatarText.textContent = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : 'JD';
    }
    if (badgeStudentNo) badgeStudentNo.textContent = currentUser.studentNumber;
    if (badgeStudentName) badgeStudentName.textContent = studentNameDisplay;
    if (badgeCourse) badgeCourse.textContent = currentUser.course || 'BS Information Technology';

    if (profileStudentNo) profileStudentNo.textContent = currentUser.studentNumber;
    if (profileFullName) profileFullName.textContent = studentNameDisplay;
    if (profileEmail) profileEmail.textContent = currentUser.email || 'N/A';
    if (profileMobile) profileMobile.textContent = currentUser.mobile || 'N/A';
    if (profileCourse) profileCourse.textContent = currentUser.course || 'BS Information Technology';
    if (profileYearLevel) profileYearLevel.textContent = currentUser.yearLevel || '3rd Year';
    if (profileCampus) profileCampus.textContent = currentUser.campus || 'Imus Campus';

    // 3. Theme Toggle (Dark / Light Mode)
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeIcon = document.getElementById('darkModeIcon');
    const darkModeText = document.getElementById('darkModeText');

    function applyTheme(isDark) {
      if (isDark) {
        document.body.classList.add('dark-theme');
        if (darkModeIcon) darkModeIcon.textContent = '☀';
        if (darkModeText) darkModeText.textContent = 'Light Mode';
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      } else {
        document.body.classList.remove('dark-theme');
        if (darkModeIcon) darkModeIcon.textContent = '☾';
        if (darkModeText) darkModeText.textContent = 'Dark Mode';
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
      }
    }

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
      applyTheme(true);
    }

    if (darkModeToggle) {
      darkModeToggle.addEventListener('click', function () {
        const isCurrentlyDark = document.body.classList.contains('dark-theme');
        applyTheme(!isCurrentlyDark);
        showToast(`Switched to ${!isCurrentlyDark ? 'Dark' : 'Light'} Mode`, 'info');
      });
    }

    // 4. Sidebar Responsive Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const appSidebar = document.getElementById('appSidebar');
    if (sidebarToggle && appSidebar) {
      sidebarToggle.addEventListener('click', function () {
        if (window.innerWidth <= 768) {
          appSidebar.classList.toggle('mobile-open');
        } else {
          appSidebar.classList.toggle('collapsed');
        }
      });
    }

    // 5. Generate Official Student Digital QR ID Pass
    const studentQrContainer = document.getElementById('studentQrContainer');
    if (studentQrContainer && typeof QRCode !== 'undefined') {
      studentQrContainer.innerHTML = '';
      const generalPayload = JSON.stringify({
        type: 'CVSU_STUDENT_ID',
        studentNo: currentUser.studentNumber,
        name: studentNameDisplay,
        course: currentUser.course || 'BS Information Technology',
        yearLevel: currentUser.yearLevel || '3rd Year',
        campus: 'Imus Campus'
      });

      new QRCode(studentQrContainer, {
        text: generalPayload,
        width: 165,
        height: 165,
        colorDark: '#00875a',
        colorLight: '#ffffff'
      });
    }

    // 5B. Sync Student Personal Circulation Stats, Due Today Banner, Active Loans & Catalog
    function syncCirculationDashboard() {
      if (!window.CvsuCirculationEngine) return;
      const engine = window.CvsuCirculationEngine;
      const stats = engine.getDashboardStats();
      const activeForStudent = engine.getActiveLoansForStudent(currentUser.studentNumber);
      const unpaidForStudent = engine.getUnpaidFinesForStudent(currentUser.studentNumber);

      const unpaidSum = unpaidForStudent.reduce((s, f) => s + Number(f.fineAmount || 0), 0);
      const liveOverdueSum = activeForStudent.reduce((s, l) => s + engine.calculateOverdueFine(l.dueDate, stats.today).fineAmount, 0);
      const totalStudentFine = unpaidSum + liveOverdueSum;

      const studentDueTodayCount = activeForStudent.filter(l => l.dueDate === stats.today).length;
      const studentOverdueCount = activeForStudent.filter(l => l.dueDate < stats.today).length;

      // Update Student Personal Stat Cards
      const statBorrowedEl = document.getElementById('statBorrowedBooks');
      const statDueTodayEl = document.getElementById('statDueTodayBooks');
      const statOverdueEl = document.getElementById('statOverdueBooks');
      if (statBorrowedEl) statBorrowedEl.textContent = `${activeForStudent.length} / ${engine.MAX_ACTIVE_BOOKS}`;
      if (statDueTodayEl) statDueTodayEl.textContent = studentDueTodayCount;
      if (statOverdueEl) statOverdueEl.textContent = `₱${totalStudentFine.toFixed(2)}`;

      // Update Student Due Today Banner dynamically (for this student's books only)
      const dueBanner = document.getElementById('dueTodayBanner');
      if (dueBanner) {
        const headingEl = dueBanner.querySelector('h4 span:first-child');
        const descEl = dueBanner.querySelector('p');
        if (studentDueTodayCount > 0 || studentOverdueCount > 0) {
          dueBanner.style.display = '';
          if (headingEl) {
            headingEl.textContent = `My Notice: ${studentDueTodayCount} Book(s) Due Today | ${studentOverdueCount} Overdue`;
          }
          if (descEl) {
            descEl.innerHTML = totalStudentFine > 0
              ? `You have <strong>₱${totalStudentFine.toFixed(2)}</strong> in accrued/unpaid fines. Please return overdue books at the <strong>Library Circulation Desk</strong> (₱20.00/day, Fri–Sun &amp; holidays exempted).`
              : `Please return due books at the <strong>Library Circulation Desk</strong> before <strong>5:00 PM</strong> to avoid the <strong>₱20.00/day penalty</strong> (Fridays, Saturdays, Sundays, and holidays exempted).`;
          }
        } else {
          dueBanner.style.display = 'none';
        }
      }

      // Update Student 2-Book Quota Banner
      const quotaLabel = document.getElementById('studentActiveCountLabel');
      const fineLabel = document.getElementById('studentFineStatusLabel');
      const quotaBanner = document.getElementById('studentQuotaBanner');

      if (quotaLabel) {
        quotaLabel.textContent = `${activeForStudent.length} / ${engine.MAX_ACTIVE_BOOKS} Books`;
        quotaLabel.style.color = activeForStudent.length >= engine.MAX_ACTIVE_BOOKS ? '#dc2626' : '#0f172a';
      }

      if (fineLabel) {
        if (unpaidSum > 0) {
          fineLabel.textContent = `⚠ Unpaid Fine: ₱${unpaidSum.toFixed(2)}`;
          fineLabel.style.color = '#dc2626';
        } else if (liveOverdueSum > 0) {
          fineLabel.textContent = `⚠ Overdue Accrued: ₱${liveOverdueSum.toFixed(2)}`;
          fineLabel.style.color = '#d97706';
        } else {
          fineLabel.textContent = '✓ No Unpaid Fines';
          fineLabel.style.color = '#15803d';
        }
      }

      if (quotaBanner && (activeForStudent.length >= engine.MAX_ACTIVE_BOOKS || unpaidSum > 0)) {
        quotaBanner.style.background = '#fef2f2';
        quotaBanner.style.borderColor = '#fecaca';
      }

      // Render Student Active Loans List
      const loansListEl = document.getElementById('studentActiveLoansList');
      if (loansListEl) {
        if (activeForStudent.length === 0) {
          loansListEl.innerHTML = `<div style="padding: 16px; border: 1px dashed var(--border-subtle); border-radius: 10px; text-align: center; color: var(--text-secondary); font-size: 13px;">You have no active borrowed books. Present your Digital Student QR ID Pass at the Circulation Desk to borrow up to 2 books.</div>`;
        } else {
          loansListEl.innerHTML = activeForStudent.map(loan => {
            const calc = engine.calculateOverdueFine(loan.dueDate, stats.today);
            const isDueToday = loan.dueDate === stats.today;
            const badge = calc.isOverdue
              ? `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">OVERDUE (₱${calc.fineAmount.toFixed(2)})</span>`
              : (isDueToday
                ? `<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">DUE TODAY</span>`
                : `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">ACTIVE</span>`);

            return `
              <div style="border: 1px solid var(--border-subtle); border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--bg-main);">
                <div>
                  <div style="font-size: 13.5px; font-weight: 700; color: var(--text-primary);">${loan.bookTitle}</div>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                    Ref: <code>${loan.ref}</code> | Call #: <strong>${loan.callNo}</strong> | Borrowed: ${loan.borrowDate}
                  </div>
                </div>
                <div style="text-align: right;">
                  ${badge}
                  <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
                    Due: <strong>${loan.dueDate}</strong> (${loan.dueTime || '17:00'})
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    }

    syncCirculationDashboard();

    // 5C. Read-Only Student Library Catalog Lookup
    const STUDENT_CATALOG_BOOKS = [
      { code: 'BK-CVSU-001', title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', callNo: 'QA 76.6 .C67', available: 3, total: 4, roomOnly: false },
      { code: 'BK-CVSU-002', title: 'Head First Java (3rd Edition)', author: 'Kathy Sierra & Bert Bates', callNo: 'QA 76.73 .J38', available: 3, total: 3, roomOnly: false },
      { code: 'BK-CVSU-003', title: 'Database System Concepts (7th Edition)', author: 'Abraham Silberschatz, Henry F. Korth', callNo: 'QA 76.9 .D3 S54', available: 2, total: 3, roomOnly: false },
      { code: 'BK-CVSU-004', title: 'Computer Networks (5th Edition)', author: 'Andrew S. Tanenbaum', callNo: 'QA 76.58 .T36', available: 2, total: 2, roomOnly: false },
      { code: 'BK-CVSU-005', title: 'Web Design with HTML, CSS, JavaScript and jQuery', author: 'Jon Duckett', callNo: 'QA 76.76 .C672', available: 4, total: 5, roomOnly: false },
      { code: 'BK-CVSU-006', title: 'CvSU Imus Undergraduate IT Theses Compendium Vol. IV', author: 'CvSU Dept. of Computer Studies', callNo: 'FIL QA 76.2 .C8', available: 1, total: 1, roomOnly: true }
    ];

    function renderStudentCatalog(query) {
      const grid = document.getElementById('studentCatalogGrid');
      if (!grid) return;
      const engine = window.CvsuCirculationEngine;
      const liveCatalog = (engine && engine.getCatalog().length > 0)
        ? engine.getCatalog().map(b => ({
            code: b.book_code,
            title: b.title,
            author: b.author,
            callNo: b.call_number,
            available: Number(b.available_copies),
            total: Number(b.total_copies),
            roomOnly: Number(b.is_room_use_only) === 1
          }))
        : STUDENT_CATALOG_BOOKS;

      const statAvailEl = document.getElementById('statAvailableBooks');
      if (statAvailEl && engine && engine.getCatalog().length > 0) {
        const totalAvail = liveCatalog.reduce((s, b) => s + b.available, 0);
        statAvailEl.textContent = totalAvail;
      }

      const q = (query || '').trim().toLowerCase();
      const filtered = liveCatalog.filter(b =>
        !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.callNo.toLowerCase().includes(q)
      );

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 16px; color: var(--text-secondary); font-size: 13px;">No matching library books found.</div>`;
        return;
      }

      grid.innerHTML = filtered.map(b => {
        const badge = b.roomOnly
          ? `<span style="background:#fef3c7;color:#92400e;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:8px;">🔒 Room Use Only</span>`
          : (b.available > 0
            ? `<span style="background:#dcfce7;color:#166534;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:8px;">✓ ${b.available} of ${b.total} Available</span>`
            : `<span style="background:#fee2e2;color:#dc2626;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:8px;">Checked Out</span>`);

        return `
          <div class="borrow-book-option" style="cursor: default;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px;">
              <h4 style="margin:0;">${b.title}</h4>
            </div>
            <p style="margin:0 0 6px 0;">Author: ${b.author} | Call #: <strong>${b.callNo}</strong></p>
            <div>${badge}</div>
          </div>
        `;
      }).join('');
    }

    renderStudentCatalog('');

    if (window.CvsuCirculationEngine) {
      window.CvsuCirculationEngine.syncFromServer().then(res => {
        if (res && res.ok) {
          syncCirculationDashboard();
          const searchVal = document.getElementById('studentCatalogSearch')?.value || '';
          renderStudentCatalog(searchVal);
        }
      });
    }

    const catalogSearchInput = document.getElementById('studentCatalogSearch');
    if (catalogSearchInput) {
      catalogSearchInput.addEventListener('input', function () {
        renderStudentCatalog(this.value);
      });
    }

    // 6. Loan Type & Deadline Selection
    let selectedLoanDays = 3; // Default 3 days loan
    let isOvernight = false;
    const loanTypeBtns = document.querySelectorAll('.loan-type-btn');
    loanTypeBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        loanTypeBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const daysAttr = this.getAttribute('data-days');
        const typeAttr = this.getAttribute('data-type');
        if (typeAttr === 'overnight') {
          selectedLoanDays = 1;
          isOvernight = true;
          showToast('Overnight loan selected: Due tomorrow before 10:00 AM.', 'info');
        } else {
          selectedLoanDays = parseInt(daysAttr, 10);
          isOvernight = false;
          showToast(`${selectedLoanDays}-Day Loan selected (Deadline: ${selectedLoanDays} days).`, 'info');
        }
      });
    });

    // 7. Book Selection Interactivity
    let selectedBook = {
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      author: 'Robert C. Martin',
      callNo: 'QA 76.6 .C67'
    };

    const bookOptions = document.querySelectorAll('.borrow-book-option');
    bookOptions.forEach(opt => {
      opt.addEventListener('click', function () {
        bookOptions.forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        selectedBook = {
          title: this.getAttribute('data-title'),
          author: this.getAttribute('data-author'),
          callNo: this.getAttribute('data-callno')
        };
        const customInput = document.getElementById('customBookTitle');
        if (customInput) customInput.value = '';
      });
    });

    // Custom Book Input
    const customBookInput = document.getElementById('customBookTitle');
    if (customBookInput) {
      customBookInput.addEventListener('input', function () {
        if (this.value.trim().length > 0) {
          bookOptions.forEach(o => o.classList.remove('selected'));
          selectedBook = {
            title: this.value.trim(),
            author: 'Library General Collection',
            callNo: 'QA ' + Math.floor(100 + Math.random() * 900) + ' .CVSU'
          };
        }
      });
    }

    // 8. Due Today Banner Button
    const openScannerFromBannerBtn = document.getElementById('openScannerFromBannerBtn');
    if (openScannerFromBannerBtn) {
      openScannerFromBannerBtn.addEventListener('click', function () {
        window.location.href = '../../admin/pages/transactions/scanner.html';
      });
    }

    // 9. QR Borrow Slip Modal & Generation
    const borrowModal = document.getElementById('borrowModal');
    const closeBorrowModal = document.getElementById('closeBorrowModal');
    const modalQrContainer = document.getElementById('modalQrContainer');

    const slipStudentName = document.getElementById('slipStudentName');
    const slipStudentNo = document.getElementById('slipStudentNo');
    const slipCourse = document.getElementById('slipCourse');
    const slipBookTitle = document.getElementById('slipBookTitle');
    const slipCallNo = document.getElementById('slipCallNo');
    const slipDueDate = document.getElementById('slipDueDate');
    const slipLoanTypeLabel = document.getElementById('slipLoanTypeLabel');
    const slipRefCode = document.getElementById('slipRefCode');

    const generateBtn = document.getElementById('generateBorrowQrBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', function () {
        const engine = window.CvsuCirculationEngine;
        const loanTypeKey = isOvernight ? 'overnight' : `${selectedLoanDays}_days`;

        // Enforce 2-Book Limit & Unpaid Fines before generating QR Borrow Slip
        if (engine) {
          const activeLoans = engine.getActiveLoansForStudent(currentUser.studentNumber);
          if (activeLoans.length >= engine.MAX_ACTIVE_BOOKS) {
            showToast(`Borrowing Limit Reached: You already have ${activeLoans.length}/${engine.MAX_ACTIVE_BOOKS} active books. Please return a book first.`, 'error');
            return;
          }
          const unpaidFines = engine.getUnpaidFinesForStudent(currentUser.studentNumber);
          const unpaidSum = unpaidFines.reduce((s, f) => s + Number(f.fineAmount || 0), 0);
          if (unpaidSum > 0) {
            showToast(`Action Blocked: You have ₱${unpaidSum.toFixed(2)} in unpaid overdue fines. Settle fines at the circulation desk first.`, 'error');
            return;
          }
        }

        const borrowDateStr = engine ? engine.toYmd(new Date()) : new Date().toISOString().split('T')[0];
        const dueInfo = engine
          ? engine.computeDueDate(borrowDateStr, loanTypeKey)
          : {
              dueDate: new Date(Date.now() + (isOvernight ? 1 : selectedLoanDays) * 86400000).toISOString().split('T')[0],
              dueTime: isOvernight ? '10:00 AM' : '17:00',
              label: isOvernight ? 'Overnight' : `${selectedLoanDays} Days`
            };

        const dueDateStr = dueInfo.dueDate;
        const refNo = 'BRW-2026-' + Math.floor(1000 + Math.random() * 9000);

        if (slipStudentName) slipStudentName.textContent = studentNameDisplay;
        if (slipStudentNo) slipStudentNo.textContent = currentUser.studentNumber;
        if (slipCourse) slipCourse.textContent = currentUser.course || 'BS Information Technology';
        if (slipBookTitle) slipBookTitle.textContent = selectedBook.title;
        if (slipCallNo) slipCallNo.textContent = selectedBook.callNo;
        if (slipDueDate) slipDueDate.textContent = `${dueDateStr} (${dueInfo.dueTime})`;
        if (slipLoanTypeLabel) slipLoanTypeLabel.textContent = dueInfo.label;
        if (slipRefCode) slipRefCode.textContent = `REF: ${refNo}`;

        // Build Payload containing student and book information
        const borrowPayload = {
          type: 'CVSU_BORROW',
          studentNo: currentUser.studentNumber,
          name: studentNameDisplay,
          course: currentUser.course || 'BS Information Technology',
          email: currentUser.email || `${currentUser.studentNumber}@cvsu.edu.ph`,
          mobile: currentUser.mobile || '09171234567',
          book: selectedBook.title,
          callNo: selectedBook.callNo,
          ref: refNo,
          borrowDate: borrowDateStr,
          dueDate: dueDateStr,
          loanType: loanTypeKey
        };

        // Cache into localStorage for 1-click test scan in scanner.html
        localStorage.setItem(LATEST_BORROW_PASS_KEY, JSON.stringify(borrowPayload));

        // Render QR Code in Modal
        if (modalQrContainer && typeof QRCode !== 'undefined') {
          modalQrContainer.innerHTML = '';
          new QRCode(modalQrContainer, {
            text: JSON.stringify(borrowPayload),
            width: 175,
            height: 175,
            colorDark: '#00875a',
            colorLight: '#ffffff'
          });
        }

        if (borrowModal) borrowModal.classList.add('active');
        showToast('Book Borrowing QR Code generated successfully!', 'success');
      });
    }

    if (closeBorrowModal) {
      closeBorrowModal.addEventListener('click', function () {
        if (borrowModal) borrowModal.classList.remove('active');
      });
    }

    if (borrowModal) {
      borrowModal.addEventListener('click', function (e) {
        if (e.target === borrowModal) borrowModal.classList.remove('active');
      });
    }

    const printSlipBtn = document.getElementById('printSlipBtn');
    if (printSlipBtn) {
      printSlipBtn.addEventListener('click', function () {
        window.print();
      });
    }

    // 10. Action Cards Interactivity
    const cardCatalog = document.getElementById('cardCatalog');
    if (cardCatalog) {
      cardCatalog.addEventListener('click', function () {
        showToast('Book Catalog: 1,482 total titles & accession copies loaded.', 'info');
        document.getElementById('borrowStationSection').scrollIntoView({ behavior: 'smooth' });
      });
    }

    const cardTransactions = document.getElementById('cardTransactions');
    if (cardTransactions) {
      cardTransactions.addEventListener('click', function () {
        showToast('Transactions: Redirecting to circulation desk records...', 'info');
        window.location.href = '../../admin/pages/transactions/scanner.html';
      });
    }

    const cardSettings = document.getElementById('cardSettings');
    if (cardSettings) {
      cardSettings.addEventListener('click', function () {
        showToast('System Policy: Max 2 books per student | ₱20/day penalty (Fri-Sun & holidays exempt).', 'info');
      });
    }

    const cardImportExport = document.getElementById('cardImportExport');
    if (cardImportExport) {
      cardImportExport.addEventListener('click', function () {
        showToast('Import/Export CSV module ready. Supporting books & student rosters.', 'info');
      });
    }

    // 11. Sign Out Action
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        sessionStorage.removeItem(SESSION_USER_KEY);
        showToast('Signed out successfully.', 'info');
        setTimeout(() => {
          window.location.href = '../../index.html';
        }, 500);
      });
    }

  });
})();
