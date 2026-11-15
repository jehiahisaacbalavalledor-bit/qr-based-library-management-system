/**
 * Client-Side Route Guard & Server PHP Session Logout Sync
 */
(function (global) {
  'use strict';

  function getPublicBase() {
    const p = window.location.pathname.replace(/\\/g, '/');
    const idx = p.indexOf('/public/');
    if (idx !== -1) return p.slice(0, idx + '/public/'.length);
    if (/\/(?:admin|user)\/pages\/[^/]+\//.test(p)) return '../../../';
    if (p.includes('/admin/pages/') || p.includes('/user/pages/')) return '../../';
    if (p.includes('/admin/') || p.includes('/user/')) return '../';
    return './';
  }

  async function requireSession(expectedType, loginUrl, storageKey) {
    if (window.location.protocol === 'file:') {
      if (!sessionStorage.getItem(storageKey)) {
        window.location.replace(loginUrl);
        return null;
      }
      return { offline: true };
    }

    try {
      const res = await fetch(`${getPublicBase()}api/auth/session.php`, { credentials: 'same-origin' });
      const json = await res.json();
      const data = json && json.data ? json.data : null;

      if (!data || !data.authenticated || data.user_type !== expectedType) {
        sessionStorage.removeItem(storageKey);
        window.location.replace(loginUrl);
        return null;
      }

      // Sync lightweight display metadata if missing
      if (!sessionStorage.getItem(storageKey)) {
        if (expectedType === 'admin') {
          sessionStorage.setItem(storageKey, JSON.stringify({
            employeeId: data.employee_id,
            fullName: data.full_name,
            role: data.role
          }));
        } else {
          sessionStorage.setItem(storageKey, JSON.stringify({
            studentNumber: data.student_number,
            fullName: data.full_name
          }));
        }
      }
      return data;
    } catch (err) {
      if (!sessionStorage.getItem(storageKey)) {
        window.location.replace(loginUrl);
        return null;
      }
      return null;
    }
  }

  async function logout(loginUrl, storageKey) {
    sessionStorage.removeItem(storageKey);
    if (window.location.protocol !== 'file:') {
      try {
        await fetch(`${getPublicBase()}api/auth/logout.php`, {
          method: 'POST',
          credentials: 'same-origin'
        });
      } catch (e) {}
    }
    window.location.href = loginUrl;
  }

  global.CvsuRouteGuard = {
    requireSession,
    logout
  };
})(window);
