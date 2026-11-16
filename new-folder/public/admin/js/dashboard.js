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

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  document.addEventListener('DOMContentLoaded', async function () {
    let serverSession = null;
    if (window.CvsuRouteGuard) {
      serverSession = await window.CvsuRouteGuard.requireSession('student', '../../index.html', SESSION_USER_KEY);
      if (!serverSession) return;
    }
    // 1. Initialize Active User Data & hydrate latest DB fields from serverSession
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
    }
    if (serverSession && !serverSession.offline) {
      currentUser = {
        ...currentUser,
        studentNumber: serverSession.student_number || currentUser.studentNumber,
        fullName: serverSession.full_name || currentUser.fullName,
        email: serverSession.email || currentUser.email,
        mobile: serverSession.mobile || currentUser.mobile || '',
        course: serverSession.course || currentUser.course,
        yearLevel: serverSession.yearLevel || currentUser.yearLevel,
        campus: serverSession.campus || currentUser.campus
      };
    }
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(currentUser));

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

    // 4. Sidebar Responsive Toggle & Student Portal View Switching
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    const appSidebar = document.getElementById('appSidebar');
    if (appSidebar) {
      if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function () {
          if (window.innerWidth <= 768) {
            appSidebar.classList.toggle('mobile-open');
          } else {
            appSidebar.classList.toggle('collapsed');
          }
        });
      }

      if (mobileSidebarToggle) {
        mobileSidebarToggle.addEventListener('click', function () {
          appSidebar.classList.toggle('mobile-open');
        });
      }

      document.addEventListener('click', function (e) {
        if (
          window.innerWidth <= 768 &&
          appSidebar.classList.contains('mobile-open') &&
          !appSidebar.contains(e.target) &&
          !(sidebarToggle && sidebarToggle.contains(e.target)) &&
          !(mobileSidebarToggle && mobileSidebarToggle.contains(e.target))
        ) {
          appSidebar.classList.remove('mobile-open');
        }
      });
    }

    const dashboardContentBody = document.getElementById('dashboardContentBody');
    const sidebarViewLinks = document.querySelectorAll('.sidebar-menu a[data-view]');
    const switchViewButtons = document.querySelectorAll('[data-switch-view]');

    function setActiveStudentView(viewName) {
      if (!dashboardContentBody) return;
      const validViews = ['dashboard', 'qr', 'loans', 'profile'];
      const targetView = validViews.includes(viewName) ? viewName : 'dashboard';
      dashboardContentBody.setAttribute('data-active-view', targetView);

      sidebarViewLinks.forEach(link => {
        const li = link.closest('li');
        if (!li) return;
        li.classList.toggle('active', link.getAttribute('data-view') === targetView);
      });

      if (appSidebar && window.innerWidth <= 768) {
        appSidebar.classList.remove('mobile-open');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (dashboardContentBody && sidebarViewLinks.length > 0) {
      sidebarViewLinks.forEach(link => {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          const view = this.getAttribute('data-view');
          const href = this.getAttribute('href');
          if (href && href.startsWith('#')) {
            history.replaceState(null, '', href);
          }
          setActiveStudentView(view);
        });
      });

      switchViewButtons.forEach(btn => {
        btn.addEventListener('click', function () {
          setActiveStudentView(this.getAttribute('data-switch-view'));
        });
      });

      const hashToView = {
        '#studentQrSection': 'qr',
        '#myLoansSection': 'loans',
        '#studentProfileSection': 'profile'
      };
      if (hashToView[window.location.hash]) {
        setActiveStudentView(hashToView[window.location.hash]);
      }
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
      const tomorrowDt = new Date(stats.today + 'T00:00:00');
      tomorrowDt.setDate(tomorrowDt.getDate() + 1);
      const tomorrowYmd = engine.toYmd(tomorrowDt);
      const studentDueSoonCount = activeForStudent.filter(l => l.dueDate === tomorrowYmd).length;

      // Update Student Personal Stat Cards
      const statBorrowedEl = document.getElementById('statBorrowedBooks');
      const statDueTodayEl = document.getElementById('statDueTodayBooks');
      const statOverdueEl = document.getElementById('statOverdueBooks');
      const statAvailEl = document.getElementById('statAvailableBooks');
      if (statBorrowedEl) statBorrowedEl.textContent = `${activeForStudent.length} / ${engine.MAX_ACTIVE_BOOKS}`;
      if (statDueTodayEl) statDueTodayEl.textContent = studentDueTodayCount;
      if (statOverdueEl) statOverdueEl.textContent = `₱${totalStudentFine.toFixed(2)}`;
      if (statAvailEl && engine.getCatalog().length > 0) {
        statAvailEl.textContent = engine.getCatalog().reduce((s, b) => s + Number(b.available_copies || 0), 0);
      }

      // Update Student Due/Overdue/Due-Soon Alert Banner dynamically
      const dueBanner = document.getElementById('dueTodayBanner');
      if (dueBanner) {
        const headingEl = dueBanner.querySelector('h4 span:first-child');
        const pillEl = dueBanner.querySelector('h4 span:last-child');
        const descEl = dueBanner.querySelector('p');

        if (studentDueTodayCount > 0 || studentOverdueCount > 0 || studentDueSoonCount > 0) {
          dueBanner.style.display = '';
          if (pillEl) {
            if (studentOverdueCount > 0) {
              pillEl.textContent = 'OVERDUE ALERT';
              pillEl.style.background = '#dc2626';
            } else if (studentDueTodayCount > 0) {
              pillEl.textContent = 'DUE TODAY';
              pillEl.style.background = '#ea580c';
            } else {
              pillEl.textContent = 'DUE TOMORROW';
              pillEl.style.background = '#0284c7';
            }
          }
          if (headingEl) {
            const parts = [];
            if (studentOverdueCount > 0) parts.push(`${studentOverdueCount} Overdue`);
            if (studentDueTodayCount > 0) parts.push(`${studentDueTodayCount} Due Today`);
            if (studentDueSoonCount > 0) parts.push(`${studentDueSoonCount} Due Tomorrow`);
            headingEl.textContent = `Library Notice: ${parts.join(' | ')}`;
          }
          if (descEl) {
            descEl.innerHTML = totalStudentFine > 0
              ? `You have <strong>₱${totalStudentFine.toFixed(2)}</strong> in accrued/unpaid fines. Please return overdue books at the <strong>Library Circulation Desk</strong> (₱20.00/day, Fri–Sun &amp; holidays exempted).`
              : `Please return or renew books before <strong>5:00 PM</strong> on the due date to avoid the <strong>₱20.00/day penalty</strong> (Fridays, Saturdays, Sundays, and holidays exempted).`;
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
            const tomorrowCheckDt = new Date(stats.today + 'T00:00:00');
            tomorrowCheckDt.setDate(tomorrowCheckDt.getDate() + 1);
            const isDueSoon = loan.dueDate === engine.toYmd(tomorrowCheckDt);
            const badge = calc.isOverdue
              ? `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">OVERDUE (₱${calc.fineAmount.toFixed(2)})</span>`
              : (isDueToday
                ? `<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">DUE TODAY</span>`
                : (isDueSoon
                  ? `<span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">DUE TOMORROW</span>`
                  : `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">ACTIVE</span>`));

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
                    Due: <strong>${loan.dueDate}</strong> (${loan.dueTime || '17:00'})${Number(loan.renewalCount || 0) > 0 ? ` • <span style="color:#0284c7;font-weight:600;">Extended ×${loan.renewalCount}</span>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    }

    syncCirculationDashboard();

    if (window.CvsuCirculationEngine) {
      window.CvsuCirculationEngine.syncFromServer().then(res => {
        if (res && res.ok) syncCirculationDashboard();
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

    // 10b. Account Change Password Form & Visibility Toggles
    document.querySelectorAll('[data-toggle-pwd]').forEach(toggleBtn => {
      toggleBtn.addEventListener('click', function () {
        const targetEl = document.getElementById(this.getAttribute('data-toggle-pwd'));
        if (!targetEl) return;
        targetEl.type = targetEl.type === 'password' ? 'text' : 'password';
      });
    });

    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
      changePasswordForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const engine = window.CvsuCirculationEngine;
        if (!engine || !engine.API_BASE) {
          showToast('Changing password requires an active server connection.', 'error');
          return;
        }
        const currentPassword = document.getElementById('curPasswordInput')?.value || '';
        const newPassword = document.getElementById('newPasswordInput')?.value || '';
        const confirmPassword = document.getElementById('confirmPasswordInput')?.value || '';
        if (newPassword.length < 8) {
          showToast('New password must be at least 8 characters.', 'error');
          return;
        }
        if (newPassword !== confirmPassword) {
          showToast('New password and confirmation do not match.', 'error');
          return;
        }
        const btn = document.getElementById('changePasswordBtn');
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Updating...';
        }
        try {
          const res = await fetch(`${engine.API_BASE}auth/changePassword.php`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
          });
          const json = await res.json();
          if (!res.ok || json.status !== 'success') {
            showToast(json.message || 'Could not update password.', 'error');
            return;
          }
          changePasswordForm.reset();
          showToast(json.message || 'Password updated successfully.', 'success');
        } catch (err) {
          showToast('Network error while updating password.', 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        }
      });
    }

    // 11. Sign Out Action
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        showToast('Signed out successfully.', 'info');
        if (window.CvsuRouteGuard) {
          window.CvsuRouteGuard.logout('../../index.html', SESSION_USER_KEY);
          return;
        }
        sessionStorage.removeItem(SESSION_USER_KEY);
        setTimeout(() => {
          window.location.href = '../../index.html';
        }, 500);
      });
    }

  });
})();
