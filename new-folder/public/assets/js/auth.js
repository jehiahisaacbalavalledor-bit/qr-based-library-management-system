/**
 * Cavite State University - Imus Campus
 * Student Portal & QR Library Borrowing Management System
 * Authentication & Client-side Session Handler (Student & Staff/Admin)
 */

(function () {
  'use strict';

  // Resolve public/ base URL from script location (assets/js/auth.js -> ../../)
  const SCRIPT_SRC = document.currentScript ? document.currentScript.src : '';
  const PUBLIC_BASE = SCRIPT_SRC ? new URL('../../', SCRIPT_SRC).href : '';
  const IS_HTTP = window.location.protocol.startsWith('http');

  // Storage Keys
  const STORAGE_USERS_KEY = 'cvsu_library_registered_users';
  const SESSION_USER_KEY = 'cvsu_library_current_user';
  const STORAGE_ADMINS_KEY = 'cvsu_library_registered_admins';
  const SESSION_ADMIN_KEY = 'cvsu_library_current_admin';

  // Seed default demonstration student account if empty
  function initializeDefaultUsers() {
    const existingUsers = localStorage.getItem(STORAGE_USERS_KEY);
    if (!existingUsers) {
      const defaultUsers = [
        {
          studentNumber: '202410001',
          fullName: 'Juan C. Dela Cruz',
          email: 'juan.delacruz@cvsu.edu.ph',
          mobile: '09171234567',
          dob: '2004-05-15',
          password: 'Password123!',
          course: 'BS in Information Technology',
          campus: 'Imus Campus',
          borrowedBooks: [
            {
              id: 'BK-1082',
              title: 'Introduction to Algorithms (4th Edition)',
              author: 'Thomas H. Cormen',
              borrowDate: '2026-10-25',
              dueDate: '2026-11-08',
              status: 'Borrowed'
            },
            {
              id: 'BK-3041',
              title: 'Database System Concepts (7th Edition)',
              author: 'Abraham Silberschatz',
              borrowDate: '2026-10-28',
              dueDate: '2026-11-11',
              status: 'Borrowed'
            }
          ]
        }
      ];
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(defaultUsers));
    }
  }

  // Seed default demonstration admin/librarian account if empty
  function initializeDefaultAdmins() {
    const existingAdmins = localStorage.getItem(STORAGE_ADMINS_KEY);
    if (!existingAdmins) {
      const defaultAdmins = [
        {
          employeeId: 'LIB-2024-001',
          fullName: 'Prof. Maria C. Santos',
          email: 'admin@cvsu.edu.ph',
          role: 'Head Librarian',
          password: 'AdminPassword123!'
        }
      ];
      localStorage.setItem(STORAGE_ADMINS_KEY, JSON.stringify(defaultAdmins));
    }
  }

  initializeDefaultUsers();
  initializeDefaultAdmins();

  // Helper: Retrieve all users
  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_USERS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  }

  // Helper: Retrieve all admins
  function getAdmins() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_ADMINS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveAdmins(admins) {
    localStorage.setItem(STORAGE_ADMINS_KEY, JSON.stringify(admins));
  }

  // Helper: Normalize Student Number / Employee ID (strips hyphens and spaces)
  function cleanStudentNumber(str) {
    return (str || '').replace(/[\s-]/g, '').trim();
  }

  function getTodayYmd() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function applyDobBounds(input) {
    if (!input) return;
    input.min = '1920-01-01';
    input.max = getTodayYmd();
  }

  function isValidDob(dobStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dobStr || '')) return false;
    const [y, m, d] = dobStr.split('-').map(Number);
    if (y < 1920 || dobStr > getTodayYmd()) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  // Toast Notification System
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

  // Setup Password Show/Hide Toggle
  function setupPasswordToggle(buttonId, inputId, iconId) {
    const btn = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (!btn || !input) return;

    btn.addEventListener('click', function () {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      if (icon) {
        if (isPassword) {
          icon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          `;
        } else {
          icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          `;
        }
      }
    });
  }

  // Setup Modals
  function setupModal(triggerId, modalId, closeBtnId) {
    const trigger = document.getElementById(triggerId);
    const modal = document.getElementById(modalId);
    const closeBtn = document.getElementById(closeBtnId);

    if (!trigger || !modal) return;

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      modal.classList.add('active');
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        modal.classList.remove('active');
      });
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  }

  // DOM Loaded Listeners
  document.addEventListener('DOMContentLoaded', function () {
    
    // ========================================================================
    // STUDENT LOGIN PAGE LOGIC
    // ========================================================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      setupPasswordToggle('togglePasswordBtn', 'password', 'eyeIcon');
      setupModal('supportLink', 'supportModal', 'closeSupportModal');
      setupModal('walkthroughLink', 'walkthroughModal', 'closeWalkthroughModal');

      // Demo autofill button
      const fillDemoBtn = document.getElementById('fillDemoBtn');
      if (fillDemoBtn) {
        fillDemoBtn.addEventListener('click', function () {
          const studentInput = document.getElementById('studentNumber');
          const passInput = document.getElementById('password');
          if (studentInput && passInput) {
            studentInput.value = '202410001';
            passInput.value = 'Password123!';
            showToast('Demo student credentials filled!', 'info');
          }
        });
      }

      function showLoginLoadingScreen(titleText, subtitleText) {
        const toastContainer = document.getElementById('toastContainer');
        if (toastContainer) toastContainer.innerHTML = '';
        const overlay = document.getElementById('loginLoadingOverlay');
        if (!overlay) return;
        const titleEl = document.getElementById('loadingScreenTitle');
        const subEl = document.getElementById('loadingScreenSubtitle');
        if (titleEl && titleText) titleEl.textContent = titleText;
        if (subEl && subtitleText) subEl.textContent = subtitleText;
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('active');
      }

      function hideLoginLoadingScreen() {
        const overlay = document.getElementById('loginLoadingOverlay');
        if (!overlay) return;
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
      }

      window.addEventListener('pageshow', function () {
        hideLoginLoadingScreen();
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Sign In';
        }
      });

      function completeLoginRedirect(storageKey, payload, targetPath, titleText, subtitleText) {
        sessionStorage.setItem(storageKey, JSON.stringify(payload));
        showLoginLoadingScreen(titleText, subtitleText);
        setTimeout(() => {
          window.location.href = `${PUBLIC_BASE}${targetPath}`;
        }, 600);
      }

      function storeStudentAndRedirect(data, fallbackStudentNo) {
        completeLoginRedirect(
          SESSION_USER_KEY,
          {
            id: data.id,
            studentNumber: data.studentNumber || fallbackStudentNo,
            fullName: data.fullName || `Student ${fallbackStudentNo}`,
            email: data.email || `${fallbackStudentNo}@cvsu.edu.ph`,
            mobile: data.mobile || '',
            course: data.course || 'BS Information Technology',
            yearLevel: data.yearLevel || '1st Year',
            campus: data.campus || 'Imus Campus'
          },
          'user/pages/dashboard.html',
          'Loading Student Portal...',
          'Preparing your library dashboard.'
        );
      }

      function storeAdminAndRedirect(data, rawUsername) {
        const consoleName = data.role === 'Circulation Desk Officer' ? 'Staff Console' : 'Admin Console';
        completeLoginRedirect(
          SESSION_ADMIN_KEY,
          {
            id: data.id,
            employeeId: data.employeeId || rawUsername,
            fullName: data.fullName || 'Library Staff',
            email: data.email || rawUsername,
            role: data.role || 'Head Librarian',
            campus: data.campus || 'Imus Campus'
          },
          'admin/admin-dashboard.html',
          `Loading ${consoleName}...`,
          'Preparing your library workspace.'
        );
      }

      async function tryRemoteAdminLogin(rawUsername, password) {
        const apiRes = await fetch(`${PUBLIC_BASE}api/auth/adminLogin.php`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminUsername: rawUsername,
            adminPassword: password
          })
        });
        if (!apiRes.ok) return null;
        return apiRes.json();
      }

      function matchOfflineAdmin(rawUsername, password) {
        const cleanedUser = cleanStudentNumber(rawUsername).toLowerCase();
        const admins = getAdmins();
        const matched = admins.find(a => {
          const matchId = cleanStudentNumber(a.employeeId).toLowerCase() === cleanedUser;
          const matchEmail = (a.email || '').toLowerCase() === rawUsername.toLowerCase();
          return (matchId || matchEmail) && a.password === password;
        });
        if (matched) return matched;
        if (
          (cleanedUser === 'lib2024001' || rawUsername.toLowerCase() === 'admin@cvsu.edu.ph') &&
          password === 'AdminPassword123!'
        ) {
          return {
            employeeId: 'LIB-2024-001',
            fullName: 'Prof. Maria C. Santos',
            email: 'admin@cvsu.edu.ph',
            role: 'Head Librarian',
            campus: 'Imus Campus'
          };
        }
        return null;
      }

      loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const studentInput = document.getElementById('studentNumber');
        const passInput = document.getElementById('password');
        const submitBtn = document.getElementById('submitBtn');

        const rawStudentNo = studentInput.value.trim();
        const studentNo = cleanStudentNumber(rawStudentNo);
        const password = passInput.value;

        if (!studentNo) {
          showToast('Please enter your Student Number.', 'error');
          studentInput.focus();
          return;
        }

        if (!password) {
          showToast('Please enter your Password.', 'error');
          passInput.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Signing In...';

        // Attempt 1: REST API (auto-detect Student first, then hidden Staff/Admin fallback)
        if (window.location.protocol !== 'file:') {
          try {
            const stuRes = await fetch(`${PUBLIC_BASE}api/auth/login.php`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentNumber: rawStudentNo,
                password: password
              })
            });

            const stuData = stuRes.ok ? await stuRes.json() : null;
            if (stuData && stuData.status === 'success') {
              storeStudentAndRedirect(stuData.data, studentNo);
              return;
            }

            const admData = await tryRemoteAdminLogin(rawStudentNo, password);
            if (admData && admData.status === 'success') {
              storeAdminAndRedirect(admData.data, rawStudentNo);
              return;
            }

            const errMsg = (admData && admData.message && admData.message.toLowerCase().includes('inactive'))
              ? admData.message
              : ((stuData && stuData.message && stuData.message.toLowerCase().includes('account is currently'))
                ? stuData.message
                : 'Invalid ID / Email or Password. Please try again.');

            submitBtn.disabled = false;
            submitBtn.innerText = 'Sign In';
            showToast(errMsg, 'error');
            passInput.classList.add('is-invalid');
            setTimeout(() => passInput.classList.remove('is-invalid'), 2000);
            return;
          } catch (apiErr) {
            console.info('Backend API unavailable. Proceeding with client session fallback:', apiErr.message);
          }
        }

        // Attempt 2: Local storage fallback (Student first, then Admin)
        setTimeout(() => {
          const users = getUsers();
          const matchedUser = users.find(u => cleanStudentNumber(u.studentNumber) === studentNo && u.password === password);

          if (matchedUser) {
            storeStudentAndRedirect(matchedUser, studentNo);
            return;
          }

          const matchedAdmin = matchOfflineAdmin(rawStudentNo, password);
          if (matchedAdmin) {
            storeAdminAndRedirect(matchedAdmin, rawStudentNo);
            return;
          }

          submitBtn.disabled = false;
          submitBtn.innerText = 'Sign In';
          showToast('Invalid Student Number or Password. Please try again.', 'error');
          passInput.classList.add('is-invalid');
          setTimeout(() => passInput.classList.remove('is-invalid'), 2000);
        }, 400);
      });
    }

    // ========================================================================
    // ADMIN REGISTRATION PAGE LOGIC
    // ========================================================================
    const adminRegisterForm = document.getElementById('adminRegisterForm');
    if (adminRegisterForm) {
      setupPasswordToggle('toggleRegAdminPasswordBtn', 'regAdminPassword', 'regAdminEyeIcon');

      adminRegisterForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const empInput = document.getElementById('regEmployeeId');
        const nameInput = document.getElementById('regFullName');
        const emailInput = document.getElementById('regAdminEmail');
        const roleSelect = document.getElementById('regRole');
        const passInput = document.getElementById('regAdminPassword');
        const confirmPassInput = document.getElementById('regAdminConfirmPassword');
        const submitBtn = document.getElementById('adminRegisterSubmitBtn');

        const employeeId = (empInput.value || '').trim();
        const fullName = (nameInput.value || '').trim();
        const email = (emailInput.value || '').trim();
        const role = roleSelect ? roleSelect.value : 'Circulation Desk Officer';
        const password = passInput.value;
        const confirmPassword = confirmPassInput.value;

        if (!employeeId) {
          showToast('Please enter an Employee ID.', 'error');
          empInput.focus();
          return;
        }

        if (!fullName) {
          showToast('Please enter your full name.', 'error');
          nameInput.focus();
          return;
        }

        if (!email.includes('@')) {
          showToast('Please enter a valid institutional email address.', 'error');
          emailInput.focus();
          return;
        }

        if (password.length < 8) {
          showToast('Password must be at least 8 characters.', 'error');
          passInput.focus();
          return;
        }

        if (password !== confirmPassword) {
          showToast('Passwords do not match.', 'error');
          confirmPassInput.focus();
          return;
        }

        const adminPrivacyCheckbox = document.getElementById('adminRegPrivacyConsent');
        if (adminPrivacyCheckbox && !adminPrivacyCheckbox.checked) {
          showToast('Please accept the Data Privacy & Accountability Notice to continue.', 'error');
          adminPrivacyCheckbox.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Creating Staff Account...';

        // Attempt 1: Call Backend REST API (api/adminRegister.php)
        if (window.location.protocol !== 'file:') {
          try {
            const apiRes = await fetch(`${PUBLIC_BASE}api/auth/adminRegister.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: employeeId,
                fullName: fullName,
                email: email,
                role: role,
                password: password,
                confirmPassword: confirmPassword
              })
            });

            const resData = await apiRes.json().catch(() => null);
            if (resData) {
              if (apiRes.ok && resData.status === 'success') {
                if (resData.pendingApproval) {
                  showToast(resData.message || 'Staff registration submitted for Head Librarian approval.', 'success');
                  setTimeout(() => {
                    window.location.href = `${PUBLIC_BASE}index.html`;
                  }, 1400);
                  return;
                }
                const createdRole = resData.data?.role || role;
                const newAdmin = {
                  employeeId: employeeId,
                  fullName: fullName,
                  email: email,
                  role: createdRole,
                  campus: 'Imus Campus'
                };
                if (!sessionStorage.getItem(SESSION_ADMIN_KEY)) {
                  sessionStorage.setItem(SESSION_ADMIN_KEY, JSON.stringify(newAdmin));
                }
                showToast(resData.message || 'Staff account created successfully via API!', 'success');
                setTimeout(() => {
                  window.location.href = `${PUBLIC_BASE}admin/admin-dashboard.html`;
                }, 800);
                return;
              } else if (resData.message) {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Register Staff Account';
                showToast(resData.message, 'error');
                return;
              }
            }
          } catch (apiErr) {
            console.info('Admin Registration API unavailable. Saving to client-side storage:', apiErr.message);
          }
        }

        // Attempt 2: Local storage fallback (file:// execution)
        setTimeout(() => {
          const admins = getAdmins();
          const exists = admins.some(a => a.employeeId.toLowerCase() === employeeId.toLowerCase() || a.email.toLowerCase() === email.toLowerCase());

          if (exists) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Register Staff Account';
            showToast('A staff account with that Employee ID or Email already exists.', 'error');
            return;
          }

          const newAdmin = {
            employeeId: employeeId,
            fullName: fullName,
            email: email,
            role: role,
            password: password,
            registeredAt: new Date().toISOString()
          };

          admins.push(newAdmin);
          saveAdmins(admins);

          sessionStorage.setItem(SESSION_ADMIN_KEY, JSON.stringify(newAdmin));
          showToast('Staff account successfully registered! Loading console...', 'success');

          setTimeout(() => {
            window.location.href = `${PUBLIC_BASE}admin/admin-dashboard.html`;
          }, 900);
        }, 500);
      });
    }

    // ========================================================================
    // ADMIN FORGOT PASSWORD LOGIC
    // ========================================================================
    const adminForgotForm = document.getElementById('adminForgotPasswordForm');
    if (adminForgotForm) {
      setupPasswordToggle('toggleAdminRecoveryPasswordBtn', 'recoveryAdminNewPassword', 'eyeAdminRecoveryIcon');
      adminForgotForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const empInput = document.getElementById('recoveryEmployeeId');
        const emailInput = document.getElementById('recoveryAdminEmail');
        const newPwInput = document.getElementById('recoveryAdminNewPassword');
        const submitBtn = document.getElementById('submitAdminRecoveryBtn');

        const empId = cleanStudentNumber(empInput.value);
        const email = (emailInput.value || '').trim().toLowerCase();
        const newPassword = newPwInput ? newPwInput.value : '';

        if (!empId || !email || newPassword.length < 8) {
          showToast('Provide Employee ID, Email, and a new password (min 8 chars).', 'error');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Resetting Password...';

        try {
          if (IS_HTTP) {
            const res = await fetch(`${PUBLIC_BASE}api/auth/resetPassword.php`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userType: 'admin', employeeId: empId, email, newPassword })
            });
            const json = await res.json();
            if (json.status === 'success') {
              showToast(json.message, 'success');
              setTimeout(() => { window.location.href = `${PUBLIC_BASE}index.html`; }, 1500);
              return;
            }
            showToast(json.message || 'Could not reset password.', 'error');
            return;
          }
          showToast(`Recovery instructions dispatched to ${email}!`, 'success');
          setTimeout(() => { window.location.href = `${PUBLIC_BASE}index.html`; }, 1500);
        } catch (err) {
          showToast('Network error while resetting password.', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Reset Staff Password';
        }
      });
    }

    // ========================================================================
    // STUDENT REGISTRATION PAGE LOGIC
    // ========================================================================
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      setupPasswordToggle('toggleRegPasswordBtn', 'regPassword', 'eyeRegIcon');
      setupPasswordToggle('toggleRegConfirmPasswordBtn', 'regConfirmPassword', 'eyeRegConfirmIcon');
      setupModal('portalGuideLink', 'portalGuideModal', 'closePortalGuideModal');
      applyDobBounds(document.getElementById('regDob'));

      const fillSampleBtn = document.getElementById('fillSampleRegisterBtn');
      if (fillSampleBtn) {
        fillSampleBtn.addEventListener('click', function () {
          const randomId = Math.floor(10000 + Math.random() * 90000);
          document.getElementById('regStudentNumber').value = `2024${randomId}`;
          document.getElementById('regEmail').value = `student.${randomId}@cvsu.edu.ph`;
          document.getElementById('regMobile').value = `0918${Math.floor(1000000 + Math.random() * 9000000)}`;
          document.getElementById('regDob').value = '2004-08-20';
          document.getElementById('regPassword').value = 'CvsuLibrary2024!';
          document.getElementById('regConfirmPassword').value = 'CvsuLibrary2024!';
          showToast('Sample registration details populated.', 'info');
        });
      }

      registerForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const studentInput = document.getElementById('regStudentNumber');
        const fullNameInput = document.getElementById('regFullName');
        const courseInput = document.getElementById('regCourse');
        const yearInput = document.getElementById('regYearLevel');
        const emailInput = document.getElementById('regEmail');
        const mobileInput = document.getElementById('regMobile');
        const dobInput = document.getElementById('regDob');
        const passInput = document.getElementById('regPassword');
        const confirmPassInput = document.getElementById('regConfirmPassword');
        const submitBtn = document.getElementById('submitRegBtn');

        const studentNo = cleanStudentNumber(studentInput.value);
        const fullName = fullNameInput ? fullNameInput.value.trim() : '';
        const course = courseInput ? courseInput.value : 'BS Information Technology';
        const yearLevel = yearInput ? yearInput.value : '1st Year';
        const email = emailInput.value.trim();
        const mobile = mobileInput.value.trim();
        const dob = dobInput.value;
        const password = passInput.value;
        const confirmPassword = confirmPassInput.value;

        if (!studentNo || studentNo.length < 6) {
          showToast('Please enter a valid Student Number (e.g. 202410123).', 'error');
          studentInput.focus();
          return;
        }

        if (fullNameInput && !fullName) {
          showToast('Please enter your Full Name.', 'error');
          fullNameInput.focus();
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          showToast('Please enter a valid email address.', 'error');
          emailInput.focus();
          return;
        }

        const mobileRegex = /^09\d{9}$/;
        if (!mobile || !mobileRegex.test(mobile)) {
          showToast('Mobile number must be 11 digits starting with 09 (e.g. 09123456789).', 'error');
          mobileInput.focus();
          return;
        }

        if (!isValidDob(dob)) {
          showToast('Please enter a valid Date of Birth (4-digit year, not in the future).', 'error');
          dobInput.focus();
          return;
        }

        if (password.length < 8) {
          showToast('Password must be at least 8 characters long.', 'error');
          passInput.focus();
          return;
        }

        if (password !== confirmPassword) {
          showToast('Passwords do not match. Please re-enter.', 'error');
          confirmPassInput.focus();
          return;
        }

        const regPrivacyCheckbox = document.getElementById('regPrivacyConsent');
        if (regPrivacyCheckbox && !regPrivacyCheckbox.checked) {
          showToast('Please agree to the Data Privacy Notice (RA 10173) before registering.', 'error');
          regPrivacyCheckbox.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Registering Account...';

        if (IS_HTTP) {
          try {
            const apiRes = await fetch(`${PUBLIC_BASE}api/auth/register.php`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentNumber: studentInput.value.trim(),
                fullName: fullName || `Student ${studentNo}`,
                course,
                yearLevel,
                email,
                mobile,
                dob,
                password,
                confirmPassword
              })
            });
            const resData = await apiRes.json().catch(() => null);
            if (apiRes.ok && resData && resData.status === 'success') {
              const registeredUser = {
                id: resData.data?.id,
                studentNumber: resData.data?.studentNumber || studentInput.value.trim(),
                fullName: resData.data?.fullName || fullName || `Student ${studentNo}`,
                email,
                mobile,
                dob,
                course: resData.data?.course || course,
                yearLevel: resData.data?.yearLevel || yearLevel,
                campus: 'Imus Campus',
                borrowedBooks: []
              };
              sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(registeredUser));
              showToast(resData.message || 'Account registered successfully!', 'success');
              setTimeout(() => {
                window.location.href = `${PUBLIC_BASE}user/pages/dashboard.html`;
              }, 800);
              return;
            }
            submitBtn.disabled = false;
            submitBtn.innerText = 'Register';
            showToast((resData && resData.message) || 'Could not complete registration.', 'error');
            return;
          } catch (apiErr) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Register';
            showToast('Network error while connecting to server.', 'error');
            return;
          }
        }

        setTimeout(() => {
          const users = getUsers();
          const studentExists = users.some(u => cleanStudentNumber(u.studentNumber) === studentNo);
          if (studentExists) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Register';
            showToast('Student Number is already registered! Please sign in.', 'error');
            studentInput.focus();
            return;
          }

          const newUser = {
            studentNumber: studentInput.value.trim(),
            fullName: fullName || `Student ${studentNo}`,
            email: email,
            mobile: mobile,
            dob: dob,
            password: password,
            course: course,
            yearLevel: yearLevel,
            campus: 'Imus Campus',
            registeredAt: new Date().toISOString(),
            borrowedBooks: []
          };

          users.push(newUser);
          saveUsers(users);

          sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(newUser));
          showToast('Account registered successfully! Welcome to the Library Portal.', 'success');

          setTimeout(() => {
            window.location.href = `${PUBLIC_BASE}user/pages/dashboard.html`;
          }, 1000);
        }, 500);
      });
    }

    // ========================================================================
    // STUDENT FORGOT PASSWORD LOGIC
    // ========================================================================
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
      setupPasswordToggle('toggleRecoveryPasswordBtn', 'recoveryNewPassword', 'eyeRecoveryIcon');
      applyDobBounds(document.getElementById('recoveryDob'));
      forgotForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const studentInput = document.getElementById('recoveryStudentNumber');
        const emailInput = document.getElementById('recoveryEmail');
        const dobInput = document.getElementById('recoveryDob');
        const newPwInput = document.getElementById('recoveryNewPassword');
        const submitBtn = document.getElementById('submitRecoveryBtn');

        const studentNo = cleanStudentNumber(studentInput.value);
        const email = emailInput.value.trim().toLowerCase();
        const dob = dobInput ? dobInput.value.trim() : '';
        const newPassword = newPwInput ? newPwInput.value : '';

        if (!studentNo || !email || !isValidDob(dob) || newPassword.length < 8) {
          showToast('Fill in Student Number, Email, valid Date of Birth (4-digit year), and a new password (min 8 chars).', 'error');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Resetting Password...';

        try {
          if (IS_HTTP) {
            const res = await fetch(`${PUBLIC_BASE}api/auth/resetPassword.php`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userType: 'student', studentNumber: studentNo, email, dateOfBirth: dob, newPassword })
            });
            const json = await res.json();
            if (res.ok && json.status === 'success') {
              showToast(json.message, 'success');
              setTimeout(() => { window.location.href = `${PUBLIC_BASE}index.html`; }, 1500);
              return;
            }
            showToast(json.message || 'Could not reset password.', 'error');
            return;
          }
          const users = getUsers();
          const matchedUser = users.find(u => cleanStudentNumber(u.studentNumber) === studentNo && u.email.toLowerCase() === email && (!u.dob || u.dob === dob));
          if (matchedUser) {
            matchedUser.password = newPassword;
            saveUsers(users);
            showToast(`Password reset for ${email}!`, 'success');
            setTimeout(() => { window.location.href = `${PUBLIC_BASE}index.html`; }, 1500);
          } else {
            showToast('No matching student account found with those details.', 'error');
          }
        } catch (err) {
          showToast('Network error while resetting password.', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Reset Password';
        }
      });
    }

  });

})();
