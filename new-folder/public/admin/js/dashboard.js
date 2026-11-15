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

    // 5B. Sync Live Circulation Stats, Due Today Banner & 2-Book Quota
    function syncCirculationDashboard() {
      if (!window.CvsuCirculationEngine) return;
      const engine = window.CvsuCirculationEngine;
      const stats = engine.getDashboardStats();
      const activeForStudent = engine.getActiveLoansForStudent(currentUser.studentNumber);
      const unpaidForStudent = engine.getUnpaidFinesForStudent(currentUser.studentNumber);

      // Update Stat Cards
      const statBorrowedEl = document.getElementById('statBorrowedBooks');
      const statOverdueEl = document.getElementById('statOverdueBooks');
      if (statBorrowedEl) statBorrowedEl.textContent = stats.activeBorrowedCount;
      if (statOverdueEl) statOverdueEl.textContent = stats.overdueCount;

      // Update Due Today Banner dynamically
      const dueBanner = document.getElementById('dueTodayBanner');
      if (dueBanner) {
        const headingEl = dueBanner.querySelector('h4 span:first-child');
        const descEl = dueBanner.querySelector('p');
        if (stats.dueTodayCount > 0 || stats.overdueCount > 0) {
          dueBanner.style.display = '';
          if (headingEl) {
            headingEl.textContent = `Due Today: ${stats.dueTodayCount} Book(s) | Overdue: ${stats.overdueCount} Book(s)`;
          }
          if (descEl) {
            descEl.innerHTML = `Projected overdue penalties: <strong>₱${stats.projectedOverdueTotal.toFixed(2)}</strong>. Return or renew before <strong>5:00 PM</strong> to avoid the <strong>₱20.00/day penalty</strong> (Fridays, Saturdays, Sundays, and holidays exempted).`;
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

      const unpaidSum = unpaidForStudent.reduce((s, f) => s + Number(f.fineAmount || 0), 0);
      const liveOverdueSum = activeForStudent.reduce((s, l) => s + engine.calculateOverdueFine(l.dueDate, stats.today).fineAmount, 0);

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
    }

    syncCirculationDashboard();

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
