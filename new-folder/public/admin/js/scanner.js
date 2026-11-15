/**
 * Cavite State University - Imus Campus
 * Library Circulation QR Scanner Logic
 */

(function () {
  'use strict';

  const STORAGE_LOGS_KEY = 'cvsu_circulation_scan_logs';
  const LATEST_BORROW_PASS_KEY = 'cvsu_latest_borrow_pass';
  const STORAGE_USERS_KEY = 'cvsu_library_registered_users';

  let videoStream = null;
  let isScanning = false;
  let scanAnimationId = null;
  let lastScannedPayload = null;
  let currentDecodedData = null;

  // Synthesize realistic Library Barcode Scanner Beep
  function playScannerBeep() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1850, ctx.currentTime); // High crisp scanner frequency
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch (e) {
      console.warn('Audio Context tone could not be played:', e);
    }
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
    }, 3500);
  }

  // Retrieve Circulation Log History
  function getScanLogs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_LOGS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  // Save Circulation Log History
  function saveScanLogs(logs) {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs));
  }

  // Parse QR Code string into structured borrower object
  function parseQrPayload(raw) {
    if (!raw) return null;
    raw = raw.trim();

    // 1. Try JSON parsing
    try {
      const obj = JSON.parse(raw);

      // 1A. Scanned Book QR Code (New Dual QR System)
      if (obj.type === 'CVSU_BOOK_QR' || (obj.bookCode && !obj.studentNo)) {
        return {
          isBookOnly: true,
          type: 'CVSU_BOOK_QR',
          bookCode: obj.bookCode,
          accessionNo: obj.accessionNo || 'ACC-2026-N/A',
          callNo: obj.callNo || 'QA 76.6',
          book: obj.title || 'Library Catalog Book',
          author: obj.author || 'CvSU Author',
          category: obj.category || 'General Collection',
          isRoomUseOnly: obj.isRoomUseOnly ? true : false,
          studentNo: '202410001',
          name: 'Juan C. Dela Cruz',
          course: 'BS Information Technology',
          email: 'juan.delacruz@cvsu.edu.ph',
          mobile: '09171234567',
          ref: 'BRW-' + (obj.bookCode || '2026') + '-' + Math.floor(100 + Math.random() * 900),
          borrowDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
        };
      }

      if (obj.studentNo || obj.studentNumber) {
        return {
          studentNo: obj.studentNo || obj.studentNumber,
          name: obj.name || obj.fullName || `Student ${obj.studentNo || obj.studentNumber}`,
          course: obj.course || 'BS Information Technology',
          email: obj.email || `${obj.studentNo || obj.studentNumber}@cvsu.edu.ph`,
          mobile: obj.mobile || '09171234567',
          book: obj.book || obj.bookTitle || 'General Library Access',
          callNo: obj.callNo || obj.callNumber || 'GEN-LIB',
          bookCode: obj.bookCode || 'BK-LIB',
          loanType: obj.loanType || '3_days',
          ref: obj.ref || obj.referenceNo || ('REF-' + Math.floor(1000 + Math.random() * 9000)),
          borrowDate: obj.borrowDate || new Date().toISOString().split('T')[0],
          dueDate: obj.dueDate || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
        };
      }
    } catch (e) {
      // Not JSON, continue to next parsers
    }

    // 2. Try Pipe Delimited Format (CVSU_BORROW:202410001|Name|Course|Book|CallNo|Ref|BorrowDate|DueDate)
    if (raw.includes('|')) {
      let clean = raw.replace(/^CVSU_BORROW:/, '').replace(/^CVSU_STUDENT_ID:/, '');
      const parts = clean.split('|');
      return {
        studentNo: parts[0] || '202410001',
        name: parts[1] || 'Juan C. Dela Cruz',
        course: parts[2] || 'BS Information Technology',
        book: parts[3] || 'Library Book Collection',
        callNo: parts[4] || 'QA 76.6',
        ref: parts[5] || ('REF-' + Math.floor(1000 + Math.random() * 9000)),
        borrowDate: parts[6] || new Date().toISOString().split('T')[0],
        dueDate: parts[7] || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        mobile: '09171234567',
        email: `${parts[0] || 'student'}@cvsu.edu.ph`
      };
    }

    // 3. Fallback: Lookup Student from Registered Users
    try {
      const users = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY)) || [];
      const cleanInput = raw.replace(/[\s-]/g, '');
      const matched = users.find(u => (u.studentNumber || '').replace(/[\s-]/g, '') === cleanInput);
      if (matched) {
        return {
          studentNo: matched.studentNumber,
          name: matched.fullName || `Student ${matched.studentNumber}`,
          course: matched.course || 'BS Information Technology',
          email: matched.email || 'student@cvsu.edu.ph',
          mobile: matched.mobile || '09171234567',
          book: 'Clean Code: A Handbook of Agile Software Craftsmanship',
          callNo: 'QA 76.6 .C67',
          ref: 'BRW-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
          borrowDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
        };
      }
    } catch (e) {}

    // 4. Generic Fallback
    return {
      studentNo: raw.substring(0, 20),
      name: 'CvSU Student Borrower',
      course: 'CvSU - Imus Campus',
      email: 'student@cvsu.edu.ph',
      mobile: '09XXXXXXXXX',
      book: 'Library Book Loan',
      callNo: 'LIB-COLLECTION',
      ref: 'BRW-' + Math.floor(1000 + Math.random() * 9000),
      borrowDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    };
  }

  // Handle Successfully Scanned QR Code
  function handleScannedCode(rawPayload) {
    if (!rawPayload) return;
    if (rawPayload === lastScannedPayload) return; // Prevent duplicate rapid scans

    lastScannedPayload = rawPayload;
    setTimeout(() => { lastScannedPayload = null; }, 2500); // Reset after 2.5s

    // 1. Play library scanner beep
    playScannerBeep();

    // 2. Parse data
    const parsed = parseQrPayload(rawPayload);
    currentDecodedData = parsed;

    // 3. Visual Feedback
    const viewportBox = document.getElementById('viewportBox');
    if (viewportBox) {
      viewportBox.style.boxShadow = '0 0 0 4px #00ff88';
      setTimeout(() => { viewportBox.style.boxShadow = ''; }, 600);
    }

    // 4. Update UI
    const emptyState = document.getElementById('scannerEmptyState');
    const resultBox = document.getElementById('scannerResultBox');
    if (emptyState) emptyState.style.display = 'none';
    if (resultBox) {
      resultBox.classList.add('active');
      resultBox.classList.add('success-flash');
      setTimeout(() => resultBox.classList.remove('success-flash'), 800);
    }

    const resRefCode = document.getElementById('resRefCode');
    const resStudentName = document.getElementById('resStudentName');
    const resStudentNo = document.getElementById('resStudentNo');
    const resCourse = document.getElementById('resCourse');
    const resMobile = document.getElementById('resMobile');
    const resBookTitle = document.getElementById('resBookTitle');
    const resCallNo = document.getElementById('resCallNo');
    const resDueDate = document.getElementById('resDueDate');
    const resLoanDurationLabel = document.getElementById('resLoanDurationLabel');
    const resActiveQuota = document.getElementById('resActiveQuota');

    if (resRefCode) resRefCode.textContent = parsed.ref;
    if (resStudentName) resStudentName.textContent = parsed.name;
    if (resStudentNo) resStudentNo.textContent = parsed.studentNo;
    if (resCourse) resCourse.textContent = parsed.course;
    if (resMobile) resMobile.textContent = parsed.mobile;
    if (resBookTitle) resBookTitle.textContent = parsed.book;
    if (resCallNo) resCallNo.textContent = parsed.callNo;
    if (resDueDate) resDueDate.textContent = parsed.dueDate;
    if (resLoanDurationLabel) {
      const labels = { '1_day': '1 Day', '2_days': '2 Days', '3_days': '3 Days', 'overnight': 'Overnight (10:00 AM)' };
      resLoanDurationLabel.textContent = labels[parsed.loanType] || '3 Days';
    }
    if (resActiveQuota && window.CvsuCirculationEngine) {
      const engine = window.CvsuCirculationEngine;
      const activeCount = engine.getActiveLoansForStudent(parsed.studentNo).length;
      resActiveQuota.textContent = `Active Quota: ${activeCount} / ${engine.MAX_ACTIVE_BOOKS} Books`;
      if (activeCount >= engine.MAX_ACTIVE_BOOKS) {
        resActiveQuota.style.background = '#fee2e2';
        resActiveQuota.style.color = '#dc2626';
      } else {
        resActiveQuota.style.background = '#dcfce7';
        resActiveQuota.style.color = '#166534';
      }
    }

    if (parsed.isRoomUseOnly) {
      showToast(`🔒 Special Collection Alert: Room Use Only inside Library!`, 'error');
    } else if (parsed.isBookOnly) {
      showToast(`Book QR Read: ${parsed.book} (${parsed.callNo})`, 'success');
    } else {
      showToast(`QR Code Read: ${parsed.name} (${parsed.studentNo})`, 'success');
    }
  }

  // Render Recent Circulation History Table
  function renderScanLogsTable() {
    const tbody = document.getElementById('circulationLogTbody');
    if (!tbody) return;

    const logs = getScanLogs();
    tbody.innerHTML = '';

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 24px;">No circulation scans recorded yet. Use the camera or quick scan above.</td></tr>`;
      return;
    }

    logs.slice().reverse().forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span style="font-family: monospace; font-size: 11.5px; color: #64748b;">${log.time}</span></td>
        <td><strong>${log.studentNo}</strong></td>
        <td>${log.name}</td>
        <td><span style="font-size: 12px; color: #64748b;">${log.course}</span></td>
        <td><strong>${log.book}</strong></td>
        <td><code>${log.ref}</code></td>
        <td><span style="background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 10px;">${log.status || 'APPROVED'}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Camera Scanner Loop
  async function startCameraScanner() {
    const video = document.getElementById('scannerVideo');
    const statusText = document.getElementById('cameraStatusText');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (statusText) statusText.innerHTML = '<span>Camera not supported on this browser</span>';
      showToast('Camera API not supported. You can use Quick Test Scan.', 'error');
      return;
    }

    try {
      if (statusText) statusText.innerHTML = '<span class="status-dot-pulse"></span> <span>Starting camera...</span>';
      
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });

      video.srcObject = videoStream;
      await video.play();

      isScanning = true;
      if (statusText) statusText.innerHTML = '<span class="status-dot-pulse"></span> <span>Camera Active. Point QR Code here</span>';

      // BarcodeDetector loop (Chromium / Modern Edge / Chrome)
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });

        async function detectLoop() {
          if (!isScanning) return;
          try {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
              const barcodes = await barcodeDetector.detect(video);
              if (barcodes && barcodes.length > 0) {
                handleScannedCode(barcodes[0].rawValue);
              }
            }
          } catch (err) {
            // Frame detection error, continue
          }
          scanAnimationId = requestAnimationFrame(detectLoop);
        }

        scanAnimationId = requestAnimationFrame(detectLoop);
      } else {
        if (statusText) statusText.innerHTML = '<span class="status-dot-pulse"></span> <span>Camera active (Use Quick Scan or modern browser for live decoding)</span>';
      }

    } catch (err) {
      console.warn('Camera access error:', err);
      if (statusText) statusText.innerHTML = '<span>Camera access denied/unavailable</span>';
      showToast('Camera permission denied or camera unavailable. Please use Quick Test Scan.', 'info');
    }
  }

  function stopCameraScanner() {
    isScanning = false;
    if (scanAnimationId) {
      cancelAnimationFrame(scanAnimationId);
      scanAnimationId = null;
    }

    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }

    const video = document.getElementById('scannerVideo');
    if (video) video.srcObject = null;

    const statusText = document.getElementById('cameraStatusText');
    if (statusText) statusText.innerHTML = '<span>Camera stopped. Click Start Camera</span>';
  }

  // Render Smart Circulation Desk: Active Loans & Live Fine Engine
  function renderSmartCirculationDesk() {
    const engine = window.CvsuCirculationEngine;
    if (!engine) return;

    const simDateInput = document.getElementById('simReturnDate');
    const assessmentDate = (simDateInput && simDateInput.value) ? simDateInput.value : engine.toYmd(new Date());

    const activeTbody = document.getElementById('activeLoansTbody');
    if (activeTbody) {
      const loans = engine.getLoans().filter(l => l.status === 'borrowed' || l.status === 'overdue');
      activeTbody.innerHTML = '';

      if (loans.length === 0) {
        activeTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">No active borrowed books. Scan a QR code above to issue a loan.</td></tr>`;
      } else {
        loans.forEach(loan => {
          const calc = engine.calculateOverdueFine(loan.dueDate, assessmentDate);
          const isDueToday = loan.dueDate === assessmentDate;
          const statusBadge = calc.isOverdue
            ? `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">OVERDUE</span>`
            : (isDueToday
              ? `<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">DUE TODAY</span>`
              : `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">ACTIVE</span>`);

          const renewalCount = Number(loan.renewalCount || 0);
          const renewBadge = renewalCount > 0
            ? `<span style="background:#eff6ff;color:#1d4ed8;padding:1px 6px;border-radius:8px;font-size:10.5px;font-weight:700;margin-left:4px;">Extended ×${renewalCount}</span>`
            : '';
          const canRenew = !calc.isOverdue && renewalCount < 2;

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><code>${loan.ref}</code><br>${statusBadge}${renewBadge}</td>
            <td><strong>${loan.studentName}</strong><br><span style="font-size:11.5px;color:#64748b;">${loan.studentNo}</span></td>
            <td><strong>${loan.bookTitle}</strong><br><span style="font-size:11.5px;color:#64748b;">${loan.callNo} (${loan.loanType})</span></td>
            <td><strong>${loan.dueDate}</strong><br><span style="font-size:11px;color:#64748b;">Due ${loan.dueTime || '17:00'}</span></td>
            <td>
              <strong>${calc.overdueDays}</strong> chargeable day(s)<br>
              <span style="font-size:11px;color:#64748b;">Skipped ${calc.skippedDays} Fri–Sun/Holiday</span>
            </td>
            <td><strong style="color:${calc.fineAmount > 0 ? '#dc2626' : '#16a34a'};font-size:14px;">₱${calc.fineAmount.toFixed(2)}</strong></td>
            <td>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;gap:6px;align-items:center;">
                  <select class="return-condition-select" data-ref="${loan.ref}" style="padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:11.5px;">
                    <option value="good">Good</option>
                    <option value="damaged">Damaged</option>
                    <option value="lost">Lost</option>
                  </select>
                  <button type="button" class="btn-cam btn-process-return" data-ref="${loan.ref}" style="padding:4px 10px;font-size:11.5px;background:#00a65a;color:#fff;border-color:#008f4c;">
                    Return
                  </button>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                  <select class="renew-duration-select" data-ref="${loan.ref}" ${canRenew ? '' : 'disabled'} style="padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:11.5px;">
                    <option value="1_day">+1 Day</option>
                    <option value="2_days">+2 Days</option>
                    <option value="3_days">+3 Days</option>
                    <option value="overnight">Overnight</option>
                  </select>
                  <button type="button" class="btn-cam btn-process-renew" data-ref="${loan.ref}" ${canRenew ? '' : 'disabled'} title="${canRenew ? 'Extend loan due date' : (calc.isOverdue ? 'Cannot renew overdue loan' : 'Max 2 renewals reached')}" style="padding:4px 10px;font-size:11.5px;background:${canRenew ? '#0284c7' : '#94a3b8'};color:#fff;border-color:${canRenew ? '#0369a1' : '#94a3b8'};">
                    Renew
                  </button>
                </div>
              </div>
            </td>
          `;
          activeTbody.appendChild(tr);
        });

        activeTbody.querySelectorAll('.btn-process-return').forEach(btn => {
          btn.addEventListener('click', async function () {
            const ref = this.getAttribute('data-ref');
            const selectEl = activeTbody.querySelector(`.return-condition-select[data-ref="${ref}"]`);
            const condition = selectEl ? selectEl.value : 'good';
            const res = await engine.returnRemote(ref, assessmentDate, condition);
            if (res.ok) {
              const fineCalc = res.fineCalculation || {};
              const fineAmt = Number(fineCalc.fineAmount ?? fineCalc.fine_amount ?? 0);
              const logs = getScanLogs();
              logs.push({
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
                studentNo: res.loan.studentNo || res.loan.student_number,
                name: res.loan.studentName || res.loan.student_name,
                course: res.loan.course || 'CvSU Student',
                book: res.loan.bookTitle || res.loan.book_title,
                ref: res.loan.ref || res.loan.transaction_code,
                status: fineAmt > 0 ? `RETURNED (₱${fineAmt})` : 'RETURNED'
              });
              saveScanLogs(logs);
              renderScanLogsTable();
              renderSmartCirculationDesk();
              showToast(res.message, fineAmt > 0 ? 'error' : 'success');
            } else {
              showToast(res.message, 'error');
            }
          });
        });

        activeTbody.querySelectorAll('.btn-process-renew').forEach(btn => {
          btn.addEventListener('click', async function () {
            const ref = this.getAttribute('data-ref');
            const selectEl = activeTbody.querySelector(`.renew-duration-select[data-ref="${ref}"]`);
            const extType = selectEl ? selectEl.value : '1_day';
            const res = await engine.renewRemote(ref, extType, assessmentDate);
            if (res.ok) {
              const logs = getScanLogs();
              logs.push({
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
                studentNo: res.loan.studentNo || res.loan.student_number,
                name: res.loan.studentName || res.loan.student_name,
                course: res.loan.course || 'CvSU Student',
                book: res.loan.bookTitle || res.loan.book_title,
                ref: res.loan.ref || res.loan.transaction_code,
                status: `RENEWED (${res.loan.dueDate || res.loan.new_due_date})`
              });
              saveScanLogs(logs);
              renderScanLogsTable();
              renderSmartCirculationDesk();
              showToast(res.message, 'success');
            } else {
              showToast(res.message, 'error');
            }
          });
        });
      }
    }

    const finesTbody = document.getElementById('finesLedgerTbody');
    if (finesTbody) {
      const fines = engine.getFines();
      finesTbody.innerHTML = '';

      if (fines.length === 0) {
        finesTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 16px;">No overdue fines or replacement penalties recorded.</td></tr>`;
      } else {
        fines.forEach(fine => {
          const badge = fine.paymentStatus === 'paid'
            ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">PAID</span>`
            : (fine.paymentStatus === 'waived'
              ? `<span style="background:#e2e8f0;color:#475569;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">WAIVED</span>`
              : `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">UNPAID</span>`);

          const replacementNote = fine.replacementStatus === 'pending_replacement'
            ? `<div style="font-size:11px;color:#b45309;font-weight:600;">⚠ Identical Replacement Required</div>`
            : '';

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><code>${fine.ref}</code></td>
            <td><strong>${fine.studentName}</strong><br><span style="font-size:11.5px;color:#64748b;">${fine.studentNo}</span></td>
            <td>${fine.bookTitle}${replacementNote}</td>
            <td>${fine.overdueDays} days (Skipped ${fine.skippedDays})</td>
            <td><strong style="color:#dc2626;">₱${Number(fine.fineAmount).toFixed(2)}</strong></td>
            <td>${badge}</td>
            <td>
              ${fine.paymentStatus === 'unpaid' ? `
                <button type="button" class="btn-cam btn-settle-fine" data-id="${fine.id}" data-action="paid" style="padding:3px 8px;font-size:11px;background:#00a65a;color:#fff;">Mark Paid</button>
                <button type="button" class="btn-cam btn-settle-fine" data-id="${fine.id}" data-action="waived" style="padding:3px 8px;font-size:11px;">Waive</button>
              ` : `<span style="font-size:11.5px;color:#64748b;">Settled</span>`}
            </td>
          `;
          finesTbody.appendChild(tr);
        });

        finesTbody.querySelectorAll('.btn-settle-fine').forEach(btn => {
          btn.addEventListener('click', async function () {
            const fineId = this.getAttribute('data-id');
            const action = this.getAttribute('data-action');
            if (await engine.settleFineRemote(fineId, action)) {
              renderSmartCirculationDesk();
              showToast(`Fine marked as ${action.toUpperCase()}.`, 'success');
            }
          });
        });
      }
    }
  }

  // DOM Loaded
  document.addEventListener('DOMContentLoaded', async function () {
    if (window.CvsuRouteGuard) {
      const sessionData = await window.CvsuRouteGuard.requireSession('admin', '../../admin-index.html', 'cvsu_library_current_admin');
      if (!sessionData) return;
    }
    renderScanLogsTable();

    const simReturnDate = document.getElementById('simReturnDate');
    if (simReturnDate && window.CvsuCirculationEngine) {
      simReturnDate.value = window.CvsuCirculationEngine.toYmd(new Date());
      simReturnDate.addEventListener('change', function () {
        renderSmartCirculationDesk();
      });
    }
    renderSmartCirculationDesk();
    if (window.CvsuCirculationEngine) {
      window.CvsuCirculationEngine.syncFromServer().then(res => {
        if (res && res.ok) renderSmartCirculationDesk();
      });
    }

    // Start / Stop Camera Buttons
    const startCamBtn = document.getElementById('startCamBtn');
    const stopCamBtn = document.getElementById('stopCamBtn');

    if (startCamBtn) {
      startCamBtn.addEventListener('click', function () {
        startCameraScanner();
      });
    }

    if (stopCamBtn) {
      stopCamBtn.addEventListener('click', function () {
        stopCameraScanner();
      });
    }

    const manualQrInput = document.getElementById('manualQrInput');
    const manualQrDecodeBtn = document.getElementById('manualQrDecodeBtn');
    if (manualQrInput && manualQrDecodeBtn) {
      const submitManualQr = () => {
        const val = manualQrInput.value.trim();
        if (!val) return;
        handleScannedCode(val);
        manualQrInput.value = '';
      };
      manualQrDecodeBtn.addEventListener('click', submitManualQr);
      manualQrInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitManualQr();
        }
      });
    }

    // Try auto-starting camera if supported
    setTimeout(() => {
      startCameraScanner();
    }, 400);

    // Quick Test Scan 1: Latest Student Borrow Slip (Juan Dela Cruz)
    const quickScanStudentBtn = document.getElementById('quickScanStudentBtn');
    if (quickScanStudentBtn) {
      quickScanStudentBtn.addEventListener('click', function () {
        const savedPassStr = localStorage.getItem(LATEST_BORROW_PASS_KEY);
        let sampleData;

        if (savedPassStr) {
          sampleData = savedPassStr;
        } else {
          // Default pre-seeded test borrow slip
          sampleData = JSON.stringify({
            type: 'CVSU_BORROW',
            studentNo: '202410001',
            name: 'Juan C. Dela Cruz',
            course: 'BS in Information Technology',
            email: 'juan.delacruz@cvsu.edu.ph',
            mobile: '09171234567',
            book: 'Clean Code: A Handbook of Agile Software Craftsmanship',
            callNo: 'QA 76.6 .C67',
            ref: 'BRW-2026-8492',
            borrowDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
          });
        }

        handleScannedCode(sampleData);
      });
    }

    // Quick Test Scan 2: Student ID Pass (Maria Santos)
    const quickScanGeneralIdBtn = document.getElementById('quickScanGeneralIdBtn');
    if (quickScanGeneralIdBtn) {
      quickScanGeneralIdBtn.addEventListener('click', function () {
        const mariaData = JSON.stringify({
          type: 'CVSU_BORROW',
          studentNo: '202410452',
          name: 'Maria Elena R. Santos',
          course: 'BS Computer Science',
          email: 'maria.santos@cvsu.edu.ph',
          mobile: '09189876543',
          book: 'Database System Concepts (7th Edition)',
          callNo: 'QA 76.9 .D3 S54',
          ref: 'BRW-2026-7120',
          borrowDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
        });

        handleScannedCode(mariaData);
      });
    }

    // Quick Test Scan 3: Scanned Physical Book QR Sticker
    const quickScanBookQrBtn = document.getElementById('quickScanBookQrBtn');
    if (quickScanBookQrBtn) {
      quickScanBookQrBtn.addEventListener('click', function () {
        const bookData = JSON.stringify({
          type: 'CVSU_BOOK_QR',
          bookCode: 'BK-CVSU-001',
          accessionNo: 'ACC-2026-00101',
          callNo: 'QA 76.6 .C67',
          classification: '005.1',
          title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
          author: 'Robert C. Martin',
          category: 'Computer Science & IT',
          isRoomUseOnly: 0
        });
        handleScannedCode(bookData);
      });
    }

    // Quick Test Scan 4: Special Collection Book (Room Use Only)
    const quickScanSpecialBookBtn = document.getElementById('quickScanSpecialBookBtn');
    if (quickScanSpecialBookBtn) {
      quickScanSpecialBookBtn.addEventListener('click', function () {
        const specialBookData = JSON.stringify({
          type: 'CVSU_BOOK_QR',
          bookCode: 'BK-CVSU-006',
          accessionNo: 'ACC-SPEC-00001',
          callNo: 'FIL QA 76.2 .C8',
          classification: '378.599',
          title: 'CvSU Imus Campus Undergraduate IT Theses Compendium Vol. IV',
          author: 'CvSU Department of Computer Studies',
          category: 'Special Collections',
          isRoomUseOnly: 1
        });
        handleScannedCode(specialBookData);
      });
    }

    // File Upload QR Code Image Reader
    const qrFileInput = document.getElementById('qrFileInput');
    if (qrFileInput) {
      qrFileInput.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        showToast('Processing uploaded QR image...', 'info');

        const img = new Image();
        img.onload = async function () {
          if ('BarcodeDetector' in window) {
            try {
              const detector = new BarcodeDetector({ formats: ['qr_code'] });
              const barcodes = await detector.detect(img);
              if (barcodes && barcodes.length > 0) {
                handleScannedCode(barcodes[0].rawValue);
                return;
              }
            } catch (err) {
              console.warn(err);
            }
          }
          // Fallback if BarcodeDetector fails on static image: trigger quick scan
          const savedPassStr = localStorage.getItem(LATEST_BORROW_PASS_KEY);
          handleScannedCode(savedPassStr || '202410001');
        };
        img.src = URL.createObjectURL(file);
      });
    }

    // Approve & Record Borrowing Transaction Button
    const approveBtn = document.getElementById('approveBorrowBtn');
    if (approveBtn) {
      approveBtn.addEventListener('click', async function () {
        if (!currentDecodedData) return;

        // Enforce 2-book limit, Room-Use-Only, and Unpaid Fines via Smart Circulation Engine (MySQL + Local)
        if (window.CvsuCirculationEngine) {
          const checkoutRes = await window.CvsuCirculationEngine.borrowRemote({
            studentNo: currentDecodedData.studentNo,
            studentName: currentDecodedData.name,
            course: currentDecodedData.course,
            bookCode: currentDecodedData.bookCode || 'BK-LIB',
            bookTitle: currentDecodedData.book,
            callNo: currentDecodedData.callNo,
            loanType: currentDecodedData.loanType || '3_days',
            borrowDate: currentDecodedData.borrowDate,
            dueDate: currentDecodedData.dueDate,
            ref: currentDecodedData.ref,
            isRoomUseOnly: Boolean(currentDecodedData.isRoomUseOnly)
          });

          if (!checkoutRes.ok) {
            showToast(`❌ ${checkoutRes.message}`, 'error');
            return;
          }
          renderSmartCirculationDesk();
        }

        const now = new Date();
        const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString();

        const newLogEntry = {
          time: timeFormatted,
          studentNo: currentDecodedData.studentNo,
          name: currentDecodedData.name,
          course: currentDecodedData.course,
          book: currentDecodedData.book,
          ref: currentDecodedData.ref,
          status: 'BORROWED'
        };

        const logs = getScanLogs();
        logs.push(newLogEntry);
        saveScanLogs(logs);

        renderScanLogsTable();
        showToast(`✅ Book Loan Approved for ${currentDecodedData.name}! Transaction logged.`, 'success');

        // Reset view for next scan
        setTimeout(() => {
          const emptyState = document.getElementById('scannerEmptyState');
          const resultBox = document.getElementById('scannerResultBox');
          if (resultBox) resultBox.classList.remove('active');
          if (emptyState) emptyState.style.display = 'block';
          currentDecodedData = null;
        }, 1200);
      });
    }

    // Scan Next QR Button
    const scanNextBtn = document.getElementById('scanNextBtn');
    if (scanNextBtn) {
      scanNextBtn.addEventListener('click', function () {
        const emptyState = document.getElementById('scannerEmptyState');
        const resultBox = document.getElementById('scannerResultBox');
        if (resultBox) resultBox.classList.remove('active');
        if (emptyState) emptyState.style.display = 'block';
        currentDecodedData = null;
        showToast('Ready for next QR scan.', 'info');
      });
    }

    // Clear Circulation Log Button
    const clearLogBtn = document.getElementById('clearLogBtn');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', function () {
        if (confirm('Are you sure you want to clear the circulation scans log?')) {
          localStorage.removeItem(STORAGE_LOGS_KEY);
          renderScanLogsTable();
          showToast('Circulation logs cleared.', 'info');
        }
      });
    }

    // Hardware USB Scanner Keyboard Listener
    // Physical handheld 2D barcode scanner guns type characters fast and finish with 'Enter'
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    window.addEventListener('keydown', function (e) {
      // Ignore if user is typing into an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = ''; // Reset buffer if typing too slow (human typing)
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 4) {
          handleScannedCode(barcodeBuffer);
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    });

  });

})();
