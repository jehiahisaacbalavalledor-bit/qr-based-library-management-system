/**
 * Cavite State University - Imus Campus
 * Student Portal & QR Library Borrowing Management System
 * Complete Dashboard Logic: Milestones 1 to 5 (20% to 100%)
 */

(function () {
  'use strict';

  const SESSION_USER_KEY = 'cvsu_library_current_user';
  const STORAGE_BOOKS_KEY = 'cvsu_library_catalog_books';
  const STORAGE_TRANSACTIONS_KEY = 'cvsu_library_transactions';
  const STORAGE_ACTIVITY_KEY = 'cvsu_library_activity_logs';

  // Overdue fine policy: ₱10.00 per calendar day
  const FINE_RATE_PER_DAY = 10.0;

  // Default Books Catalog (Milestone 2 Deliverable)
  const DEFAULT_BOOKS = [
    {
      id: 'BK-1082',
      isbn: '978-0262046305',
      title: 'Introduction to Algorithms (4th Edition)',
      author: 'Thomas H. Cormen, Charles E. Leiserson',
      category: 'CS & IT',
      location: 'Section A-3 (Computer Science)',
      totalCopies: 5,
      availableCopies: 3
    },
    {
      id: 'BK-3041',
      isbn: '978-0078022159',
      title: 'Database System Concepts (7th Edition)',
      author: 'Abraham Silberschatz, Henry F. Korth',
      category: 'CS & IT',
      location: 'Section A-4 (Database Systems)',
      totalCopies: 4,
      availableCopies: 2
    },
    {
      id: 'BK-2015',
      isbn: '978-0132350884',
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      author: 'Robert C. Martin',
      category: 'CS & IT',
      location: 'Section B-1 (Software Engineering)',
      totalCopies: 6,
      availableCopies: 5
    },
    {
      id: 'BK-4099',
      isbn: '978-0136681557',
      title: 'Computer Networking: A Top-Down Approach',
      author: 'James F. Kurose, Keith W. Ross',
      category: 'Engineering',
      location: 'Section C-2 (Networks & Telecom)',
      totalCopies: 3,
      availableCopies: 3
    },
    {
      id: 'BK-5520',
      isbn: '978-1337102063',
      title: 'Principles of Information Security (6th Ed)',
      author: 'Michael E. Whitman, Herbert J. Mattord',
      category: 'CS & IT',
      location: 'Section B-4 (Cybersecurity)',
      totalCopies: 4,
      availableCopies: 2
    },
    {
      id: 'BK-6101',
      isbn: '978-0134204925',
      title: 'Modern Systems Analysis and Design',
      author: 'Jeffrey A. Hoffer, Joey George, Joseph Valacich',
      category: 'Business',
      location: 'Section D-1 (Information Systems)',
      totalCopies: 5,
      availableCopies: 5
    },
    {
      id: 'BK-7742',
      isbn: '978-9710321155',
      title: 'Philippine History and Governance',
      author: 'F. Landa Jocano',
      category: 'General Education',
      location: 'Section E-2 (Filipiniana)',
      totalCopies: 8,
      availableCopies: 7
    },
    {
      id: 'BK-8890',
      isbn: '978-9719808848',
      title: 'Purposive Communication: In Local and Global Contexts',
      author: 'C. Flores, E. Rosa',
      category: 'General Education',
      location: 'Section E-5 (Humanities)',
      totalCopies: 10,
      availableCopies: 9
    }
  ];

  // Helper: Toast Notifications
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
    }, 3800);
  }

  // Session & Local Storage Management
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

  function getBooksCatalog() {
    const saved = localStorage.getItem(STORAGE_BOOKS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(DEFAULT_BOOKS));
    return DEFAULT_BOOKS;
  }

  function saveBooksCatalog(books) {
    localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(books));
  }

  function getTransactions(studentNumber) {
    const saved = localStorage.getItem(STORAGE_TRANSACTIONS_KEY);
    let allTransactions = [];
    if (saved) {
      try {
        allTransactions = JSON.parse(saved);
      } catch (e) {}
    }

    // Initialize with default sample transactions if first run
    if (!saved || allTransactions.length === 0) {
      const today = new Date();
      
      // Sample 1: Overdue book (borrowed 10 days ago, due 3 days ago)
      const dateBorrowOverdue = new Date(today);
      dateBorrowOverdue.setDate(today.getDate() - 10);
      const dateDueOverdue = new Date(today);
      dateDueOverdue.setDate(today.getDate() - 3);

      // Sample 2: Active active book (borrowed 2 days ago, due in 5 days)
      const dateBorrowActive = new Date(today);
      dateBorrowActive.setDate(today.getDate() - 2);
      const dateDueActive = new Date(today);
      dateDueActive.setDate(today.getDate() + 5);

      allTransactions = [
        {
          id: 'TXN-9021',
          studentNumber: studentNumber || '202410001',
          bookId: 'BK-1082',
          bookTitle: 'Introduction to Algorithms (4th Edition)',
          bookAuthor: 'Thomas H. Cormen',
          borrowDate: dateBorrowOverdue.toISOString().split('T')[0],
          dueDate: dateDueOverdue.toISOString().split('T')[0],
          returnDate: null,
          status: 'BORROWED'
        },
        {
          id: 'TXN-9022',
          studentNumber: studentNumber || '202410001',
          bookId: 'BK-3041',
          bookTitle: 'Database System Concepts (7th Edition)',
          bookAuthor: 'Abraham Silberschatz',
          borrowDate: dateBorrowActive.toISOString().split('T')[0],
          dueDate: dateDueActive.toISOString().split('T')[0],
          returnDate: null,
          status: 'BORROWED'
        }
      ];
      localStorage.setItem(STORAGE_TRANSACTIONS_KEY, JSON.stringify(allTransactions));
    }

    return allTransactions.filter(t => t.studentNumber === studentNumber);
  }

  function saveTransactions(allTransactions) {
    localStorage.setItem(STORAGE_TRANSACTIONS_KEY, JSON.stringify(allTransactions));
  }

  function getAllTransactions() {
    const saved = localStorage.getItem(STORAGE_TRANSACTIONS_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  }

  function getActivityLogs() {
    const saved = localStorage.getItem(STORAGE_ACTIVITY_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        timestamp: '2026-11-04 08:30:15',
        type: 'BORROW_QR',
        studentNumber: '202410001',
        bookTitle: 'Database System Concepts',
        status: 'Success (7-day loan issued)'
      },
      {
        timestamp: '2026-11-03 14:12:00',
        type: 'ACCOUNT_REG',
        studentNumber: '202410001',
        bookTitle: 'System Account Activation',
        status: 'Pass QR Token Generated'
      }
    ];
  }

  function addActivityLog(type, studentNumber, bookTitle, status) {
    const logs = getActivityLogs();
    const now = new Date();
    const timestamp = now.toLocaleDateString('en-CA') + ' ' + now.toLocaleTimeString('en-GB');
    logs.unshift({ timestamp, type, studentNumber, bookTitle, status });
    localStorage.setItem(STORAGE_ACTIVITY_KEY, JSON.stringify(logs.slice(0, 15)));
    renderActivityLogs();
  }

  // Calculate Overdue Days and Fines
  function calculateOverdue(dueDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = today - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return {
        isOverdue: true,
        daysOverdue: diffDays,
        fine: diffDays * FINE_RATE_PER_DAY
      };
    } else {
      return {
        isOverdue: false,
        daysRemaining: Math.abs(diffDays),
        fine: 0.0
      };
    }
  }

  // DOMContentLoaded Controller
  document.addEventListener('DOMContentLoaded', function () {
    let currentUser = getActiveUser();

    // Default demonstration student fallback
    if (!currentUser) {
      currentUser = {
        studentNumber: '202410001',
        fullName: 'Juan C. Dela Cruz',
        email: 'juan.delacruz@cvsu.edu.ph',
        mobile: '09171234567',
        dob: '2004-05-15',
        course: 'BS in Information Technology',
        campus: 'Imus Campus'
      };
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(currentUser));
    }

    // 1. Populate Student Profile Data in Navbar & Header
    const navStudentName = document.getElementById('navStudentName');
    const navStudentNo = document.getElementById('navStudentNo');
    const badgeStudentNo = document.getElementById('badgeStudentNo');
    const badgeStudentName = document.getElementById('badgeStudentName');
    const badgeCourse = document.getElementById('badgeCourse');
    const profileStudentNo = document.getElementById('profileStudentNo');
    const profileEmail = document.getElementById('profileEmail');
    const profileMobile = document.getElementById('profileMobile');
    const profileDob = document.getElementById('profileDob');
    const profileCampus = document.getElementById('profileCampus');

    if (navStudentName) navStudentName.textContent = currentUser.fullName || `Student ${currentUser.studentNumber}`;
    if (navStudentNo) navStudentNo.textContent = `ID: ${currentUser.studentNumber}`;
    if (badgeStudentNo) badgeStudentNo.textContent = currentUser.studentNumber;
    if (badgeStudentName) badgeStudentName.textContent = currentUser.fullName || `Student ${currentUser.studentNumber}`;
    if (badgeCourse) badgeCourse.textContent = currentUser.course || 'BS Information Technology';

    if (profileStudentNo) profileStudentNo.textContent = currentUser.studentNumber;
    if (profileEmail) profileEmail.textContent = currentUser.email || 'N/A';
    if (profileMobile) profileMobile.textContent = currentUser.mobile || 'N/A';
    if (profileDob) profileDob.textContent = currentUser.dob || 'N/A';
    if (profileCampus) profileCampus.textContent = currentUser.campus || 'Imus Campus';

    // 2. Generate Student Dynamic QR Pass (Milestone 1 Deliverable)
    const qrContainer = document.getElementById('qrContainer');
    if (qrContainer && typeof QRCode !== 'undefined') {
      qrContainer.innerHTML = '';
      const qrPayload = JSON.stringify({
        cvsu_id: currentUser.studentNumber,
        name: currentUser.fullName,
        dept: currentUser.course,
        token: `CVSU-${currentUser.studentNumber}-PASS`
      });

      new QRCode(qrContainer, {
        text: qrPayload,
        width: 155,
        height: 155,
        colorDark: '#00875a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }

    // 3. Process Milestone Controller (The Core Progression Engine)
    initMilestoneController();

    // 4. Render Books Catalog (Milestone 2)
    renderBooksCatalog();

    // 5. Render Active Borrowed Books & Overdue Calculations (Milestone 4)
    renderBorrowedBooks(currentUser.studentNumber);

    // 6. Setup Circulation Desk Kiosk (Milestone 3)
    setupCirculationKiosk(currentUser);

    // 7. Update Analytics & Audit Logs (Milestone 5)
    updateAnalytics();
    renderActivityLogs();

    // 8. Sign Out Handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        sessionStorage.removeItem(SESSION_USER_KEY);
        showToast('Signed out successfully.', 'info');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 500);
      });
    }

    // 9. Print / Save QR Pass Button
    const printQrBtn = document.getElementById('printQrBtn');
    if (printQrBtn) {
      printQrBtn.addEventListener('click', function () {
        window.print();
      });
    }

    // 10. Export Report Slip
    const exportReportBtn = document.getElementById('exportReportBtn');
    if (exportReportBtn) {
      exportReportBtn.addEventListener('click', function () {
        showToast('Generating official library circulation summary report...', 'info');
        setTimeout(() => {
          window.print();
        }, 700);
      });
    }
  });

  // =========================================================================
  // PROCESS MILESTONE CONTROLLER & ROADMAP ENGINE
  // =========================================================================
  const MILESTONE_DESCRIPTIONS = {
    'all': '<strong>100% Full System View:</strong> Showing all 5 integrated milestones — Student Authentication & QR Identification (20%), Book Inventory & Search Catalog (40%), QR Barcode Circulation Desk (60%), Due Dates & Overdue Penalty Calculator (80%), and Librarian Analytics & Activity Reports (100%).',
    '20': '<strong>Milestone 1 Scope (20% Complete):</strong> Student Portal Authentication, Account Registration form with CvSU validations, and Student Digital QR ID Pass Token generation for circulation access.',
    '40': '<strong>Milestone 2 Scope (40% Complete):</strong> Library Book Catalog, live multi-keyword search, category filtering, shelf location tracking, and real-time stock inventory status.',
    '60': '<strong>Milestone 3 Scope (60% Complete):</strong> QR Code Circulation Desk kiosk simulator, student identification validation, 7-day borrowing issue workflow, and real-time inventory decrement.',
    '80': '<strong>Milestone 4 Scope (80% Complete):</strong> Active Loans Tracker, due dates calendar countdown, CvSU overdue policy penalty computation (₱10.00/day), and 1-click book return check-in.',
    '100': '<strong>Milestone 5 Scope (100% Complete):</strong> Librarian Admin Analytics, catalog metrics, circulation statistics, fine collection audit, and printable summary report slips.'
  };

  function initMilestoneController() {
    const tabs = document.querySelectorAll('.milestone-tab-btn');
    const timelineItems = document.querySelectorAll('.timeline-item');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressBadge = document.getElementById('progressPercentageBadge');
    const scopeDesc = document.getElementById('milestoneScopeDescription');
    const navMilestoneText = document.getElementById('navMilestoneText');
    const modules = document.querySelectorAll('.milestone-module');

    function applyMilestoneFilter(targetMilestone) {
      // 1. Update Tabs styling
      tabs.forEach(tab => {
        if (tab.getAttribute('data-milestone') === targetMilestone) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // 2. Update Timeline highlight
      timelineItems.forEach(item => {
        const itemMilestone = item.getAttribute('data-milestone');
        if (targetMilestone === 'all' || itemMilestone === targetMilestone) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // 3. Update Progress Bar & Badges
      let pct = '100%';
      let text = 'Complete System (100%)';
      if (targetMilestone === '20') { pct = '20%'; text = 'Milestone 1 (20%)'; }
      else if (targetMilestone === '40') { pct = '40%'; text = 'Milestone 2 (40%)'; }
      else if (targetMilestone === '60') { pct = '60%'; text = 'Milestone 3 (60%)'; }
      else if (targetMilestone === '80') { pct = '80%'; text = 'Milestone 4 (80%)'; }
      else if (targetMilestone === '100' || targetMilestone === 'all') { pct = '100%'; text = 'Complete System (100%)'; }

      if (progressBarFill) progressBarFill.style.width = pct;
      if (progressBadge) progressBadge.textContent = `${pct} Completed`;
      if (navMilestoneText) navMilestoneText.textContent = text;
      if (scopeDesc) scopeDesc.innerHTML = MILESTONE_DESCRIPTIONS[targetMilestone] || MILESTONE_DESCRIPTIONS['all'];

      // 4. Filter or highlight visible modules
      modules.forEach(mod => {
        const belongTo = mod.getAttribute('data-belong-to');
        if (targetMilestone === 'all' || belongTo === targetMilestone) {
          mod.style.display = '';
          mod.style.opacity = '1';
        } else {
          // If a specific milestone is focused, gently fade out other modules
          mod.style.display = 'none';
        }
      });

      showToast(`Switched view to ${text}`, 'info');
    }

    tabs.forEach(btn => {
      btn.addEventListener('click', function () {
        const target = this.getAttribute('data-milestone');
        applyMilestoneFilter(target);
      });
    });

    timelineItems.forEach(item => {
      item.addEventListener('click', function () {
        const target = this.getAttribute('data-milestone');
        applyMilestoneFilter(target);
      });
    });
  }

  // =========================================================================
  // MILESTONE 2: BOOK INVENTORY & CATALOG SEARCH
  // =========================================================================
  let currentCategory = 'ALL';
  let currentSearchQuery = '';

  function renderBooksCatalog() {
    const container = document.getElementById('booksGridContainer');
    if (!container) return;

    const books = getBooksCatalog();
    const filtered = books.filter(book => {
      const matchCat = (currentCategory === 'ALL' || book.category === currentCategory);
      const q = currentSearchQuery.toLowerCase();
      const matchQuery = !q || 
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q) ||
        book.id.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #64748b;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom: 8px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <p style="font-weight: 600; color: #1e293b;">No books found matching criteria</p>
          <span style="font-size: 12px;">Try adjusting your keyword or category filter.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(book => {
      const isAvailable = book.availableCopies > 0;
      return `
        <div class="book-card">
          <div>
            <div class="book-header">
              <span class="book-category">${book.category}</span>
              <span class="stock-badge ${isAvailable ? 'stock-available' : 'stock-empty'}">
                ${isAvailable ? `${book.availableCopies} Available` : 'Out of Stock'}
              </span>
            </div>
            <div class="book-title">${book.title}</div>
            <div class="book-author">By ${book.author}</div>
            <div class="book-meta">
              <span>Code: <strong>${book.id}</strong></span>
              <span>${book.location}</span>
            </div>
          </div>
          <button class="btn-borrow" data-book-id="${book.id}" ${!isAvailable ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            ${isAvailable ? 'Borrow with QR' : 'Unavailable'}
          </button>
        </div>
      `;
    }).join('');

    // Attach Borrow Action to buttons
    container.querySelectorAll('.btn-borrow').forEach(btn => {
      btn.addEventListener('click', function () {
        const bookId = this.getAttribute('data-book-id');
        openBorrowModal(bookId);
      });
    });
  }

  // Setup Search Input & Category Pills
  const searchInput = document.getElementById('catalogSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function (e) {
      currentSearchQuery = e.target.value;
      renderBooksCatalog();
    });
  }

  const categoryPills = document.querySelectorAll('.filter-pill');
  categoryPills.forEach(pill => {
    pill.addEventListener('click', function () {
      categoryPills.forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      currentCategory = this.getAttribute('data-category');
      renderBooksCatalog();
    });
  });

  // =========================================================================
  // MILESTONE 3: QR CIRCULATION DESK (BORROW WORKFLOW)
  // =========================================================================
  let selectedBookForBorrow = null;

  function setupCirculationKiosk(currentUser) {
    const bookSelect = document.getElementById('kioskBookSelect');
    const issueBtn = document.getElementById('kioskIssueBtn');
    if (!bookSelect || !issueBtn) return;

    function populateSelect() {
      const books = getBooksCatalog();
      bookSelect.innerHTML = books.map(book => {
        const disabled = book.availableCopies <= 0;
        return `<option value="${book.id}" ${disabled ? 'disabled' : ''}>${book.id} — ${book.title} (${book.availableCopies} left)</option>`;
      }).join('');
    }

    populateSelect();

    issueBtn.addEventListener('click', function () {
      const selectedId = bookSelect.value;
      if (!selectedId) {
        showToast('Please select a book to borrow.', 'error');
        return;
      }
      openBorrowModal(selectedId);
    });
  }

  function openBorrowModal(bookId) {
    const books = getBooksCatalog();
    const book = books.find(b => b.id === bookId);
    if (!book || book.availableCopies <= 0) {
      showToast('Selected book is currently out of stock.', 'error');
      return;
    }

    selectedBookForBorrow = book;
    const currentUser = getActiveUser() || { studentNumber: '202410001' };

    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(today.getDate() + 7);

    document.getElementById('modalBookTitle').textContent = book.title;
    document.getElementById('modalBookAuthor').textContent = `By ${book.author} (ISBN: ${book.isbn})`;
    document.getElementById('modalStudentNumber').textContent = currentUser.studentNumber;
    document.getElementById('modalBorrowDate').textContent = today.toLocaleDateString('en-CA');
    document.getElementById('modalDueDate').textContent = dueDate.toLocaleDateString('en-CA');

    const modal = document.getElementById('borrowModal');
    if (modal) modal.classList.add('active');
  }

  // Modal Buttons
  const closeBorrowModalBtn = document.getElementById('closeBorrowModalBtn');
  const cancelBorrowModalBtn = document.getElementById('cancelBorrowModalBtn');
  const confirmBorrowModalBtn = document.getElementById('confirmBorrowModalBtn');

  function closeModal() {
    const modal = document.getElementById('borrowModal');
    if (modal) modal.classList.remove('active');
    selectedBookForBorrow = null;
  }

  if (closeBorrowModalBtn) closeBorrowModalBtn.addEventListener('click', closeModal);
  if (cancelBorrowModalBtn) cancelBorrowModalBtn.addEventListener('click', closeModal);

  if (confirmBorrowModalBtn) {
    confirmBorrowModalBtn.addEventListener('click', function () {
      if (!selectedBookForBorrow) return;

      const currentUser = getActiveUser() || { studentNumber: '202410001' };
      const today = new Date();
      const dueDate = new Date();
      dueDate.setDate(today.getDate() + 7);

      // 1. Decrement available copies in book catalog
      const books = getBooksCatalog();
      const bookIndex = books.findIndex(b => b.id === selectedBookForBorrow.id);
      if (bookIndex !== -1 && books[bookIndex].availableCopies > 0) {
        books[bookIndex].availableCopies -= 1;
        saveBooksCatalog(books);
      }

      // 2. Add transaction record
      const allTxns = getAllTransactions();
      const newTxn = {
        id: 'TXN-' + Math.floor(1000 + Math.random() * 9000),
        studentNumber: currentUser.studentNumber,
        bookId: selectedBookForBorrow.id,
        bookTitle: selectedBookForBorrow.title,
        bookAuthor: selectedBookForBorrow.author,
        borrowDate: today.toLocaleDateString('en-CA'),
        dueDate: dueDate.toLocaleDateString('en-CA'),
        returnDate: null,
        status: 'BORROWED'
      };

      allTxns.unshift(newTxn);
      saveTransactions(allTxns);

      // 3. Add to activity logs
      addActivityLog('BORROW_QR', currentUser.studentNumber, selectedBookForBorrow.title, 'Issued (Due in 7 days)');

      // 4. Refresh UI
      renderBooksCatalog();
      renderBorrowedBooks(currentUser.studentNumber);
      setupCirculationKiosk(currentUser);
      updateAnalytics();

      closeModal();
      showToast(`Successfully issued "${newTxn.bookTitle}"! Due date: ${newTxn.dueDate}`, 'success');
    });
  }

  // =========================================================================
  // MILESTONE 4: ACTIVE BORROWED BOOKS & OVERDUE FINE TRACKING
  // =========================================================================
  function renderBorrowedBooks(studentNumber) {
    const tbody = document.getElementById('borrowedTableBody');
    const badge = document.getElementById('activeLoanCountBadge');
    if (!tbody) return;

    const myTransactions = getTransactions(studentNumber);
    const activeLoans = myTransactions.filter(t => t.status === 'BORROWED');

    if (badge) badge.textContent = `Active Loans: ${activeLoans.length}`;

    if (activeLoans.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: #64748b;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="margin-bottom: 6px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            <div>No active borrowed books right now.</div>
            <span style="font-size: 11.5px;">Browse the catalog below to borrow with your QR pass.</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = activeLoans.map(item => {
      const overdueInfo = calculateOverdue(item.dueDate);
      let statusHtml = '';
      if (overdueInfo.isOverdue) {
        statusHtml = `<span class="status-badge status-overdue">OVERDUE (${overdueInfo.daysOverdue}d)</span> <span class="fine-amount">₱${overdueInfo.fine.toFixed(2)}</span>`;
      } else if (overdueInfo.daysRemaining <= 2) {
        statusHtml = `<span class="status-badge status-warning">Due in ${overdueInfo.daysRemaining}d</span> <span style="color: #64748b; font-size: 11px;">₱0.00</span>`;
      } else {
        statusHtml = `<span class="status-badge status-active">Active (${overdueInfo.daysRemaining}d left)</span> <span style="color: #64748b; font-size: 11px;">₱0.00</span>`;
      }

      return `
        <tr>
          <td><strong style="font-family: monospace;">${item.bookId}</strong></td>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${item.bookTitle}</div>
            <div style="font-size: 11.5px; color: #64748b;">${item.bookAuthor}</div>
          </td>
          <td>${item.borrowDate}</td>
          <td><strong style="color: #1e293b;">${item.dueDate}</strong></td>
          <td>${statusHtml}</td>
          <td>
            <button class="btn-table-action btn-return-book" data-txn-id="${item.id}" data-book-id="${item.bookId}">
              Return Book
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach return handler
    tbody.querySelectorAll('.btn-return-book').forEach(btn => {
      btn.addEventListener('click', function () {
        const txnId = this.getAttribute('data-txn-id');
        const bookId = this.getAttribute('data-book-id');
        processReturnBook(txnId, bookId);
      });
    });
  }

  function processReturnBook(txnId, bookId) {
    const currentUser = getActiveUser() || { studentNumber: '202410001' };
    const allTxns = getAllTransactions();
    const txnIndex = allTxns.findIndex(t => t.id === txnId);

    if (txnIndex === -1) return;

    const txn = allTxns[txnIndex];
    const overdueInfo = calculateOverdue(txn.dueDate);
    const today = new Date().toLocaleDateString('en-CA');

    txn.status = 'RETURNED';
    txn.returnDate = today;
    saveTransactions(allTxns);

    // Increment available copies in catalog
    const books = getBooksCatalog();
    const bIndex = books.findIndex(b => b.id === bookId);
    if (bIndex !== -1) {
      books[bIndex].availableCopies = Math.min(books[bIndex].totalCopies, books[bIndex].availableCopies + 1);
      saveBooksCatalog(books);
    }

    // Add activity log
    const fineMsg = overdueInfo.isOverdue ? ` (Fine Settled: ₱${overdueInfo.fine.toFixed(2)})` : '';
    addActivityLog('RETURN_QR', currentUser.studentNumber, txn.bookTitle, `Returned Successfully${fineMsg}`);

    // Refresh UI
    renderBorrowedBooks(currentUser.studentNumber);
    renderBooksCatalog();
    setupCirculationKiosk(currentUser);
    updateAnalytics();

    if (overdueInfo.isOverdue) {
      showToast(`Book returned! Late fee assessed: ₱${overdueInfo.fine.toFixed(2)} (${overdueInfo.daysOverdue} days overdue).`, 'error');
    } else {
      showToast(`Book "${txn.bookTitle}" returned on time. Thank you!`, 'success');
    }
  }

  // =========================================================================
  // MILESTONE 5: LIBRARIAN ANALYTICS & ACTIVITY LOG
  // =========================================================================
  function updateAnalytics() {
    const books = getBooksCatalog();
    const allTxns = getAllTransactions();
    const activeLoans = allTxns.filter(t => t.status === 'BORROWED');

    let totalOverdue = 0;
    let totalFines = 0.0;

    activeLoans.forEach(loan => {
      const overdue = calculateOverdue(loan.dueDate);
      if (overdue.isOverdue) {
        totalOverdue += 1;
        totalFines += overdue.fine;
      }
    });

    const statTotalBooks = document.getElementById('statTotalBooks');
    const statActiveLoans = document.getElementById('statActiveLoans');
    const statOverdueBooks = document.getElementById('statOverdueBooks');
    const statTotalFines = document.getElementById('statTotalFines');

    if (statTotalBooks) statTotalBooks.textContent = books.length;
    if (statActiveLoans) statActiveLoans.textContent = activeLoans.length;
    if (statOverdueBooks) statOverdueBooks.textContent = totalOverdue;
    if (statTotalFines) statTotalFines.textContent = `₱${totalFines.toFixed(2)}`;
  }

  function renderActivityLogs() {
    const tbody = document.getElementById('activityLogTableBody');
    if (!tbody) return;

    const logs = getActivityLogs();
    tbody.innerHTML = logs.map(log => {
      let badgeClass = 'status-active';
      if (log.type === 'RETURN_QR') badgeClass = 'status-warning';
      if (log.type === 'ACCOUNT_REG') badgeClass = 'status-active';

      return `
        <tr>
          <td style="font-size: 11.5px; color: #64748b;">${log.timestamp}</td>
          <td><span class="status-badge ${badgeClass}">${log.type}</span></td>
          <td><strong style="font-family: monospace;">${log.studentNumber}</strong></td>
          <td style="font-weight: 500;">${log.bookTitle}</td>
          <td style="font-size: 12px; color: #15803d;">${log.status}</td>
        </tr>
      `;
    }).join('');
  }

})();