/**
 * Cavite State University - Imus Campus
 * Student Portal & QR Library Borrowing Management System
 * Authentication & Client-side Session Handler
 */

(function () {
  'use strict';

  // Key for localStorage user database
  const STORAGE_USERS_KEY = 'cvsu_library_registered_users';
  const SESSION_USER_KEY = 'cvsu_library_current_user';

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

  initializeDefaultUsers();

  // Helper: Retrieve all users
  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_USERS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  // Helper: Save users
  function saveUsers(users) {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  }

  // Helper: Normalize Student Number (strips hyphens and spaces)
  function cleanStudentNumber(str) {
    return (str || '').replace(/[\s-]/g, '').trim();
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
          // Eye Slash icon
          icon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          `;
        } else {
          // Normal Eye icon
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
    
    // ------------------------------------------------------------------------
    // LOGIN PAGE LOGIC
    // ------------------------------------------------------------------------
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

      loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const studentInput = document.getElementById('studentNumber');
        const passInput = document.getElementById('password');
        const submitBtn = document.getElementById('submitBtn');

        const rawStudentNo = studentInput.value.trim();
        const studentNo = cleanStudentNumber(rawStudentNo);
        const password = passInput.value;

        // Simple validation
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

        // Attempt 1: Call REST API (api/login.php)
        let apiSucceeded = false;
        if (window.location.protocol !== 'file:') {
          try {
            const apiRes = await fetch('api/login.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentNumber: rawStudentNo,
                password: password
              })
            });

            if (apiRes.ok) {
              const resData = await apiRes.json();
              if (resData.status === 'success') {
                apiSucceeded = true;
                const loggedInUser = {
                  studentNumber: resData.data.studentNumber || studentNo,
                  fullName: resData.data.fullName || `Student ${studentNo}`,
                  email: resData.data.email || `${studentNo}@cvsu.edu.ph`,
                  course: resData.data.course || 'BS in Information Technology',
                  campus: 'Imus Campus'
                };
                sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(loggedInUser));
                showToast('API Login verified! Redirecting...', 'success');
                setTimeout(() => {
                  window.location.href = 'dashboard.html';
                }, 700);
                return;
              } else if (resData.message) {
                // Real API rejected with message (e.g. invalid credentials)
                submitBtn.disabled = false;
                submitBtn.innerText = 'Sign In';
                showToast(resData.message, 'error');
                passInput.classList.add('is-invalid');
                setTimeout(() => passInput.classList.remove('is-invalid'), 2000);
                return;
              }
            }
          } catch (apiErr) {
            console.info('Backend API unavailable. Proceeding with client session fallback:', apiErr.message);
          }
        }

        // Attempt 2: Local storage fallback (for offline or standalone presentation)
        setTimeout(() => {
          const users = getUsers();
          const matchedUser = users.find(u => cleanStudentNumber(u.studentNumber) === studentNo && u.password === password);

          if (matchedUser) {
            sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(matchedUser));
            showToast('Sign in successful! Redirecting to library portal...', 'success');
            setTimeout(() => {
              window.location.href = 'dashboard.html';
            }, 800);
          } else {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Sign In';
            showToast('Invalid Student Number or Password. Please try again.', 'error');
            passInput.classList.add('is-invalid');
            setTimeout(() => passInput.classList.remove('is-invalid'), 2000);
          }
        }, 400);
      });
    }

    // ------------------------------------------------------------------------
    // REGISTRATION PAGE LOGIC
    // ------------------------------------------------------------------------
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      setupPasswordToggle('toggleRegPasswordBtn', 'regPassword', 'eyeRegIcon');
      setupPasswordToggle('toggleRegConfirmPasswordBtn', 'regConfirmPassword', 'eyeRegConfirmIcon');
      setupModal('portalGuideLink', 'portalGuideModal', 'closePortalGuideModal');

      // Sample auto-fill for testing registration quickly
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
        const emailInput = document.getElementById('regEmail');
        const mobileInput = document.getElementById('regMobile');
        const dobInput = document.getElementById('regDob');
        const passInput = document.getElementById('regPassword');
        const confirmPassInput = document.getElementById('regConfirmPassword');
        const submitBtn = document.getElementById('submitRegBtn');

        const studentNo = cleanStudentNumber(studentInput.value);
        const email = emailInput.value.trim();
        const mobile = mobileInput.value.trim();
        const dob = dobInput.value;
        const password = passInput.value;
        const confirmPassword = confirmPassInput.value;

        // 1. Student Number Check
        if (!studentNo || studentNo.length < 6) {
          showToast('Please enter a valid Student Number (e.g. 202410123).', 'error');
          studentInput.focus();
          return;
        }

        // 2. Email Check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          showToast('Please enter a valid email address.', 'error');
          emailInput.focus();
          return;
        }

        // 3. Mobile Number Check (PH Format 09XXXXXXXXX)
        const mobileRegex = /^09\d{9}$/;
        if (!mobile || !mobileRegex.test(mobile)) {
          showToast('Mobile number must be 11 digits starting with 09 (e.g. 09123456789).', 'error');
          mobileInput.focus();
          return;
        }

        // 4. Date of Birth Check
        if (!dob) {
          showToast('Please specify your Date of Birth.', 'error');
          dobInput.focus();
          return;
        }

        // 5. Password Length
        if (password.length < 6) {
          showToast('Password must be at least 6 characters long.', 'error');
          passInput.focus();
          return;
        }

        // 6. Password Match
        if (password !== confirmPassword) {
          showToast('Passwords do not match. Please re-enter.', 'error');
          confirmPassInput.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Registering Account...';

        // Attempt 1: Call REST API (api/register.php)
        if (window.location.protocol !== 'file:') {
          try {
            const apiRes = await fetch('api/register.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentNumber: studentInput.value.trim(),
                email: email,
                mobile: mobile,
                dob: dob,
                password: password,
                confirmPassword: confirmPassword
              })
            });

            if (apiRes.ok) {
              const resData = await apiRes.json();
              if (resData.status === 'success') {
                const newUser = {
                  studentNumber: studentInput.value.trim(),
                  fullName: resData.data.fullName || `Student ${studentNo}`,
                  email: email,
                  mobile: mobile,
                  dob: dob,
                  course: 'Cavite State University Student',
                  campus: 'Imus Campus',
                  registeredAt: new Date().toISOString(),
                  borrowedBooks: []
                };
                sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(newUser));
                showToast('Registration complete via API! Welcome to Library Portal.', 'success');
                setTimeout(() => {
                  window.location.href = 'dashboard.html';
                }, 900);
                return;
              } else if (resData.message) {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Register';
                showToast(resData.message, 'error');
                return;
              }
            }
          } catch (err) {
            console.info('Backend API unavailable. Saving to client-side database:', err.message);
          }
        }

        // Attempt 2: Check if student number or email already exists in local storage
        const users = getUsers();
        const studentExists = users.some(u => cleanStudentNumber(u.studentNumber) === studentNo);
        if (studentExists) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Register';
          showToast('Student Number is already registered! Please sign in.', 'error');
          studentInput.focus();
          return;
        }

        const emailExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
        if (emailExists) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Register';
          showToast('This email address is already registered to another account.', 'error');
          emailInput.focus();
          return;
        }

        setTimeout(() => {
          const newUser = {
            studentNumber: studentInput.value.trim(),
            fullName: `Student ${studentNo}`,
            email: email,
            mobile: mobile,
            dob: dob,
            password: password,
            course: 'Cavite State University Student',
            campus: 'Imus Campus',
            registeredAt: new Date().toISOString(),
            borrowedBooks: []
          };

          users.push(newUser);
          saveUsers(users);

          // Automatically log user in
          sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(newUser));

          showToast('Account registered successfully! Welcome to the Library Portal.', 'success');

          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 1000);
        }, 500);
      });
    }

    // ------------------------------------------------------------------------
    // FORGOT PASSWORD PAGE LOGIC
    // ------------------------------------------------------------------------
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
      forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const studentInput = document.getElementById('recoveryStudentNumber');
        const emailInput = document.getElementById('recoveryEmail');
        const submitBtn = document.getElementById('submitRecoveryBtn');

        const studentNo = cleanStudentNumber(studentInput.value);
        const email = emailInput.value.trim().toLowerCase();

        if (!studentNo || !email) {
          showToast('Please fill in both Student Number and Email Address.', 'error');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Verifying...';

        setTimeout(() => {
          const users = getUsers();
          const matchedUser = users.find(u => cleanStudentNumber(u.studentNumber) === studentNo && u.email.toLowerCase() === email);

          submitBtn.disabled = false;
          submitBtn.innerText = 'Send Reset Link';

          if (matchedUser) {
            showToast(`Password reset link sent to ${email}! Check your inbox.`, 'success');
            setTimeout(() => {
              window.location.href = 'index.html';
            }, 2500);
          } else {
            showToast('No matching student account found with those details.', 'error');
          }
        }, 600);
      });
    }

  });

})();

