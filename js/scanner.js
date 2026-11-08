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
      if (obj.studentNo || obj.studentNumber) {
        return {
          studentNo: obj.studentNo || obj.studentNumber,
          name: obj.name || obj.fullName || `Student ${obj.studentNo || obj.studentNumber}`,
          course: obj.course || 'BS Information Technology',
          email: obj.email || `${obj.studentNo || obj.studentNumber}@cvsu.edu.ph`,
          mobile: obj.mobile || '09171234567',
          book: obj.book || obj.bookTitle || 'General Library Access',
          callNo: obj.callNo || obj.callNumber || 'GEN-LIB',
          ref: obj.ref || obj.referenceNo || ('REF-' + Math.floor(1000 + Math.random() * 9000)),
          borrowDate: obj.borrowDate || new Date().toISOString().split('T')[0],
          dueDate: obj.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
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

    if (resRefCode) resRefCode.textContent = parsed.ref;
    if (resStudentName) resStudentName.textContent = parsed.name;
    if (resStudentNo) resStudentNo.textContent = parsed.studentNo;
    if (resCourse) resCourse.textContent = parsed.course;
    if (resMobile) resMobile.textContent = parsed.mobile;
    if (resBookTitle) resBookTitle.textContent = parsed.book;
    if (resCallNo) resCallNo.textContent = parsed.callNo;
    if (resDueDate) resDueDate.textContent = parsed.dueDate;

    showToast(`QR Code Read: ${parsed.name} (${parsed.studentNo})`, 'success');
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

  // DOM Loaded
  document.addEventListener('DOMContentLoaded', function () {
    renderScanLogsTable();

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
      approveBtn.addEventListener('click', function () {
        if (!currentDecodedData) return;

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
