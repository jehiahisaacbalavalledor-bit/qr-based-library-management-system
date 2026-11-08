/**
 * Cavite State University - Imus Campus
 * Student Portal - Book Borrowing & QR Generation Logic
 */

(function () {
  'use strict';

  const SESSION_USER_KEY = 'cvsu_library_current_user';
  const LATEST_BORROW_PASS_KEY = 'cvsu_latest_borrow_pass';

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
    let currentUser = getActiveUser();

    // Default demonstration student if directly opened
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

    // Populate Student Data in UI
    const navStudentName = document.getElementById('navStudentName');
    const navStudentNo = document.getElementById('navStudentNo');
    const badgeStudentNo = document.getElementById('badgeStudentNo');
    const badgeStudentName = document.getElementById('badgeStudentName');
    const badgeCourse = document.getElementById('badgeCourse');

    const profileStudentNo = document.getElementById('profileStudentNo');
    const profileFullName = document.getElementById('profileFullName');
    const profileEmail = document.getElementById('profileEmail');
    const profileMobile = document.getElementById('profileMobile');
    const profileCourse = document.getElementById('profileCourse');
    const profileCampus = document.getElementById('profileCampus');

    const studentNameDisplay = currentUser.fullName || `Student ${currentUser.studentNumber}`;

    if (navStudentName) navStudentName.textContent = studentNameDisplay;
    if (navStudentNo) navStudentNo.textContent = `ID: ${currentUser.studentNumber}`;
    if (badgeStudentNo) badgeStudentNo.textContent = currentUser.studentNumber;
    if (badgeStudentName) badgeStudentName.textContent = studentNameDisplay;
    if (badgeCourse) badgeCourse.textContent = currentUser.course || 'BS Information Technology';

    if (profileStudentNo) profileStudentNo.textContent = currentUser.studentNumber;
    if (profileFullName) profileFullName.textContent = studentNameDisplay;
    if (profileEmail) profileEmail.textContent = currentUser.email || 'N/A';
    if (profileMobile) profileMobile.textContent = currentUser.mobile || 'N/A';
    if (profileCourse) profileCourse.textContent = currentUser.course || 'BS in Information Technology';
    if (profileCampus) profileCampus.textContent = currentUser.campus || 'Imus Campus';

    // Generate General Student QR Code (Left Column)
    const studentQrContainer = document.getElementById('studentQrContainer');
    if (studentQrContainer && typeof QRCode !== 'undefined') {
      const generalPayload = JSON.stringify({
        type: 'CVSU_STUDENT_ID',
        studentNo: currentUser.studentNumber,
        name: studentNameDisplay,
        course: currentUser.course || 'BS Information Technology',
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

    // Book Selection Interactivity
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
        // Clear custom input if an option is clicked
        const customInput = document.getElementById('customBookTitle');
        if (customInput) customInput.value = '';
      });
    });

    // Custom Book Title Input
    const customBookInput = document.getElementById('customBookTitle');
    if (customBookInput) {
      customBookInput.addEventListener('input', function () {
        if (this.value.trim().length > 0) {
          bookOptions.forEach(o => o.classList.remove('selected'));
          selectedBook = {
            title: this.value.trim(),
            author: 'Library Collection',
            callNo: 'QA ' + Math.floor(100 + Math.random() * 900) + ' .CVSU'
          };
        }
      });
    }

    // Modal Elements
    const borrowModal = document.getElementById('borrowModal');
    const closeBorrowModal = document.getElementById('closeBorrowModal');
    const modalQrContainer = document.getElementById('modalQrContainer');

    const slipStudentName = document.getElementById('slipStudentName');
    const slipStudentNo = document.getElementById('slipStudentNo');
    const slipCourse = document.getElementById('slipCourse');
    const slipBookTitle = document.getElementById('slipBookTitle');
    const slipCallNo = document.getElementById('slipCallNo');
    const slipDueDate = document.getElementById('slipDueDate');
    const slipRefCode = document.getElementById('slipRefCode');

    // Generate Borrowing QR Code Button
    const generateBtn = document.getElementById('generateBorrowQrBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', function () {
        const today = new Date();
        const dueDate = new Date();
        dueDate.setDate(today.getDate() + 14);

        const borrowDateStr = today.toISOString().split('T')[0];
        const dueDateStr = dueDate.toISOString().split('T')[0];
        const refNo = 'BRW-' + today.getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

        // Populate Slip details
        if (slipStudentName) slipStudentName.textContent = studentNameDisplay;
        if (slipStudentNo) slipStudentNo.textContent = currentUser.studentNumber;
        if (slipCourse) slipCourse.textContent = currentUser.course || 'BS Information Technology';
        if (slipBookTitle) slipBookTitle.textContent = selectedBook.title;
        if (slipCallNo) slipCallNo.textContent = selectedBook.callNo;
        if (slipDueDate) slipDueDate.textContent = dueDateStr;
        if (slipRefCode) slipRefCode.textContent = `REF: ${refNo}`;

        // Build Payload containing all student and book details
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
          dueDate: dueDateStr
        };

        // Save into localStorage for instant 1-click test scan in scanner.html
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

        // Open Modal
        if (borrowModal) borrowModal.classList.add('active');
        showToast('Book Borrowing QR Code generated successfully!', 'success');
      });
    }

    // Close Modal
    if (closeBorrowModal) {
      closeBorrowModal.addEventListener('click', function () {
        if (borrowModal) borrowModal.classList.remove('active');
      });
    }

    if (borrowModal) {
      borrowModal.addEventListener('click', function (e) {
        if (e.target === borrowModal) {
          borrowModal.classList.remove('active');
        }
      });
    }

    // Print Slip Button
    const printSlipBtn = document.getElementById('printSlipBtn');
    if (printSlipBtn) {
      printSlipBtn.addEventListener('click', function () {
        window.print();
      });
    }

    // Sign Out Action
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

  });

})();
