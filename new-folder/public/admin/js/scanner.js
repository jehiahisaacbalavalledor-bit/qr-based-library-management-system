/**
 * Cavite State University - Imus Campus
 * Library Circulation QR Scanner Logic
 */

(function () {
  'use strict';

  const STORAGE_LOGS_KEY = 'cvsu_circulation_scan_logs';
  const STORAGE_USERS_KEY = 'cvsu_library_registered_users';

  let videoStream = null;
  let isScanning = false;
  let scanAnimationId = null;
  let lastScannedPayload = null;
  let currentDecodedData = null;
  let cachedStudentsMap = new Map();
  let decodeCanvas = null;

  function computeOtsuThreshold(rgba) {
    const hist = new Uint32Array(256);
    const totalPixels = rgba.length >> 2;
    for (let i = 0; i < rgba.length; i += 4) {
      const a = rgba[i + 3];
      const lum = a < 128 ? 255 : ((77 * rgba[i] + 150 * rgba[i + 1] + 29 * rgba[i + 2]) >> 8);
      hist[lum]++;
    }
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0;
    let wB = 0;
    let maxVar = -1;
    let thresholdSum = 0;
    let thresholdCount = 0;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = totalPixels - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const betweenVar = wB * wF * (mB - mF) * (mB - mF);
      if (betweenVar > maxVar) {
        maxVar = betweenVar;
        thresholdSum = t;
        thresholdCount = 1;
      } else if (betweenVar === maxVar) {
        thresholdSum += t;
        thresholdCount++;
      }
    }
    return thresholdCount > 0 ? Math.round(thresholdSum / thresholdCount) : 128;
  }

  function runJsQrOnCanvasRegion(source, sx, sy, sw, sh, targetW, targetH, mirror = false) {
    if (typeof window.jsQR !== 'function' || targetW < 32 || targetH < 32) return null;
    if (!decodeCanvas) decodeCanvas = document.createElement('canvas');
    if (decodeCanvas.width !== targetW) decodeCanvas.width = targetW;
    if (decodeCanvas.height !== targetH) decodeCanvas.height = targetH;
    const ctx = decodeCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = targetW > sw || targetH > sh ? false : true;
    if (mirror) {
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetW, targetH);
    ctx.restore();

    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const direct = window.jsQR(imgData.data, targetW, targetH, { inversionAttempts: 'attemptBoth' });
    if (direct && direct.data) return direct.data;

    // Adaptive Otsu binarization for colored QR codes (e.g. CvSU green #00875a) & varying webcam lighting
    const cutoff = computeOtsuThreshold(imgData.data);
    const binarized = new Uint8ClampedArray(imgData.data);
    for (let i = 0; i < binarized.length; i += 4) {
      const a = binarized[i + 3];
      const lum = a < 128 ? 255 : ((77 * binarized[i] + 150 * binarized[i + 1] + 29 * binarized[i + 2]) >> 8);
      const bw = lum < cutoff ? 0 : 255;
      binarized[i] = bw;
      binarized[i + 1] = bw;
      binarized[i + 2] = bw;
      binarized[i + 3] = 255;
    }
    const bwMatch = window.jsQR(binarized, targetW, targetH, { inversionAttempts: 'attemptBoth' });
    return bwMatch && bwMatch.data ? bwMatch.data : null;
  }

  function decodeQrFromImageElement(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    const attempts = [
      { sx: 0, sy: 0, sw: w, sh: h, tw: w, th: h },
      { sx: 0, sy: 0, sw: w, sh: h, tw: Math.max(420, Math.min(900, Math.round(w * 1.5))), th: Math.max(420, Math.min(900, Math.round(h * 1.5))) }
    ];
    if (w > 900 || h > 900) {
      const scale = 800 / Math.max(w, h);
      attempts.push({ sx: 0, sy: 0, sw: w, sh: h, tw: Math.round(w * scale), th: Math.round(h * scale) });
    }
    // Center crop pass for full card screenshots containing headers/footers around the QR
    const cw = Math.round(w * 0.78);
    const ch = Math.round(h * 0.72);
    const cx = Math.round((w - cw) / 2);
    const cy = Math.round((h - ch) / 2);
    attempts.push({ sx: cx, sy: cy, sw: cw, sh: ch, tw: Math.max(480, cw), th: Math.max(480, ch) });
    // Lower-middle crop for Student QR ID card screenshots (header above QR)
    const ly = Math.round(h * 0.22);
    const lh = Math.round(h * 0.68);
    attempts.push({ sx: Math.round(w * 0.08), sy: ly, sw: Math.round(w * 0.84), sh: lh, tw: 560, th: Math.round(560 * (lh / (w * 0.84))) });

    for (const a of attempts) {
      const decoded = runJsQrOnCanvasRegion(img, a.sx, a.sy, a.sw, a.sh, Math.max(64, a.tw), Math.max(64, a.th));
      if (decoded) return decoded;
    }
    return null;
  }

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
        const sNo = String(obj.studentNo || obj.studentNumber);
        const stuRec = cachedStudentsMap.get(sNo.replace(/[\s-]/g, '')) || null;
        const isStudentIdOnly = obj.type === 'CVSU_STUDENT_ID' || (!obj.bookCode && !obj.book && !obj.bookTitle);
        return {
          isStudentIdOnly,
          studentNo: sNo,
          name: obj.name || obj.fullName || (stuRec ? stuRec.full_name : `Student ${sNo}`),
          course: obj.course || (stuRec ? stuRec.course : 'BS Information Technology'),
          email: obj.email || (stuRec ? stuRec.email : `${sNo}@cvsu.edu.ph`),
          mobile: obj.mobile || (stuRec && stuRec.mobile_number ? stuRec.mobile_number : 'See Student Record'),
          book: obj.book || obj.bookTitle || 'Select a book below',
          callNo: obj.callNo || obj.callNumber || '—',
          bookCode: obj.bookCode || '',
          loanType: obj.loanType || '3_days',
          ref: obj.ref || obj.referenceNo || ('BRW-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4) + Math.floor(10 + Math.random() * 90)),
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

    const pickerWrap = document.getElementById('resBookPickerWrap');
    const bookSel = document.getElementById('resBookSelect');
    const loanSel = document.getElementById('resLoanTypeSelect');
    if (pickerWrap && bookSel && window.CvsuCirculationEngine) {
      if (parsed.isStudentIdOnly) {
        const catalog = window.CvsuCirculationEngine.getCatalog();
        bookSel.innerHTML = catalog.map(b => {
          const avail = Number(b.available_copies || 0);
          const roomTag = Number(b.is_room_use_only) === 1 ? ' [Room Use]' : '';
          return `<option value="${b.book_code}" data-title="${b.title}" data-call="${b.call_number}" data-room="${b.is_room_use_only}" ${avail <= 0 ? 'disabled' : ''}>${b.book_code} — ${b.title} (${avail} avail)${roomTag}</option>`;
        }).join('');
        const firstEnabled = Array.from(bookSel.options).find(o => !o.disabled);
        if (firstEnabled) bookSel.value = firstEnabled.value;

        const syncPickerToDecoded = () => {
          const opt = bookSel.options[bookSel.selectedIndex];
          const lt = loanSel ? loanSel.value : '3_days';
          const dueInfo = window.CvsuCirculationEngine.computeDueDate(parsed.borrowDate, lt);
          if (opt) {
            parsed.bookCode = opt.value;
            parsed.book = opt.getAttribute('data-title') || opt.textContent;
            parsed.callNo = opt.getAttribute('data-call') || 'N/A';
            parsed.isRoomUseOnly = opt.getAttribute('data-room') === '1';
          }
          parsed.loanType = lt;
          parsed.dueDate = dueInfo.dueDate;
          if (resBookTitle) resBookTitle.textContent = parsed.book;
          if (resCallNo) resCallNo.textContent = parsed.callNo;
          if (resDueDate) resDueDate.textContent = parsed.dueDate;
          if (resLoanDurationLabel) resLoanDurationLabel.textContent = dueInfo.label;
        };
        bookSel.onchange = syncPickerToDecoded;
        if (loanSel) loanSel.onchange = syncPickerToDecoded;
        syncPickerToDecoded();
        pickerWrap.style.display = 'block';
      } else {
        pickerWrap.style.display = 'none';
      }
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

  async function populateCameraList(activeDeviceId) {
    const wrap = document.getElementById('cameraSelectWrap');
    const select = document.getElementById('cameraSelect');
    if (!wrap || !select || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      if (cams.length <= 1) {
        wrap.style.display = 'none';
        return;
      }
      select.innerHTML = '';
      cams.forEach((cam, idx) => {
        const opt = document.createElement('option');
        opt.value = cam.deviceId;
        opt.textContent = cam.label || `Camera ${idx + 1}`;
        if (activeDeviceId && cam.deviceId === activeDeviceId) opt.selected = true;
        select.appendChild(opt);
      });
      wrap.style.display = 'flex';
    } catch (e) {}
  }

  function decodeCameraFrame(video, frameCount) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || typeof window.jsQR !== 'function') return null;

    // 1. Center square ROI matching the green viewfinder overlay (eliminates room clutter & boosts module size)
    const roiSide = Math.round(Math.min(vw, vh) * 0.72);
    const rx = Math.max(0, Math.round((vw - roiSide) / 2));
    const ry = Math.max(0, Math.round((vh - roiSide) / 2));
    const roiTarget = Math.min(640, Math.max(420, roiSide));
    const centerHit = runJsQrOnCanvasRegion(video, rx, ry, roiSide, roiSide, roiTarget, roiTarget, false);
    if (centerHit) return centerHit;

    // 2. Full frame fallback (handles QR codes held closer or slightly off-center)
    const fullScale = Math.min(1, 640 / Math.max(vw, vh));
    const fw = Math.max(160, Math.round(vw * fullScale));
    const fh = Math.max(120, Math.round(vh * fullScale));
    const fullHit = runJsQrOnCanvasRegion(video, 0, 0, vw, vh, fw, fh, false);
    if (fullHit) return fullHit;

    // 3. Periodic horizontally-mirrored ROI pass for laptop/virtual webcams that mirror hardware streams
    if (frameCount % 3 === 0) {
      return runJsQrOnCanvasRegion(video, rx, ry, roiSide, roiSide, roiTarget, roiTarget, true);
    }
    return null;
  }

  // Camera Scanner Loop
  async function startCameraScanner(preferredDeviceId) {
    const video = document.getElementById('scannerVideo');
    const statusText = document.getElementById('cameraStatusText');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (statusText) statusText.innerHTML = '<span>Camera not supported on this browser</span>';
      showToast('Camera API not supported. You can use Quick Test Scan.', 'error');
      return;
    }

    stopCameraScanner(true);

    try {
      if (statusText) statusText.innerHTML = '<span class="status-dot-pulse"></span> <span>Starting camera...</span>';

      const selectedId = preferredDeviceId || (document.getElementById('cameraSelect')?.value || '');
      const baseConstraints = selectedId
        ? { deviceId: { exact: selectedId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } };

      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: baseConstraints });
      } catch (constraintErr) {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const activeTrack = videoStream.getVideoTracks()[0];
      if (activeTrack && activeTrack.applyConstraints) {
        activeTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      }
      const activeSettings = activeTrack && activeTrack.getSettings ? activeTrack.getSettings() : {};
      populateCameraList(activeSettings.deviceId || selectedId);

      video.srcObject = videoStream;
      await video.play();

      isScanning = true;
      if (statusText) statusText.innerHTML = '<span class="status-dot-pulse"></span> <span>Camera Active. Center QR code inside box</span>';

      // Verify BarcodeDetector truly supports qr_code (avoid stalling frames on unsupported Windows implementations)
      let barcodeDetector = null;
      if ('BarcodeDetector' in window) {
        try {
          const formats = typeof BarcodeDetector.getSupportedFormats === 'function'
            ? await BarcodeDetector.getSupportedFormats()
            : ['qr_code'];
          if (Array.isArray(formats) && formats.includes('qr_code')) {
            barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
          }
        } catch (bdInitErr) {
          barcodeDetector = null;
        }
      }
      const useJsQr = (typeof window.jsQR === 'function');

      if (barcodeDetector || useJsQr) {
        let lastFrameCheck = 0;
        let frameCount = 0;
        async function detectLoop(ts) {
          if (!isScanning) return;
          try {
            const nowMs = ts || Date.now();
            if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0 && (!lastFrameCheck || nowMs - lastFrameCheck >= 120)) {
              lastFrameCheck = nowMs;
              frameCount++;
              let rawDecoded = null;
              if (useJsQr) {
                rawDecoded = decodeCameraFrame(video, frameCount);
              }
              if (!rawDecoded && barcodeDetector && frameCount % 2 === 0) {
                try {
                  const barcodes = await barcodeDetector.detect(video);
                  if (barcodes && barcodes.length > 0) rawDecoded = barcodes[0].rawValue;
                } catch (bdErr) {}
              }
              if (rawDecoded) {
                handleScannedCode(rawDecoded);
              }
            }
          } catch (err) {
            // Frame detection error, continue
          }
          if (isScanning) scanAnimationId = requestAnimationFrame(detectLoop);
        }

        scanAnimationId = requestAnimationFrame(detectLoop);
      } else {
        if (statusText) statusText.innerHTML = '<span class="status-dot-pulse"></span> <span>Camera active (Use Upload QR Image or Quick Scan)</span>';
      }

    } catch (err) {
      console.warn('Camera access error:', err);
      if (statusText) statusText.innerHTML = '<span>Camera access denied/unavailable</span>';
      showToast('Camera permission denied or camera unavailable. Please use Quick Test Scan.', 'info');
    }
  }

  function stopCameraScanner(silent = false) {
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

    if (!silent) {
      const statusText = document.getElementById('cameraStatusText');
      if (statusText) statusText.innerHTML = '<span>Camera stopped. Click Start Camera</span>';
    }
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
              showLastTransactionReceipt({
                type: 'RETURN RECEIPT',
                ref: res.loan.ref || res.loan.transaction_code || ref,
                student: `${res.loan.studentName || res.loan.student_name || 'Borrower'} (${res.loan.studentNo || res.loan.student_number || 'N/A'})`,
                book: res.loan.bookTitle || res.loan.book_title || ref,
                extra: `Condition: ${condition.toUpperCase()} | Returned: ${assessmentDate} | Fine: ₱${fineAmt.toFixed(2)}`,
                timestamp: new Date().toLocaleString()
              });
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
              showLastTransactionReceipt({
                type: 'RENEWAL RECEIPT',
                ref: res.loan.ref || res.loan.transaction_code || ref,
                student: `${res.loan.studentName || res.loan.student_name || 'Borrower'} (${res.loan.studentNo || res.loan.student_number || 'N/A'})`,
                book: res.loan.bookTitle || res.loan.book_title || ref,
                extra: `New Due Date: ${res.loan.dueDate || res.loan.new_due_date || 'Updated'}`,
                timestamp: new Date().toLocaleString()
              });
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
            ? `<div style="font-size:11px;color:#b45309;font-weight:600;">⚠ Identical Replacement Required (ISBN: ${fine.isbn || 'N/A'} | Acc: ${fine.accessionNumber || 'N/A'})</div>`
            : (fine.replacementStatus === 'replaced'
              ? `<div style="font-size:11px;color:#15803d;font-weight:600;">✓ Identical Replacement Verified &amp; Restored</div>`
              : '');

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><code>${fine.ref}</code></td>
            <td><strong>${fine.studentName}</strong><br><span style="font-size:11.5px;color:#64748b;">${fine.studentNo}</span></td>
            <td>${fine.bookTitle}${replacementNote}</td>
            <td>${fine.overdueDays} days (Skipped ${fine.skippedDays})</td>
            <td><strong style="color:#dc2626;">₱${Number(fine.fineAmount).toFixed(2)}</strong></td>
            <td>${badge}</td>
            <td>
              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                ${fine.paymentStatus === 'unpaid' ? `
                  <button type="button" class="btn-cam btn-settle-fine" data-id="${fine.id}" data-action="paid" style="padding:3px 8px;font-size:11px;background:#00a65a;color:#fff;">Mark Paid</button>
                  <button type="button" class="btn-cam btn-settle-fine" data-id="${fine.id}" data-action="waived" style="padding:3px 8px;font-size:11px;">Waive</button>
                ` : ''}
                ${fine.replacementStatus === 'pending_replacement' ? `
                  <button type="button" class="btn-cam btn-settle-fine" data-id="${fine.id}" data-action="replaced" style="padding:3px 8px;font-size:11px;background:#d97706;color:#fff;">Mark Replaced</button>
                ` : ''}
                ${fine.paymentStatus !== 'unpaid' && fine.replacementStatus !== 'pending_replacement' ? `<span style="font-size:11.5px;color:#64748b;">Settled</span>` : ''}
              </div>
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
              showToast(action === 'replaced' ? 'Identical book replacement recorded & inventory updated.' : `Fine marked as ${action.toUpperCase()}.`, 'success');
            }
          });
        });
      }
    }
  }

  let lastReceiptData = null;
  function escReceiptHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  function showLastTransactionReceipt(receipt) {
    lastReceiptData = receipt;
    const box = document.getElementById('lastTxnReceiptBox');
    if (!box || !receipt) return;
    const badgeEl = document.getElementById('receiptTypeBadge');
    const refEl = document.getElementById('receiptRef');
    const stuEl = document.getElementById('receiptStudent');
    const bookEl = document.getElementById('receiptBook');
    const extraEl = document.getElementById('receiptExtra');
    const tsEl = document.getElementById('receiptTimestamp');

    if (badgeEl) {
      badgeEl.textContent = receipt.type || 'RECEIPT';
      const isReturn = String(receipt.type || '').includes('RETURN');
      badgeEl.style.background = isReturn ? '#e0f2fe' : '#dcfce7';
      badgeEl.style.color = isReturn ? '#0369a1' : '#166534';
    }
    if (refEl) refEl.textContent = receipt.ref || '-';
    if (stuEl) stuEl.textContent = receipt.student || '-';
    if (bookEl) bookEl.textContent = receipt.book || '-';
    if (extraEl) extraEl.textContent = receipt.extra || '-';
    if (tsEl) tsEl.textContent = receipt.timestamp || new Date().toLocaleString();
    box.style.display = 'block';
  }

  // DOM Loaded
  document.addEventListener('DOMContentLoaded', async function () {
    if (window.CvsuRouteGuard) {
      const sessionData = await window.CvsuRouteGuard.requireSession('admin', '../../../index.html', 'cvsu_library_current_admin');
      if (!sessionData) return;
    }
    const scannerLogoutBtn = document.getElementById('scannerLogoutBtn');
    if (scannerLogoutBtn) {
      scannerLogoutBtn.addEventListener('click', function () {
        if (window.CvsuRouteGuard) {
          window.CvsuRouteGuard.logout('../../../index.html', 'cvsu_library_current_admin');
        } else {
          window.location.href = '../../../index.html';
        }
      });
    }
    renderScanLogsTable();

    const scannerRecordsSection = document.getElementById('scannerRecordsSection');
    document.querySelectorAll('[data-scanner-tab-btn]').forEach(tabBtn => {
      tabBtn.addEventListener('click', function () {
        const targetTab = this.getAttribute('data-scanner-tab-btn') || 'loans';
        document.querySelectorAll('[data-scanner-tab-btn]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        if (scannerRecordsSection) {
          scannerRecordsSection.setAttribute('data-scanner-tab', targetTab);
        }
      });
    });

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
      if (typeof window.CvsuCirculationEngine.listStudentsRemote === 'function') {
        window.CvsuCirculationEngine.listStudentsRemote().then(sRes => {
          if (sRes && sRes.ok && Array.isArray(sRes.data)) {
            sRes.data.forEach(st => {
              const cleanNo = String(st.student_number || '').replace(/[\s-]/g, '');
              if (cleanNo) cachedStudentsMap.set(cleanNo, st);
            });
          }
        });
      }
    }

    // Start / Stop Camera Buttons
    const startCamBtn = document.getElementById('startCamBtn');
    const stopCamBtn = document.getElementById('stopCamBtn');

    if (startCamBtn) {
      startCamBtn.addEventListener('click', function () {
        startCameraScanner();
      });
    }

    const cameraSelect = document.getElementById('cameraSelect');
    if (cameraSelect) {
      cameraSelect.addEventListener('change', function () {
        startCameraScanner(this.value);
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

    // File Upload QR Code Image Reader (Accurate jsQR + BarcodeDetector — zero fake student fallback)
    const qrFileInput = document.getElementById('qrFileInput');
    if (qrFileInput) {
      qrFileInput.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        showToast('Decoding uploaded QR image...', 'info');
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = async function () {
          try {
            let decodedText = decodeQrFromImageElement(img);

            if (!decodedText && 'BarcodeDetector' in window) {
              try {
                const detector = new BarcodeDetector({ formats: ['qr_code'] });
                const barcodes = await detector.detect(img);
                if (barcodes && barcodes.length > 0) {
                  decodedText = barcodes[0].rawValue;
                }
              } catch (err) {
                console.warn(err);
              }
            }

            if (decodedText) {
              lastScannedPayload = null;
              handleScannedCode(decodedText);
            } else {
              showToast('Could not read a QR code from that image. Please upload a clearer or closer QR image.', 'error');
            }
          } finally {
            URL.revokeObjectURL(objectUrl);
            qrFileInput.value = '';
          }
        };

        img.onerror = function () {
          URL.revokeObjectURL(objectUrl);
          qrFileInput.value = '';
          showToast('Invalid image file selected.', 'error');
        };

        img.src = objectUrl;
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
        showLastTransactionReceipt({
          type: 'BORROW RECEIPT',
          ref: currentDecodedData.ref || 'BRW-TXN',
          student: `${currentDecodedData.name} (${currentDecodedData.studentNo})`,
          book: currentDecodedData.book,
          extra: `Call No: ${currentDecodedData.callNo || 'N/A'} | Due: ${currentDecodedData.dueDate || 'Per policy'}`,
          timestamp: now.toLocaleString()
        });
        showToast(`✅ Book Loan Approved for ${currentDecodedData.name}! Transaction logged.`, 'success');

        // Reset view for next scan
        setTimeout(() => {
          const emptyState = document.getElementById('scannerEmptyState');
          const resultBox = document.getElementById('scannerResultBox');
          if (resultBox) resultBox.classList.remove('active');
          if (emptyState) emptyState.style.display = 'block';
          currentDecodedData = null;
          lastScannedPayload = null;
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
        lastScannedPayload = null;
        showToast('Ready for next QR scan.', 'info');
      });
    }

    const printLastReceiptBtn = document.getElementById('printLastReceiptBtn');
    if (printLastReceiptBtn) {
      printLastReceiptBtn.addEventListener('click', function () {
        if (!lastReceiptData) {
          showToast('Process a borrow, renew, or return transaction first to print a receipt.', 'info');
          return;
        }
        const win = window.open('', '_blank', 'width=420,height=520');
        if (!win) {
          window.print();
          return;
        }
        win.document.write(`<!DOCTYPE html><html><head><title>Library Receipt - ${escReceiptHtml(lastReceiptData.ref)}</title></head><body style="font-family:monospace,Arial,sans-serif;padding:20px;max-width:340px;margin:0 auto;color:#0f172a;">
          <div style="text-align:center;border-bottom:2px dashed #94a3b8;padding-bottom:10px;margin-bottom:12px;">
            <h3 style="margin:0;color:#00875a;">CvSU Imus Campus Library</h3>
            <div style="font-size:12px;font-weight:700;margin-top:4px;">${escReceiptHtml(lastReceiptData.type)}</div>
          </div>
          <div style="font-size:12px;line-height:1.7;">
            <div><strong>Ref #:</strong> ${escReceiptHtml(lastReceiptData.ref)}</div>
            <div><strong>Borrower:</strong> ${escReceiptHtml(lastReceiptData.student)}</div>
            <div><strong>Book:</strong> ${escReceiptHtml(lastReceiptData.book)}</div>
            <div><strong>Summary:</strong> ${escReceiptHtml(lastReceiptData.extra)}</div>
            <div><strong>Timestamp:</strong> ${escReceiptHtml(lastReceiptData.timestamp)}</div>
          </div>
          <div style="text-align:center;border-top:2px dashed #94a3b8;padding-top:10px;margin-top:14px;font-size:11px;color:#475569;">
            Official QR Circulation Transaction Slip<br>Please retain for clearance verification.
          </div>
        </body></html>`);
        win.document.close();
        win.focus();
        win.print();
      });
    }

    // Clear Circulation Log Button (In-page confirmation modal)
    const clearLogBtn = document.getElementById('clearLogBtn');
    const confirmModal = document.getElementById('scannerConfirmModal');
    const okConfirmBtn = document.getElementById('okScannerConfirmBtn');
    const cancelConfirmBtn = document.getElementById('cancelScannerConfirmBtn');
    const closeConfirmBtn = document.getElementById('closeScannerConfirmBtn');

    if (clearLogBtn && confirmModal) {
      const closeModal = () => confirmModal.classList.remove('active');
      clearLogBtn.addEventListener('click', () => confirmModal.classList.add('active'));
      if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', closeModal);
      if (closeConfirmBtn) closeConfirmBtn.addEventListener('click', closeModal);
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) closeModal();
      });
      if (okConfirmBtn) {
        okConfirmBtn.addEventListener('click', function () {
          localStorage.removeItem(STORAGE_LOGS_KEY);
          renderScanLogsTable();
          closeModal();
          showToast('Circulation logs cleared.', 'info');
        });
      }
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
