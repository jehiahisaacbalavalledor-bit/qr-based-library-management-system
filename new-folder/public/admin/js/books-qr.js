/**
 * Cavite State University - Imus Campus
 * Official Book QR Code Generator & Label Printing Controller
 */

(function () {
  'use strict';

  const STORAGE_BOOKS_KEY = 'cvsu_library_books_catalog';
  const LATEST_BOOK_SCAN_KEY = 'cvsu_latest_book_qr_scan';
  const THEME_STORAGE_KEY = 'cvsu_library_theme';

  // Seed default books matching schema.sql
  const DEFAULT_BOOKS = [
    {
      id: 1,
      bookCode: 'BK-CVSU-001',
      accessionNo: 'ACC-2026-00101',
      callNo: 'QA 76.6 .C67',
      classification: '005.1',
      isbn: '978-0132350884',
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      author: 'Robert C. Martin',
      category: 'Computer Science & IT',
      publisher: 'Prentice Hall',
      publicationYear: 2008,
      totalCopies: 4,
      availableCopies: 3,
      isRoomUseOnly: false
    },
    {
      id: 2,
      bookCode: 'BK-CVSU-002',
      accessionNo: 'ACC-2026-00102',
      callNo: 'QA 76.73 .J38',
      classification: '005.133',
      isbn: '978-1491910771',
      title: 'Head First Java (3rd Edition)',
      author: 'Kathy Sierra & Bert Bates',
      category: 'Computer Science & IT',
      publisher: 'O Reilly Media',
      publicationYear: 2022,
      totalCopies: 3,
      availableCopies: 3,
      isRoomUseOnly: false
    },
    {
      id: 3,
      bookCode: 'BK-CVSU-003',
      accessionNo: 'ACC-2026-00103',
      callNo: 'QA 76.9 .D3 S54',
      classification: '005.74',
      isbn: '978-0078022159',
      title: 'Database System Concepts (7th Edition)',
      author: 'Abraham Silberschatz, Henry F. Korth',
      category: 'Information Technology',
      publisher: 'McGraw-Hill',
      publicationYear: 2019,
      totalCopies: 3,
      availableCopies: 2,
      isRoomUseOnly: false
    },
    {
      id: 4,
      bookCode: 'BK-CVSU-004',
      accessionNo: 'ACC-2026-00104',
      callNo: 'QA 76.58 .T36',
      classification: '004.6',
      isbn: '978-0132126953',
      title: 'Computer Networks (5th Edition)',
      author: 'Andrew S. Tanenbaum, David J. Wetherall',
      category: 'Networking',
      publisher: 'Pearson',
      publicationYear: 2011,
      totalCopies: 2,
      availableCopies: 2,
      isRoomUseOnly: false
    },
    {
      id: 5,
      bookCode: 'BK-CVSU-005',
      accessionNo: 'ACC-2026-00105',
      callNo: 'QA 76.76 .C672',
      classification: '005.276',
      isbn: '978-1118531648',
      title: 'Web Design with HTML, CSS, JavaScript and jQuery',
      author: 'Jon Duckett',
      category: 'Web Development',
      publisher: 'Wiley',
      publicationYear: 2014,
      totalCopies: 5,
      availableCopies: 4,
      isRoomUseOnly: false
    },
    {
      id: 6,
      bookCode: 'BK-CVSU-006',
      accessionNo: 'ACC-SPEC-00001',
      callNo: 'FIL QA 76.2 .C8',
      classification: '378.599',
      isbn: 'SPECIAL-THESIS-2024',
      title: 'CvSU Imus Campus Undergraduate IT Theses Compendium Vol. IV',
      author: 'CvSU Department of Computer Studies',
      category: 'Special Collections',
      publisher: 'CvSU Imus Publications',
      publicationYear: 2024,
      totalCopies: 1,
      availableCopies: 1,
      isRoomUseOnly: true
    }
  ];

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

  function getBooksCatalog() {
    try {
      const stored = localStorage.getItem(STORAGE_BOOKS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(DEFAULT_BOOKS));
    return DEFAULT_BOOKS;
  }

  function saveBooksCatalog(books) {
    localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(books));
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildBookQrPayload(book) {
    return {
      type: 'CVSU_BOOK_QR',
      bookCode: book.bookCode,
      callNo: book.callNo,
      acc: book.accessionNo,
      title: (book.title || '').substring(0, 36),
      roomOnly: book.isRoomUseOnly ? 1 : 0
    };
  }

  function buildQrDataUrl(book, size = 110) {
    if (typeof QRCode === 'undefined') return '';
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    temp.style.top = '-9999px';
    document.body.appendChild(temp);
    try {
      try {
        new QRCode(temp, {
          text: JSON.stringify(buildBookQrPayload(book)),
          width: size,
          height: size,
          correctLevel: 1,
          colorDark: '#00875a',
          colorLight: '#ffffff'
        });
      } catch (err) {
        temp.innerHTML = '';
        new QRCode(temp, {
          text: `CVSU:${book.bookCode}|${book.callNo}|${book.accessionNo}`,
          width: size,
          height: size,
          correctLevel: 1,
          colorDark: '#00875a',
          colorLight: '#ffffff'
        });
      }
      const canvas = temp.querySelector('canvas');
      if (canvas && typeof canvas.toDataURL === 'function') {
        return canvas.toDataURL('image/png');
      }
      const img = temp.querySelector('img');
      return img ? img.src : '';
    } finally {
      temp.remove();
    }
  }

  function mapServerBookToLocal(row) {
    return {
      id: Number(row.id) || 0,
      bookCode: row.book_code || row.bookCode || '',
      accessionNo: row.accession_number || row.accessionNo || 'N/A',
      title: row.title || 'Untitled Book',
      author: row.author || 'Unknown Author',
      callNo: row.call_number || row.callNo || 'N/A',
      classification: row.classification_number || row.classification || '000',
      category: row.category || 'General Collection',
      totalCopies: parseInt(row.total_copies ?? row.totalCopies ?? 1, 10) || 1,
      availableCopies: parseInt(row.available_copies ?? row.availableCopies ?? 0, 10) || 0,
      isRoomUseOnly: Boolean(Number(row.is_room_use_only ?? row.isRoomUseOnly ?? 0)),
      publicationYear: row.publication_year || row.publicationYear || new Date().getFullYear()
    };
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (window.CvsuRouteGuard) {
      const sessionData = await window.CvsuRouteGuard.requireSession('admin', '../../admin-index.html', 'cvsu_library_current_admin');
      if (!sessionData) return;
    }
    let books = getBooksCatalog();
    let currentSelectedBook = books[0];
    let currentFilteredBooks = books.slice();
    const selectedBatchCodes = new Set();

    // Theme support
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
      const icon = document.getElementById('darkModeIcon');
      const text = document.getElementById('darkModeText');
      if (icon) icon.textContent = '☀';
      if (text) text.textContent = 'Light Mode';
    }

    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('click', function () {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
        const icon = document.getElementById('darkModeIcon');
        const text = document.getElementById('darkModeText');
        if (icon) icon.textContent = isDark ? '☀' : '☾';
        if (text) text.textContent = isDark ? 'Light Mode' : 'Dark Mode';
      });
    }

    // Render Live Sticker
    function renderSticker(book) {
      currentSelectedBook = book;
      const stickerBookCode = document.getElementById('stickerBookCode');
      const stickerAccession = document.getElementById('stickerAccession');
      const stickerCallNo = document.getElementById('stickerCallNo');
      const stickerClassification = document.getElementById('stickerClassification');
      const stickerBookTitle = document.getElementById('stickerBookTitle');
      const stickerAuthor = document.getElementById('stickerAuthor');
      const stickerCollectionType = document.getElementById('stickerCollectionType');
      const bookQrBox = document.getElementById('bookQrBox');

      if (stickerBookCode) stickerBookCode.textContent = book.bookCode;
      if (stickerAccession) stickerAccession.textContent = book.accessionNo;
      if (stickerCallNo) stickerCallNo.textContent = book.callNo;
      if (stickerClassification) stickerClassification.textContent = `${book.classification || '000'} (DDC)`;
      if (stickerBookTitle) stickerBookTitle.textContent = book.title;
      if (stickerAuthor) stickerAuthor.textContent = book.author;

      if (stickerCollectionType) {
        if (book.isRoomUseOnly) {
          stickerCollectionType.textContent = 'ROOM USE ONLY';
          stickerCollectionType.style.background = '#fef08a';
          stickerCollectionType.style.color = '#854d0e';
        } else {
          stickerCollectionType.textContent = 'CIRCULATING';
          stickerCollectionType.style.background = '#dcfce7';
          stickerCollectionType.style.color = '#166534';
        }
      }

      // Generate Standardized Book QR Payload (Concise for fast scanning)
      const bookQrPayload = buildBookQrPayload(book);

      if (bookQrBox && typeof QRCode !== 'undefined') {
        try {
          bookQrBox.innerHTML = '';
          new QRCode(bookQrBox, {
            text: JSON.stringify(bookQrPayload),
            width: 165,
            height: 165,
            correctLevel: 1, // Level L (7%) for maximum reliability and scan speed
            colorDark: '#00875a',
            colorLight: '#ffffff'
          });
        } catch (qrErr) {
          console.warn('QR Code generation notice:', qrErr);
          // Fallback with simpler string if needed
          bookQrBox.innerHTML = '';
          new QRCode(bookQrBox, {
            text: `CVSU:${book.bookCode}|${book.callNo}|${book.accessionNo}`,
            width: 165,
            height: 165,
            correctLevel: 1,
            colorDark: '#00875a',
            colorLight: '#ffffff'
          });
        }
      }
    }

    function getSelectedBooksOrdered() {
      return books.filter(b => selectedBatchCodes.has(b.bookCode));
    }

    function expandSelectedLabels() {
      const selectedBooks = getSelectedBooksOrdered();
      const copyMode = document.getElementById('batchCopyMode')?.value || 'single';
      const labels = [];
      selectedBooks.forEach(book => {
        const count = copyMode === 'copies' ? Math.max(1, parseInt(book.totalCopies, 10) || 1) : 1;
        for (let i = 1; i <= count; i++) {
          labels.push({
            book,
            copyIndex: i,
            totalInBatch: count
          });
        }
      });
      return labels;
    }

    function updateBatchSelectionUI() {
      const selectedBooks = getSelectedBooksOrdered();
      const labels = expandSelectedLabels();
      const countEl = document.getElementById('batchSelectionCount');
      const openBtn = document.getElementById('openBatchPreviewBtn');
      const sidebarCount = document.getElementById('sidebarBatchCount');
      const selectAllCheckbox = document.getElementById('selectAllBooksCheckbox');

      if (countEl) {
        countEl.textContent = labels.length !== selectedBooks.length
          ? `${selectedBooks.length} selected (${labels.length} labels)`
          : `${selectedBooks.length} selected`;
      }
      if (openBtn) {
        openBtn.textContent = `🖨️ Batch Print Sheet (${labels.length})`;
      }
      if (sidebarCount) {
        sidebarCount.textContent = String(labels.length);
      }

      if (selectAllCheckbox) {
        if (currentFilteredBooks.length === 0) {
          selectAllCheckbox.checked = false;
          selectAllCheckbox.indeterminate = false;
        } else {
          const selectedVisibleCount = currentFilteredBooks.filter(b => selectedBatchCodes.has(b.bookCode)).length;
          selectAllCheckbox.checked = selectedVisibleCount === currentFilteredBooks.length;
          selectAllCheckbox.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < currentFilteredBooks.length;
        }
      }
    }

    // Render Table
    function renderTable(filterText = '', filterCat = 'all') {
      const tbody = document.getElementById('catalogTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      const filtered = books.filter(b => {
        const matchesText = filterText === '' || 
          b.title.toLowerCase().includes(filterText.toLowerCase()) ||
          b.author.toLowerCase().includes(filterText.toLowerCase()) ||
          b.callNo.toLowerCase().includes(filterText.toLowerCase()) ||
          b.bookCode.toLowerCase().includes(filterText.toLowerCase());

        const matchesCat = filterCat === 'all' || 
          (filterCat === 'Special Collections' ? b.isRoomUseOnly : b.category === filterCat);

        return matchesText && matchesCat;
      });

      currentFilteredBooks = filtered;

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No matching books found in catalog.</td></tr>`;
        updateBatchSelectionUI();
        return;
      }

      filtered.forEach(book => {
        const tr = document.createElement('tr');
        if (currentSelectedBook && currentSelectedBook.bookCode === book.bookCode) {
          tr.classList.add('selected');
        }
        const isChecked = selectedBatchCodes.has(book.bookCode);

        tr.innerHTML = `
          <td style="text-align: center;">
            <input type="checkbox" class="book-batch-checkbox" data-code="${escapeHtml(book.bookCode)}" ${isChecked ? 'checked' : ''} aria-label="Select ${escapeHtml(book.title)} for batch print">
          </td>
          <td>
            <span class="book-badge-code">${escapeHtml(book.bookCode)}</span>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">
              ${escapeHtml(book.title)}
              ${book.isRoomUseOnly ? '<span class="book-badge-special">ROOM USE ONLY</span>' : ''}
            </div>
            <div style="font-size: 11.5px; color: var(--text-secondary);">
              Author: ${escapeHtml(book.author)} | Year: ${escapeHtml(book.publicationYear || 'N/A')}
            </div>
          </td>
          <td><strong style="font-family: monospace; color: var(--cvsu-green-light);">${escapeHtml(book.callNo)}</strong></td>
          <td><span style="font-family: monospace; color: var(--text-secondary);">${escapeHtml(book.accessionNo)}</span></td>
          <td>
            <span style="font-size: 12px; font-weight: 600; color: ${book.availableCopies > 0 ? '#16a34a' : '#dc2626'};">
              ${book.availableCopies} / ${book.totalCopies} Available
            </span>
          </td>
          <td>
            <button type="button" class="btn-table-action btn-select-book" data-code="${escapeHtml(book.bookCode)}">
              Generate Sticker
            </button>
          </td>
        `;

        tr.querySelector('.book-batch-checkbox').addEventListener('change', function () {
          if (this.checked) {
            selectedBatchCodes.add(book.bookCode);
          } else {
            selectedBatchCodes.delete(book.bookCode);
          }
          updateBatchSelectionUI();
        });

        tr.querySelector('.btn-select-book').addEventListener('click', function () {
          document.querySelectorAll('.book-table tr').forEach(r => r.classList.remove('selected'));
          tr.classList.add('selected');
          renderSticker(book);
          showToast(`Generated QR label for: ${book.title}`, 'success');
        });

        tbody.appendChild(tr);
      });

      updateBatchSelectionUI();
    }

    // Initial table & sticker render
    renderTable();
    if (books && books.length > 0) {
      renderSticker(books[0]);
    }

    // Sync live catalog from MySQL when running over HTTP
    async function syncCatalogFromServer() {
      const engine = window.CvsuCirculationEngine;
      if (!engine || !engine.API_BASE || typeof engine.syncFromServer !== 'function') return;
      const syncResult = await engine.syncFromServer();
      if (syncResult && syncResult.ok && Array.isArray(syncResult.catalog) && syncResult.catalog.length > 0) {
        books = syncResult.catalog.map(mapServerBookToLocal);
        saveBooksCatalog(books);
        const searchVal = document.getElementById('bookSearchInput')?.value || '';
        const catVal = document.getElementById('categoryFilter')?.value || '';
        renderTable(searchVal, catVal);
        const match = books.find(b => b.bookCode === (currentSelectedBook && currentSelectedBook.bookCode));
        renderSticker(match || books[0]);
      }
    }
    syncCatalogFromServer();

    // Search and Filter Listeners
    const searchInput = document.getElementById('bookSearchInput');
    const categoryFilter = document.getElementById('categoryFilter');

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        renderTable(this.value.trim(), categoryFilter ? categoryFilter.value : 'all');
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', function () {
        renderTable(searchInput ? searchInput.value.trim() : '', this.value);
      });
    }

    // Print Single Sticker Button
    const printSingleStickerBtn = document.getElementById('printSingleStickerBtn');
    if (printSingleStickerBtn) {
      printSingleStickerBtn.addEventListener('click', function () {
        document.body.classList.remove('printing-batch');
        window.print();
      });
    }

    // Batch Selection & Print Sheet Handlers
    function applyBatchGridColumns(container, cols) {
      if (!container) return;
      container.classList.remove('cols-1', 'cols-2');
      if (cols === '1') container.classList.add('cols-1');
      if (cols === '2') container.classList.add('cols-2');
    }

    function renderBatchStickersInto(container, labels, cols) {
      if (!container) return;
      applyBatchGridColumns(container, cols);
      const qrCache = new Map();
      container.innerHTML = labels.map(item => {
        const b = item.book;
        if (!qrCache.has(b.bookCode)) {
          qrCache.set(b.bookCode, buildQrDataUrl(b, 110));
        }
        const qrSrc = qrCache.get(b.bookCode);
        const copyTag = item.totalInBatch > 1
          ? `<span class="batch-badge-copy">Copy ${item.copyIndex}/${item.totalInBatch}</span>`
          : '';
        const collectionBadge = b.isRoomUseOnly
          ? '<span style="font-weight:700;color:#854d0e;background:#fef08a;padding:1px 4px;border-radius:3px;">ROOM ONLY</span>'
          : '<span style="font-weight:700;color:#166534;background:#dcfce7;padding:1px 4px;border-radius:3px;">CIRCULATING</span>';

        return `
          <div class="batch-sticker-item">
            <div class="batch-sticker-head">
              <h5>Cavite State University</h5>
              <small>Imus Campus Library • Book QR</small>
            </div>
            <div class="batch-sticker-qr">
              ${qrSrc ? `<img src="${qrSrc}" alt="QR ${escapeHtml(b.bookCode)}">` : '<span style="font-size:10px;color:#dc2626;">QR unavailable</span>'}
            </div>
            <div class="batch-sticker-meta">
              <div class="meta-row">
                <span style="color:#64748b;">BOOK ID:</span>
                <strong style="font-family:monospace;">${escapeHtml(b.bookCode)}</strong>
              </div>
              <div class="meta-row">
                <span style="color:#64748b;">ACC #:</span>
                <span style="font-family:monospace;font-weight:600;">${escapeHtml(b.accessionNo)}</span>
              </div>
              <div class="meta-row">
                <span style="color:#64748b;">CALL NO:</span>
                <span class="meta-call">${escapeHtml(b.callNo)}</span>
              </div>
              <div class="meta-title">${escapeHtml(b.title)}</div>
              <div class="meta-footer">
                <span>${escapeHtml(b.author)}</span>
                <span style="display:flex;gap:4px;align-items:center;">${copyTag}${collectionBadge}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function openBatchPrintPreview() {
      const labels = expandSelectedLabels();
      if (labels.length === 0) {
        showToast('Select at least one book checkbox in the catalog table first.', 'error');
        return;
      }

      const batchModal = document.getElementById('batchPrintModal');
      const previewGrid = document.getElementById('batchModalPreviewGrid');
      const summaryText = document.getElementById('batchSummaryText');
      const toolbarCols = document.getElementById('batchLayoutCols')?.value || '3';
      const modalColsSelect = document.getElementById('batchModalLayoutCols');
      if (modalColsSelect) modalColsSelect.value = toolbarCols;

      const uniqueBooks = new Set(labels.map(l => l.book.bookCode)).size;
      if (summaryText) {
        summaryText.textContent = `${labels.length} label${labels.length === 1 ? '' : 's'} across ${uniqueBooks} selected book${uniqueBooks === 1 ? '' : 's'} ready for printing.`;
      }

      renderBatchStickersInto(previewGrid, labels, toolbarCols);
      if (batchModal) batchModal.classList.add('active');
    }

    function triggerBatchPrint() {
      const labels = expandSelectedLabels();
      if (labels.length === 0) {
        showToast('Select at least one book checkbox in the catalog table first.', 'error');
        return;
      }

      const cols = document.getElementById('batchModalLayoutCols')?.value
        || document.getElementById('batchLayoutCols')?.value
        || '3';
      const printSheet = document.getElementById('batchPrintSheet');
      renderBatchStickersInto(printSheet, labels, cols);

      document.body.classList.add('printing-batch');
      const cleanupPrintClass = () => {
        document.body.classList.remove('printing-batch');
      };
      window.addEventListener('afterprint', cleanupPrintClass, { once: true });
      window.print();
      setTimeout(cleanupPrintClass, 1000);
    }

    const selectAllBooksCheckbox = document.getElementById('selectAllBooksCheckbox');
    if (selectAllBooksCheckbox) {
      selectAllBooksCheckbox.addEventListener('change', function () {
        if (this.checked) {
          currentFilteredBooks.forEach(b => selectedBatchCodes.add(b.bookCode));
        } else {
          currentFilteredBooks.forEach(b => selectedBatchCodes.delete(b.bookCode));
        }
        renderTable(searchInput ? searchInput.value.trim() : '', categoryFilter ? categoryFilter.value : 'all');
      });
    }

    const batchSelectAllVisibleBtn = document.getElementById('batchSelectAllVisibleBtn');
    if (batchSelectAllVisibleBtn) {
      batchSelectAllVisibleBtn.addEventListener('click', function () {
        currentFilteredBooks.forEach(b => selectedBatchCodes.add(b.bookCode));
        renderTable(searchInput ? searchInput.value.trim() : '', categoryFilter ? categoryFilter.value : 'all');
        showToast(`Selected ${currentFilteredBooks.length} visible book(s) for batch printing.`, 'info');
      });
    }

    const batchClearSelectionBtn = document.getElementById('batchClearSelectionBtn');
    if (batchClearSelectionBtn) {
      batchClearSelectionBtn.addEventListener('click', function () {
        selectedBatchCodes.clear();
        renderTable(searchInput ? searchInput.value.trim() : '', categoryFilter ? categoryFilter.value : 'all');
        showToast('Cleared batch label selection.', 'info');
      });
    }

    const batchCopyModeSelect = document.getElementById('batchCopyMode');
    if (batchCopyModeSelect) {
      batchCopyModeSelect.addEventListener('change', updateBatchSelectionUI);
    }

    const openBatchPreviewBtn = document.getElementById('openBatchPreviewBtn');
    if (openBatchPreviewBtn) {
      openBatchPreviewBtn.addEventListener('click', openBatchPrintPreview);
    }

    const printBatchStickersBtn = document.getElementById('printBatchStickersBtn');
    if (printBatchStickersBtn) {
      printBatchStickersBtn.addEventListener('click', openBatchPrintPreview);
    }

    const batchPrintModal = document.getElementById('batchPrintModal');
    const closeBatchPrintModal = document.getElementById('closeBatchPrintModal');
    if (closeBatchPrintModal && batchPrintModal) {
      closeBatchPrintModal.addEventListener('click', function () {
        batchPrintModal.classList.remove('active');
      });
    }
    if (batchPrintModal) {
      batchPrintModal.addEventListener('click', function (e) {
        if (e.target === batchPrintModal) batchPrintModal.classList.remove('active');
      });
    }

    const batchModalLayoutCols = document.getElementById('batchModalLayoutCols');
    const batchLayoutCols = document.getElementById('batchLayoutCols');
    if (batchModalLayoutCols) {
      batchModalLayoutCols.addEventListener('change', function () {
        if (batchLayoutCols) batchLayoutCols.value = this.value;
        applyBatchGridColumns(document.getElementById('batchModalPreviewGrid'), this.value);
      });
    }
    if (batchLayoutCols) {
      batchLayoutCols.addEventListener('change', function () {
        if (batchModalLayoutCols) batchModalLayoutCols.value = this.value;
      });
    }

    const confirmBatchPrintBtn = document.getElementById('confirmBatchPrintBtn');
    if (confirmBatchPrintBtn) {
      confirmBatchPrintBtn.addEventListener('click', triggerBatchPrint);
    }

    // Test Scan in Circulation Scanner Button
    const testScanInScannerBtn = document.getElementById('testScanInScannerBtn');
    if (testScanInScannerBtn) {
      testScanInScannerBtn.addEventListener('click', function () {
        if (!currentSelectedBook) return;
        const bookPayload = {
          type: 'CVSU_BOOK_QR',
          bookCode: currentSelectedBook.bookCode,
          accessionNo: currentSelectedBook.accessionNo,
          callNo: currentSelectedBook.callNo,
          title: currentSelectedBook.title,
          author: currentSelectedBook.author,
          category: currentSelectedBook.category,
          isRoomUseOnly: currentSelectedBook.isRoomUseOnly ? 1 : 0
        };
        localStorage.setItem(LATEST_BOOK_SCAN_KEY, JSON.stringify(bookPayload));
        showToast(`Book QR loaded! Opening circulation scanner...`, 'info');
        setTimeout(() => {
          window.location.href = '../transactions/scanner.html';
        }, 500);
      });
    }

    // Modal: Add New Book
    const addBookModal = document.getElementById('addBookModal');
    const addNewBookBtn = document.getElementById('addNewBookBtn');
    const closeAddBookModal = document.getElementById('closeAddBookModal');
    const newBookForm = document.getElementById('newBookForm');

    if (addNewBookBtn && addBookModal) {
      addNewBookBtn.addEventListener('click', function () {
        const nextId = books.length + 1;
        document.getElementById('newBookCode').value = `BK-CVSU-00${nextId}`;
        document.getElementById('newAccession').value = `ACC-2026-0010${nextId}`;
        addBookModal.classList.add('active');
      });
    }

    if (closeAddBookModal && addBookModal) {
      closeAddBookModal.addEventListener('click', function () {
        addBookModal.classList.remove('active');
      });
    }

    if (addBookModal) {
      addBookModal.addEventListener('click', function (e) {
        if (e.target === addBookModal) addBookModal.classList.remove('active');
      });
    }

    if (newBookForm) {
      newBookForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const submitBtn = newBookForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.textContent : '';
        const newBook = {
          id: books.length + 1,
          bookCode: document.getElementById('newBookCode').value.trim(),
          accessionNo: document.getElementById('newAccession').value.trim(),
          title: document.getElementById('newBookTitle').value.trim(),
          author: document.getElementById('newAuthor').value.trim(),
          callNo: document.getElementById('newCallNo').value.trim(),
          classification: document.getElementById('newClassification').value.trim() || '000',
          category: document.getElementById('newCategory').value.trim() || 'General Collection',
          totalCopies: parseInt(document.getElementById('newCopies').value, 10) || 1,
          availableCopies: parseInt(document.getElementById('newCopies').value, 10) || 1,
          isRoomUseOnly: document.getElementById('newIsSpecialCollection').checked,
          publicationYear: new Date().getFullYear()
        };

        let savedBook = newBook;
        const engine = window.CvsuCirculationEngine;
        if (engine && engine.API_BASE && typeof engine.addBookRemote === 'function') {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
          }
          try {
            const result = await engine.addBookRemote({
              bookCode: newBook.bookCode,
              accessionNumber: newBook.accessionNo,
              title: newBook.title,
              author: newBook.author,
              callNumber: newBook.callNo,
              classification: newBook.classification,
              category: newBook.category,
              totalCopies: newBook.totalCopies,
              isRoomUseOnly: newBook.isRoomUseOnly
            });
            if (!result || !result.ok) {
              showToast((result && result.message) || 'Failed to save book to database.', 'error');
              return;
            }
            if (result.data) {
              savedBook = mapServerBookToLocal(result.data);
            }
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalBtnText;
            }
          }
        }

        books.unshift(savedBook);
        saveBooksCatalog(books);
        renderTable();
        renderSticker(savedBook);
        addBookModal.classList.remove('active');
        newBookForm.reset();
        showToast(`Successfully added "${savedBook.title}" to catalog!`, 'success');
      });
    }

    const booksQrLogoutBtn = document.getElementById('booksQrLogoutBtn');
    if (booksQrLogoutBtn) {
      booksQrLogoutBtn.addEventListener('click', function () {
        if (window.CvsuRouteGuard) {
          window.CvsuRouteGuard.logout('../../admin-index.html', 'cvsu_library_current_admin');
        } else {
          window.location.href = '../../admin-index.html';
        }
      });
    }

  });
})();
