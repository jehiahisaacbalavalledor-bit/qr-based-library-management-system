/**
 * Cavite State University - Imus Campus
 * Student Portal - Milestone 1: 20% Prototype Logic
 */

(function () {
  'use strict';

  const SESSION_USER_KEY = 'cvsu_library_current_user';

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

    // Default demonstration student if user directly navigated
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
    const profileEmail = document.getElementById('profileEmail');
    const profileMobile = document.getElementById('profileMobile');
    const profileDob = document.getElementById('profileDob');

    if (navStudentName) navStudentName.textContent = currentUser.fullName || `Student ${currentUser.studentNumber}`;
    if (navStudentNo) navStudentNo.textContent = `ID: ${currentUser.studentNumber}`;
    if (badgeStudentNo) badgeStudentNo.textContent = currentUser.studentNumber;
    if (badgeStudentName) badgeStudentName.textContent = currentUser.fullName || `Student ${currentUser.studentNumber}`;
    if (badgeCourse) badgeCourse.textContent = currentUser.course || 'BS Information Technology';

    if (profileStudentNo) profileStudentNo.textContent = currentUser.studentNumber;
    if (profileEmail) profileEmail.textContent = currentUser.email || 'N/A';
    if (profileMobile) profileMobile.textContent = currentUser.mobile || 'N/A';
    if (profileDob) profileDob.textContent = currentUser.dob || 'N/A';

    // Generate Dynamic Student QR Code (Phase 1 ID Verification)
    const qrContainer = document.getElementById('qrContainer');
    if (qrContainer && typeof QRCode !== 'undefined') {
      const qrPayload = `CVSU_STUDENT_ID:${currentUser.studentNumber}:${currentUser.fullName || 'STUDENT'}:VALID`;
      new QRCode(qrContainer, {
        text: qrPayload,
        width: 160,
        height: 160,
        colorDark: '#00875a',
        colorLight: '#ffffff'
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
