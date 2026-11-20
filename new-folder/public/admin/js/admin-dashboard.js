(function() {
  'use strict';
  const SESSION_ADMIN_KEY = 'cvsu_library_current_admin';
  const STORAGE_BOOKS_KEY = 'cvsu_library_catalog_books';

  function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function askConfirmation(title, message, confirmLabel = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmActionModal');
      const titleEl = document.getElementById('confirmActionTitle');
      const msgEl = document.getElementById('confirmActionMessage');
      const okBtn = document.getElementById('okConfirmActionBtn');
      const cancelBtn = document.getElementById('cancelConfirmActionBtn');
      const closeBtn = document.getElementById('closeConfirmActionBtn');
      if (!modal || !okBtn) {
        resolve(false);
        return;
      }

      if (titleEl) titleEl.textContent = title || 'Confirm Action';
      if (msgEl) msgEl.textContent = message || 'Are you sure you want to continue?';
      okBtn.textContent = confirmLabel;
      modal.classList.add('active');

      const cleanup = (result) => {
        modal.classList.remove('active');
        okBtn.removeEventListener('click', onOk);
        if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
        if (closeBtn) closeBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeyDown);
        resolve(result);
      };

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => { if (e.target === modal) cleanup(false); };
      const onKeyDown = (e) => { if (e.key === 'Escape') cleanup(false); };

      okBtn.addEventListener('click', onOk);
      if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
      if (closeBtn) closeBtn.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeyDown);
    });
  }

  const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);

  function getAdmin() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_ADMIN_KEY)) || {
        fullName: 'Prof. Maria C. Santos',
        employeeId: 'LIB-2024-001',
        role: 'Head Librarian'
      };
    } catch(e) {
      return { fullName: 'Prof. Maria C. Santos', employeeId: 'LIB-2024-001', role: 'Head Librarian' };
    }
  }

  function getBooksList() {
    const engine = window.CvsuCirculationEngine;
    if (engine && engine.getCatalog().length > 0) {
      return engine.getCatalog().map(b => ({
        id: b.book_code,
        accessionNumber: b.accession_number || 'N/A',
        classificationNumber: b.classification_number || '005.1',
        isbn: b.isbn || 'N/A',
        title: b.title,
        author: b.author,
        publisher: b.publisher || '',
        publicationYear: b.publication_year || '',
        marcTags: b.marc_tags || '',
        category: b.category,
        location: b.call_number,
        totalCopies: Number(b.total_copies),
        availableCopies: Number(b.available_copies),
        isRoomUseOnly: Number(b.is_room_use_only) === 1
      }));
    }
    try {
      return JSON.parse(localStorage.getItem(STORAGE_BOOKS_KEY)) || [];
    } catch(e) { return []; }
  }

  function applyRoleLabels(role) {
    const sidebarTitleEl = document.getElementById('adminSidebarTitle');
    if (sidebarTitleEl) {
      sidebarTitleEl.textContent = role === 'Circulation Desk Officer' ? 'CvSU Staff' : 'CvSU Admin';
    }
    const navBadgeEl = document.getElementById('navRoleBadge');
    if (navBadgeEl && role) {
      navBadgeEl.textContent = `${role} Console`;
    }
  }

  function render() {
    const admin = getAdmin();
    document.getElementById('adminStaffName').textContent = admin.fullName;
    document.getElementById('adminStaffId').textContent = `ID: ${admin.employeeId}`;
    applyRoleLabels(admin.role);

    const engine = window.CvsuCirculationEngine;
    const books = getBooksList();
    const activeLoans = engine ? engine.getLoans().filter(l => l.status === 'borrowed' || l.status === 'overdue') : [];
    const todayStr = engine ? engine.toYmd(new Date()) : new Date().toISOString().split('T')[0];
    const tmrDt = new Date(todayStr + 'T00:00:00');
    tmrDt.setDate(tmrDt.getDate() + 1);
    const tomorrowStr = engine ? engine.toYmd(tmrDt) : '';

    let overdueCount = 0;
    let dueTodayCount = 0;
    let dueSoonCount = 0;
    let totalFines = 0;

    activeLoans.forEach(l => {
      if (engine) {
        const calc = engine.calculateOverdueFine(l.dueDate, todayStr);
        if (calc.isOverdue) {
          overdueCount++;
          totalFines += calc.fineAmount;
        } else if (l.dueDate === todayStr) {
          dueTodayCount++;
          dueSoonCount++;
        } else if (l.dueDate === tomorrowStr) {
          dueSoonCount++;
        }
      }
    });

    const alertBadge = document.getElementById('adminLoanAlertBadge');
    if (alertBadge) {
      alertBadge.textContent = `${overdueCount} Overdue · ${dueSoonCount} Due Soon`;
      if (overdueCount > 0) {
        alertBadge.style.background = '#fee2e2';
        alertBadge.style.color = '#dc2626';
      } else if (dueSoonCount > 0) {
        alertBadge.style.background = '#fef3c7';
        alertBadge.style.color = '#b45309';
      } else {
        alertBadge.style.background = '#dcfce7';
        alertBadge.style.color = '#166534';
      }
    }

    if (engine) {
      const unpaidLedger = engine.getFines().filter(f => f.paymentStatus === 'unpaid');
      totalFines += unpaidLedger.reduce((s, f) => s + Number(f.fineAmount || 0), 0);
    }

    const srvStats = engine && typeof engine.getServerStats === 'function' ? engine.getServerStats() : null;
    const totalAvailCopies = srvStats && typeof srvStats.available_books === 'number'
      ? srvStats.available_books
      : books.reduce((s, b) => s + Number(b.availableCopies || 0), 0);
    const totalRegisteredStudents = srvStats && typeof srvStats.total_students === 'number'
      ? srvStats.total_students
      : (Array.isArray(cachedStudents) ? cachedStudents.length : 0);

    document.getElementById('adminTotalCatalog').textContent = books.length;
    const availEl = document.getElementById('adminAvailableBooks');
    if (availEl) availEl.textContent = totalAvailCopies;
    document.getElementById('adminActiveLoans').textContent = activeLoans.length;
    const stuCntEl = document.getElementById('adminTotalStudents');
    if (stuCntEl) stuCntEl.textContent = totalRegisteredStudents;
    document.getElementById('adminOverdueCount').textContent = overdueCount;
    document.getElementById('adminFinesCollected').textContent = `₱${totalFines.toFixed(2)}`;

    // Due Today / Overdue & Offline Sync Alert Banner
    const dueBanner = document.getElementById('adminDueTodayBanner');
    const dueTitle = document.getElementById('adminDueTodayTitle');
    const dueDesc = document.getElementById('adminDueTodayDesc');
    const syncOffBtn = document.getElementById('adminSyncOfflineBtn');
    const offlinePending = engine && typeof engine.getOfflineQueue === 'function' ? engine.getOfflineQueue().length : 0;

    if (dueBanner) {
      if (dueTodayCount > 0 || overdueCount > 0 || offlinePending > 0) {
        dueBanner.style.display = 'flex';
        const msgs = [];
        if (overdueCount > 0) msgs.push(`${overdueCount} overdue book(s)`);
        if (dueTodayCount > 0) msgs.push(`${dueTodayCount} book(s) due today (${todayStr})`);
        if (dueTitle) dueTitle.textContent = msgs.length ? `Action Required: ${msgs.join(' · ')}` : 'Offline Circulation Queue Ready';
        if (dueDesc) dueDesc.textContent = msgs.length
          ? 'Follow up with borrowers below or export the Overdue Follow-Up CSV.'
          : 'Queued offline transactions can be synced directly to MySQL.';
        if (syncOffBtn) {
          if (offlinePending > 0) {
            syncOffBtn.style.display = 'inline-block';
            syncOffBtn.textContent = `Sync Offline Queue (${offlinePending})`;
          } else {
            syncOffBtn.style.display = 'none';
          }
        }
      } else {
        dueBanner.style.display = 'none';
      }
    }

    // Populate book select
    const sel = document.getElementById('circBookSelect');
    sel.innerHTML = books.map(b => {
      const roomTag = b.isRoomUseOnly ? ' [Room Use Only]' : '';
      return `<option value="${escHtml(b.id)}" ${b.availableCopies <= 0 ? 'disabled' : ''}>${escHtml(b.id)} — ${escHtml(b.title)} (${Number(b.availableCopies)} available)${roomTag}</option>`;
    }).join('');

    // Populate Category Filter options cleanly
    const catFilterEl = document.getElementById('adminBookCategoryFilter');
    if (catFilterEl) {
      const prevCat = catFilterEl.value;
      const uniqueCats = [...new Set(books.map(b => b.category).filter(Boolean))].sort();
      catFilterEl.innerHTML = '<option value="">All Categories</option>' +
        uniqueCats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
      catFilterEl.value = prevCat;
    }

    // Filter and populate loans table
    const loanFilterMode = document.getElementById('loanMonitorFilter')?.value || 'all';
    const displayLoans = activeLoans.filter(t => {
      const calc = engine ? engine.calculateOverdueFine(t.dueDate, todayStr) : { isOverdue: false };
      if (loanFilterMode === 'overdue') return calc.isOverdue;
      if (loanFilterMode === 'due_soon') return !calc.isOverdue && (t.dueDate === todayStr || t.dueDate === tomorrowStr);
      return true;
    });

    const loansTbody = document.getElementById('adminLoansTbody');
    if (displayLoans.length === 0) {
      loansTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 20px;">No loans matching the selected filter.</td></tr>`;
    } else {
      loansTbody.innerHTML = displayLoans.map(t => {
        const calc = engine ? engine.calculateOverdueFine(t.dueDate, todayStr) : { isOverdue: false, overdueDays: 0, skippedDays: 0, fineAmount: 0 };
        let badge = '';
        if (calc.isOverdue) {
          badge = `<span class="badge-status badge-overdue">OVERDUE (${calc.overdueDays}d chargeable, ${calc.skippedDays} skipped) ₱${calc.fineAmount.toFixed(2)}</span>`;
        } else if (t.dueDate === todayStr) {
          badge = `<span class="badge-status" style="background:#fef3c7;color:#d97706;">Due Today</span>`;
        } else if (t.dueDate === tomorrowStr) {
          badge = `<span class="badge-status" style="background:#e0f2fe;color:#0369a1;">Due Tomorrow</span>`;
        } else {
          badge = `<span class="badge-status badge-borrowed">Active</span>`;
        }

        return `
          <tr>
            <td><strong style="font-family: monospace;">${escHtml(t.ref)}</strong></td>
            <td><span style="font-family: monospace; font-weight: 700; color: #00875a;">${escHtml(t.studentNo)}</span><div style="font-size: 11px; color: #64748b;">${escHtml(t.studentName || '')}</div></td>
            <td><strong>${escHtml(t.bookTitle)}</strong><div style="font-size: 11px; color: #64748b;">${escHtml(t.bookCode || '')}</div></td>
            <td>${escHtml(t.borrowDate)}</td>
            <td><strong>${escHtml(t.dueDate)}</strong></td>
            <td style="font-size:12px;color:#475569;">${escHtml(t.librarianName || 'Library Staff')}</td>
            <td>${badge}</td>
            <td>
              <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
                <select class="form-control admin-return-cond" data-ref="${escHtml(t.ref)}" style="padding:3px 6px;font-size:11.5px;width:auto;background:#fff;">
                  <option value="good">Good</option>
                  <option value="minor_wear">Minor Wear</option>
                  <option value="damaged">Damaged</option>
                  <option value="lost">Lost</option>
                </select>
                <button class="btn-tbl-sm return-btn" data-ref="${escHtml(t.ref)}">Check-In Return</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      loansTbody.querySelectorAll('.return-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
          const ref = this.getAttribute('data-ref');
          if (!engine) return;
          const condSel = loansTbody.querySelector(`.admin-return-cond[data-ref="${ref}"]`);
          const cond = condSel ? condSel.value : 'good';
          const res = await engine.returnRemote(ref, todayStr, cond);
          if (res.ok) {
            showToast(res.message, 'success');
            render();
          } else {
            showToast(res.message || 'Return failed.', 'error');
          }
        });
      });
    }

    // Populate Recent Transactions History
    const recentTbody = document.getElementById('recentTransactionsTbody');
    if (recentTbody) {
      const recentTxns = engine && typeof engine.getRecentTransactions === 'function' ? engine.getRecentTransactions() : [];
      if (recentTxns.length === 0) {
        recentTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px;">No borrow/return history recorded yet.</td></tr>';
      } else {
        recentTbody.innerHTML = recentTxns.map(r => {
          const st = String(r.return_status || 'borrowed');
          const stColor = st === 'returned' ? '#16a34a' : (st === 'lost' || st === 'damaged' || st === 'overdue' ? '#dc2626' : '#0284c7');
          const condLabel = String(r.book_condition || 'good').replace(/_/g, ' ').toUpperCase();
          const staffText = r.return_librarian_name
            ? `${r.librarian_name || 'Staff'} / Ret: ${r.return_librarian_name}`
            : (r.librarian_name || 'Library Staff');
          return `
            <tr>
              <td><strong style="font-family:monospace;">${escHtml(r.transaction_code)}</strong></td>
              <td><span style="font-family:monospace;font-weight:700;">${escHtml(r.student_number)}</span><div style="font-size:11px;color:#64748b;">${escHtml(r.full_name)}</div></td>
              <td><strong>${escHtml(r.title)}</strong><div style="font-size:11px;color:#64748b;">${escHtml(r.book_code)}</div></td>
              <td>${escHtml(r.borrow_date)}</td>
              <td>${escHtml(r.due_date)}</td>
              <td>${r.actual_return_date ? escHtml(r.actual_return_date) : '<span style="color:#94a3b8;">Pending</span>'}</td>
              <td><span style="font-weight:700;font-size:11px;color:${stColor};text-transform:uppercase;">${escHtml(st)}</span><div style="font-size:10.5px;color:#64748b;">Cond: ${escHtml(condLabel)}</div></td>
              <td style="font-size:11.5px;color:#475569;">${escHtml(staffText)}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Populate Fines & Damaged/Lost Identical Replacement Ledger
    const finesAdminTbody = document.getElementById('adminFinesTbody');
    if (finesAdminTbody) {
      const allFines = engine ? engine.getFines() : [];
      if (allFines.length === 0) {
        finesAdminTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px;">No overdue fines or pending replacements.</td></tr>';
      } else {
        finesAdminTbody.innerHTML = allFines.map(f => {
          const payBadge = f.paymentStatus === 'paid'
            ? '<span class="badge-status" style="background:#dcfce7;color:#166534;">PAID</span>'
            : (f.paymentStatus === 'waived'
              ? '<span class="badge-status" style="background:#e2e8f0;color:#475569;">WAIVED</span>'
              : '<span class="badge-status badge-overdue">UNPAID</span>');
          const replHtml = f.replacementStatus === 'pending_replacement'
            ? `<div style="margin-top:3px;font-size:11px;color:#b45309;font-weight:600;">⚠ Identical Replacement Required · ISBN: ${escHtml(f.isbn || 'N/A')} · Author: ${escHtml(f.author || 'N/A')} · Acc: ${escHtml(f.accessionNumber || 'N/A')}</div>`
            : (f.replacementStatus === 'replaced'
              ? '<div style="margin-top:3px;font-size:11px;color:#15803d;font-weight:600;">✓ Identical Replacement Verified &amp; Restored</div>'
              : '');
          return `
            <tr>
              <td><code style="font-size:11.5px;">${escHtml(f.ref)}</code></td>
              <td><strong>${escHtml(f.studentName)}</strong><div style="font-size:11px;color:#64748b;">${escHtml(f.studentNo)}</div></td>
              <td><strong>${escHtml(f.bookTitle)}</strong>${replHtml}</td>
              <td>${Number(f.overdueDays || 0)} day(s)</td>
              <td><strong style="color:#dc2626;">₱${Number(f.fineAmount || 0).toFixed(2)}</strong></td>
              <td>${payBadge}</td>
              <td>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                  ${f.paymentStatus === 'unpaid' ? `
                    <button type="button" class="btn-tbl-sm btn-admin-settle" data-id="${Number(f.id)}" data-action="paid" style="color:#16a34a;">Mark Paid</button>
                    <button type="button" class="btn-tbl-sm btn-admin-settle" data-id="${Number(f.id)}" data-action="waived">Waive</button>
                  ` : ''}
                  ${f.replacementStatus === 'pending_replacement' ? `
                    <button type="button" class="btn-tbl-sm btn-admin-settle" data-id="${Number(f.id)}" data-action="replaced" style="color:#b45309;border-color:#fcd34d;background:#fffbeb;">Mark Replaced</button>
                  ` : ''}
                  ${f.paymentStatus !== 'unpaid' && f.replacementStatus !== 'pending_replacement' ? '<span style="font-size:11px;color:#64748b;">Settled</span>' : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');

        finesAdminTbody.querySelectorAll('.btn-admin-settle').forEach(btn => {
          btn.addEventListener('click', async function() {
            if (!engine) return;
            const fineId = this.getAttribute('data-id');
            const action = this.getAttribute('data-action');
            const ok = await engine.settleFineRemote(fineId, action);
            if (ok) {
              showToast(action === 'replaced' ? 'Identical book replacement verified and restored.' : `Fine marked as ${action.toUpperCase()}.`, 'success');
              render();
            } else {
              showToast('Failed to update fine/replacement record.', 'error');
            }
          });
        });
      }
    }

    // Filter & populate books table
    const bookSearchQ = (document.getElementById('adminBookSearchInput')?.value || '').trim().toLowerCase();
    const bookCatQ = document.getElementById('adminBookCategoryFilter')?.value || '';
    const bookAvailQ = document.getElementById('adminBookAvailFilter')?.value || 'all';
    const filteredBooks = books.filter(b => {
      if (bookCatQ && b.category !== bookCatQ) return false;
      if (bookAvailQ === 'available' && (b.availableCopies <= 0 || b.isRoomUseOnly)) return false;
      if (bookAvailQ === 'unavailable' && b.availableCopies > 0) return false;
      if (bookAvailQ === 'room_only' && !b.isRoomUseOnly) return false;
      if (!bookSearchQ) return true;
      return [b.id, b.accessionNumber, b.isbn, b.title, b.author, b.category, b.location, b.classificationNumber]
        .some(val => String(val || '').toLowerCase().includes(bookSearchQ));
    });

    const booksTbody = document.getElementById('adminBooksTbody');
    if (filteredBooks.length === 0) {
      booksTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:18px;">No books match the current search/filter.</td></tr>';
    } else {
      booksTbody.innerHTML = filteredBooks.map(b => {
        const availStatusBadge = b.isRoomUseOnly
          ? '<span style="display:inline-block;font-size:10.5px;font-weight:700;color:#b45309;background:#fef3c7;padding:2px 6px;border-radius:6px;">Room Use</span>'
          : (b.availableCopies > 0
            ? '<span style="display:inline-block;font-size:10.5px;font-weight:700;color:#166534;background:#dcfce7;padding:2px 6px;border-radius:6px;">Available</span>'
            : '<span style="display:inline-block;font-size:10.5px;font-weight:700;color:#dc2626;background:#fee2e2;padding:2px 6px;border-radius:6px;">Checked Out</span>');
        return `
          <tr>
            <td>
              <strong style="font-family: monospace;">${escHtml(b.id)}</strong>
              <div style="font-size:11px;color:#64748b;font-family:monospace;">${escHtml(b.accessionNumber)}</div>
            </td>
            <td>${escHtml(b.isbn)}</td>
            <td><strong>${escHtml(b.title)}</strong><div style="font-size: 11.5px; color: #64748b;">${escHtml(b.author)}</div></td>
            <td>${b.publisher ? escHtml(b.publisher) : '<span style="color:#94a3b8;">N/A</span>'}<div style="font-size: 11.5px; color: #64748b;">${escHtml(b.publicationYear || '—')}</div></td>
            <td><span class="badge-status badge-borrowed">${escHtml(b.category)}</span></td>
            <td>
              <div>${escHtml(b.location)}</div>
              <div style="font-size:11px;color:#64748b;">Class: ${escHtml(b.classificationNumber)}</div>
            </td>
            <td>
              <div><strong style="color: ${b.availableCopies > 0 ? '#16a34a' : '#dc2626'};">${Number(b.availableCopies)}</strong> / ${Number(b.totalCopies)}</div>
              ${availStatusBadge}
            </td>
            <td>
              <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <button type="button" class="btn-tbl-sm btn-view-copies" data-code="${escHtml(b.id)}" style="color:#0284c7;border-color:#bae6fd;">Copies</button>
                <button type="button" class="btn-tbl-sm btn-edit-book" data-code="${escHtml(b.id)}">Edit</button>
                <button type="button" class="btn-tbl-sm btn-delete-book" data-code="${escHtml(b.id)}" style="color:#dc2626;border-color:#fecaca;">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    booksTbody.querySelectorAll('.btn-view-copies').forEach(btn => {
      btn.addEventListener('click', function() {
        openBookCopiesModal(this.getAttribute('data-code'));
      });
    });

    booksTbody.querySelectorAll('.btn-edit-book').forEach(btn => {
      btn.addEventListener('click', function() {
        const b = books.find(x => x.id === this.getAttribute('data-code'));
        if (!b) return;
        document.getElementById('editBookCode').value = b.id;
        document.getElementById('editBookCodeDisplay').value = b.id;
        const accEl = document.getElementById('editBookAccession');
        if (accEl) accEl.value = b.accessionNumber === 'N/A' ? '' : (b.accessionNumber || '');
        const clsEl = document.getElementById('editBookClassification');
        if (clsEl) clsEl.value = b.classificationNumber || '005.1';
        document.getElementById('editBookIsbn').value = b.isbn === 'N/A' ? '' : b.isbn;
        document.getElementById('editBookTitle').value = b.title;
        document.getElementById('editBookAuthor').value = b.author;
        document.getElementById('editBookPublisher').value = b.publisher || '';
        document.getElementById('editBookYear').value = b.publicationYear || '';
        document.getElementById('editBookCategory').value = b.category;
        document.getElementById('editBookCallNo').value = b.location;
        document.getElementById('editBookCopies').value = b.totalCopies;
        document.getElementById('editBookRoomUse').checked = Boolean(b.isRoomUseOnly);
        const defaultMarc = JSON.stringify({
          '020': b.isbn,
          '082': b.classificationNumber || '005.1',
          '100': b.author,
          '245': b.title,
          '264': [b.publisher || 'N/A', b.publicationYear || ''].filter(Boolean).join(', '),
          '650': b.category,
          '852': b.location
        }, null, 2);
        document.getElementById('editBookMarcTags').value = b.marcTags || defaultMarc;
        document.getElementById('editBookModal').classList.add('active');
      });
    });

    booksTbody.querySelectorAll('.btn-delete-book').forEach(btn => {
      btn.addEventListener('click', async function() {
        const code = this.getAttribute('data-code');
        const confirmed = await askConfirmation(
          'Delete Book',
          `Delete book ${code} from the catalog? This cannot be undone.`,
          'Delete Book'
        );
        if (!confirmed) return;
        const engine = window.CvsuCirculationEngine;
        if (engine && engine.API_BASE) {
          const res = await engine.deleteBookRemote(code);
          showToast(res.message, res.ok ? 'success' : 'error');
          if (res.ok) render();
        }
      });
    });
  }

  // Issue book handler (Live MySQL + 2-Book Limit + Room-Use-Only)
  document.getElementById('circIssueBtn').addEventListener('click', async function() {
    const studentNo = document.getElementById('circStudentNo').value.trim();
    const bookCode = document.getElementById('circBookSelect').value;
    if (!studentNo) { showToast('Please enter a student number.', 'error'); return; }
    if (!bookCode) { showToast('Please select a book.', 'error'); return; }

    const books = getBooksList();
    const b = books.find(x => x.id === bookCode);
    if (!b) return;

    const engine = window.CvsuCirculationEngine;
    if (!engine) return;

    const res = await engine.borrowRemote({
      studentNo,
      studentName: `Student ${studentNo}`,
      bookCode: b.id,
      bookTitle: b.title,
      callNo: b.location,
      loanType: '3_days',
      isRoomUseOnly: b.isRoomUseOnly
    });

    if (res.ok) {
      showToast(res.message, 'success');
      render();
    } else {
      showToast(res.message, 'error');
    }
  });

  // Add book modal handlers
  const modal = document.getElementById('addBookModal');
  document.getElementById('openAddBookBtn').addEventListener('click', () => modal.classList.add('active'));
  document.getElementById('closeAddBookBtn').addEventListener('click', () => modal.classList.remove('active'));
  document.getElementById('cancelAddBookBtn').addEventListener('click', () => modal.classList.remove('active'));

  document.getElementById('addBookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const code = document.getElementById('newBookCode').value.trim();
    const accessionNumber = document.getElementById('newBookAccession')?.value.trim() || '';
    const classification = document.getElementById('newBookClassification')?.value.trim() || '005.1';
    const isbn = document.getElementById('newBookIsbn').value.trim();
    const title = document.getElementById('newBookTitle').value.trim();
    const author = document.getElementById('newBookAuthor').value.trim();
    const publisher = document.getElementById('newBookPublisher').value.trim();
    const pubYear = document.getElementById('newBookYear').value.trim();
    const cat = document.getElementById('newBookCategory').value;
    const callNo = document.getElementById('newBookCallNo').value.trim();
    const copies = parseInt(document.getElementById('newBookCopies').value, 10) || 1;
    const isRoomUseOnly = document.getElementById('newBookRoomUse').checked;
    const marcTags = document.getElementById('newBookMarcTags')?.value.trim() || '';

    const engine = window.CvsuCirculationEngine;
    if (engine && engine.API_BASE) {
      const res = await engine.addBookRemote({
        bookCode: code,
        accessionNumber,
        classification,
        isbn: isbn,
        title: title,
        author: author,
        publisher: publisher,
        publicationYear: pubYear,
        category: cat,
        callNumber: callNo || undefined,
        totalCopies: copies,
        isRoomUseOnly: isRoomUseOnly,
        marcTags: marcTags || undefined
      });
      if (res.ok) {
        modal.classList.remove('active');
        this.reset();
        showToast(res.message, 'success');
        render();
        return;
      } else {
        showToast(res.message || 'Could not add book.', 'error');
        return;
      }
    }

    const books = getBooksList();
    books.push({
      id: code,
      accessionNumber: accessionNumber || ('ACC-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000)),
      classificationNumber: classification,
      isbn: isbn || ('978-' + Math.floor(1000000000 + Math.random() * 9000000000)),
      title: title,
      author: author,
      publisher: publisher,
      publicationYear: pubYear,
      category: cat,
      location: callNo || ('Section ' + cat.substring(0, 3).toUpperCase()),
      totalCopies: copies,
      availableCopies: copies,
      isRoomUseOnly: isRoomUseOnly,
      marcTags: marcTags
    });

    localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(books));
    modal.classList.remove('active');
    this.reset();
    showToast(`Book "${title}" added to library inventory!`, 'success');
    render();
  });

  // Edit Book modal handlers
  const editBookModal = document.getElementById('editBookModal');
  document.getElementById('closeEditBookBtn').addEventListener('click', () => editBookModal.classList.remove('active'));
  document.getElementById('cancelEditBookBtn').addEventListener('click', () => editBookModal.classList.remove('active'));
  document.getElementById('editBookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const engine = window.CvsuCirculationEngine;
    if (!engine || !engine.API_BASE) return;
    const res = await engine.updateBookRemote({
      bookCode: document.getElementById('editBookCode').value.trim(),
      accessionNumber: document.getElementById('editBookAccession')?.value.trim() || undefined,
      classification: document.getElementById('editBookClassification')?.value.trim() || undefined,
      isbn: document.getElementById('editBookIsbn').value.trim(),
      title: document.getElementById('editBookTitle').value.trim(),
      author: document.getElementById('editBookAuthor').value.trim(),
      publisher: document.getElementById('editBookPublisher').value.trim(),
      publicationYear: document.getElementById('editBookYear').value.trim(),
      category: document.getElementById('editBookCategory').value.trim(),
      callNumber: document.getElementById('editBookCallNo').value.trim(),
      totalCopies: parseInt(document.getElementById('editBookCopies').value, 10) || 1,
      isRoomUseOnly: document.getElementById('editBookRoomUse').checked,
      marcTags: document.getElementById('editBookMarcTags').value.trim()
    });
    showToast(res.message, res.ok ? 'success' : 'error');
    if (res.ok) {
      editBookModal.classList.remove('active');
      render();
    }
  });

  // Per-Copy Barcode Tracking modal helper
  async function openBookCopiesModal(bookCode) {
    const copiesModal = document.getElementById('bookCopiesModal');
    const titleEl = document.getElementById('bookCopiesModalTitle');
    const metaEl = document.getElementById('bookCopiesMeta');
    const tbody = document.getElementById('bookCopiesTbody');
    if (!copiesModal || !tbody) return;
    const engine = window.CvsuCirculationEngine;
    if (titleEl) titleEl.textContent = `Copy-Level Tracking — ${bookCode}`;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px;">Loading copies...</td></tr>';
    copiesModal.classList.add('active');
    if (!engine || !engine.API_BASE) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px;">Copy barcode tracking requires active MySQL server.</td></tr>';
      return;
    }
    try {
      const res = await fetch(`${engine.API_BASE}books/copies.php?book_code=${encodeURIComponent(bookCode)}`, { credentials: 'same-origin' });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#dc2626;padding:14px;">${escHtml(json.message || 'Could not load copies.')}</td></tr>`;
        return;
      }
      if (metaEl && json.book) {
        metaEl.innerHTML = `<strong>${escHtml(json.book.title)}</strong> · Accession: <code>${escHtml(json.book.accession_number)}</code> · Total Copies: <strong>${Number(json.book.total_copies)}</strong>`;
      }
      const statuses = ['available', 'borrowed', 'damaged', 'lost', 'room_use'];
      tbody.innerHTML = (json.data || []).map(cp => `
        <tr data-copy-id="${Number(cp.id)}">
          <td><strong>Copy #${Number(cp.copy_number)}</strong></td>
          <td><code style="font-weight:700;color:#00875a;">${escHtml(cp.copy_barcode)}</code></td>
          <td>
            <select class="form-control copy-status-sel" style="padding:4px 6px;font-size:12px;background:#fff;">
              ${statuses.map(st => `<option value="${st}" ${cp.condition_status === st ? 'selected' : ''}>${st}</option>`).join('')}
            </select>
          </td>
          <td>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="text" class="form-control copy-notes-inp" value="${escHtml(cp.notes || '')}" placeholder="Copy note..." style="padding:4px 8px;font-size:12px;">
              <button type="button" class="btn-tbl-sm btn-save-copy" data-id="${Number(cp.id)}">Save</button>
            </div>
          </td>
        </tr>
      `).join('');
      tbody.querySelectorAll('.btn-save-copy').forEach(btn => {
        btn.addEventListener('click', async function() {
          const row = this.closest('tr');
          const id = Number(this.getAttribute('data-id'));
          const condition_status = row.querySelector('.copy-status-sel').value;
          const notes = row.querySelector('.copy-notes-inp').value.trim();
          const updRes = await fetch(`${engine.API_BASE}books/copies.php`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, condition_status, notes })
          });
          const updJson = await updRes.json();
          showToast(updJson.message || 'Copy updated.', updRes.ok && updJson.status === 'success' ? 'success' : 'error');
        });
      });
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#dc2626;padding:14px;">Network error loading copies.</td></tr>';
    }
  }
  const closeBookCopiesBtn = document.getElementById('closeBookCopiesBtn');
  if (closeBookCopiesBtn) {
    closeBookCopiesBtn.addEventListener('click', () => document.getElementById('bookCopiesModal').classList.remove('active'));
  }

  // Registered Students Management
  let cachedStudents = [];
  function renderStudentsTable(query = '') {
    const tbody = document.getElementById('adminStudentsTbody');
    if (!tbody) return;
    const q = query.trim().toLowerCase();
    const filtered = cachedStudents.filter(s => {
      if (!q) return true;
      return (
        String(s.student_number || '').toLowerCase().includes(q) ||
        String(s.full_name || '').toLowerCase().includes(q) ||
        String(s.course || '').toLowerCase().includes(q) ||
        String(s.email || '').toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:18px;">No student records found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(s => {
      const statusColor = s.account_status === 'active' ? '#16a34a' : (s.account_status === 'suspended' ? '#dc2626' : '#64748b');
      return `
        <tr>
          <td><strong style="font-family:monospace;">${escHtml(s.student_number)}</strong></td>
          <td><strong>${escHtml(s.full_name)}</strong><div style="font-size:11.5px;color:#64748b;">${escHtml(s.campus || 'Imus Campus')}</div></td>
          <td>${escHtml(s.course)}<div style="font-size:11.5px;color:#64748b;">${escHtml(s.year_level)}</div></td>
          <td>${escHtml(s.mobile_number)}<div style="font-size:11.5px;color:#64748b;">${escHtml(s.email)}</div></td>
          <td><strong>${Number(s.active_loans_count || 0)}</strong> / 2</td>
          <td><span style="font-weight:700;font-size:11.5px;color:${statusColor};text-transform:uppercase;">${escHtml(s.account_status)}</span></td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="btn-tbl-sm btn-clearance-student" data-sno="${escHtml(s.student_number)}" style="color:#0f766e;border-color:#99f6e4;">Clearance</button>
              <button type="button" class="btn-tbl-sm btn-edit-student" data-sno="${escHtml(s.student_number)}">Edit</button>
              <button type="button" class="btn-tbl-sm btn-delete-student" data-sno="${escHtml(s.student_number)}" style="color:#dc2626;border-color:#fecaca;">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-clearance-student').forEach(btn => {
      btn.addEventListener('click', function() {
        const stu = cachedStudents.find(x => x.student_number === this.getAttribute('data-sno'));
        if (stu) openClearanceCertificateModal(stu);
      });
    });

    tbody.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', function() {
        const s = cachedStudents.find(x => x.student_number === this.getAttribute('data-sno'));
        if (!s) return;
        document.getElementById('editStudentNumber').value = s.student_number;
        document.getElementById('editStudentNumberDisplay').value = s.student_number;
        document.getElementById('editStudentStatus').value = s.account_status || 'active';
        document.getElementById('editStudentName').value = s.full_name || '';
        document.getElementById('editStudentEmail').value = s.email || '';
        document.getElementById('editStudentMobile').value = s.mobile_number || '';
        document.getElementById('editStudentCourse').value = s.course || '';
        document.getElementById('editStudentYear').value = s.year_level || '1st Year';
        document.getElementById('editStudentModal').classList.add('active');
      });
    });

    tbody.querySelectorAll('.btn-delete-student').forEach(btn => {
      btn.addEventListener('click', async function() {
        const sno = this.getAttribute('data-sno');
        const confirmed = await askConfirmation(
          'Delete Student',
          `Remove student ${sno} from library records? This cannot be undone.`,
          'Delete Student'
        );
        if (!confirmed) return;
        const engine = window.CvsuCirculationEngine;
        if (!engine || !engine.API_BASE) return;
        const res = await engine.deleteStudentRemote(sno);
        showToast(res.message, res.ok ? 'success' : 'error');
        if (res.ok) await loadStudents();
      });
    });
  }

  async function loadStudents() {
    const engine = window.CvsuCirculationEngine;
    if (!engine || !engine.API_BASE) return;
    const res = await engine.listStudentsRemote();
    if (res.ok) {
      cachedStudents = res.data;
      const q = document.getElementById('studentSearchInput')?.value || '';
      renderStudentsTable(q);
    }
  }

  const studentSearchInput = document.getElementById('studentSearchInput');
  if (studentSearchInput) {
    studentSearchInput.addEventListener('input', function() {
      renderStudentsTable(this.value);
    });
  }

  const editStudentModal = document.getElementById('editStudentModal');
  document.getElementById('closeEditStudentBtn').addEventListener('click', () => editStudentModal.classList.remove('active'));
  document.getElementById('cancelEditStudentBtn').addEventListener('click', () => editStudentModal.classList.remove('active'));
  document.getElementById('editStudentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const engine = window.CvsuCirculationEngine;
    if (!engine || !engine.API_BASE) return;
    const res = await engine.updateStudentRemote({
      studentNumber: document.getElementById('editStudentNumber').value.trim(),
      accountStatus: document.getElementById('editStudentStatus').value,
      fullName: document.getElementById('editStudentName').value.trim(),
      email: document.getElementById('editStudentEmail').value.trim(),
      mobileNumber: document.getElementById('editStudentMobile').value.trim(),
      course: document.getElementById('editStudentCourse').value.trim(),
      yearLevel: document.getElementById('editStudentYear').value
    });
    showToast(res.message, res.ok ? 'success' : 'error');
    if (res.ok) {
      editStudentModal.classList.remove('active');
      await loadStudents();
    }
  });

  let selectedClearanceData = null;
  function openClearanceCertificateModal(stu) {
    const engine = window.CvsuCirculationEngine;
    const modal = document.getElementById('clearanceCertModal');
    const bodyEl = document.getElementById('clearanceModalBody');
    const printBtn = document.getElementById('printClearanceCertBtn');
    const activeLoans = engine ? engine.getActiveLoansForStudent(stu.student_number) : [];
    const unpaidFines = engine ? engine.getUnpaidFinesForStudent(stu.student_number) : [];
    const todayStr = engine ? engine.toYmd(new Date()) : new Date().toISOString().split('T')[0];
    const accruedOverdue = activeLoans.reduce((s, l) => s + (engine ? engine.calculateOverdueFine(l.dueDate, todayStr).fineAmount : 0), 0);
    const unpaidSum = unpaidFines.reduce((s, f) => s + Number(f.fineAmount || 0), 0) + accruedOverdue;
    const isCleared = activeLoans.length === 0 && unpaidSum <= 0 && (stu.account_status || 'active') === 'active';

    selectedClearanceData = { stu, activeLoans, unpaidSum, isCleared, todayStr };
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="padding: 12px 14px; border-radius: 8px; border: 1px solid ${isCleared ? '#86efac' : '#fecaca'}; background: ${isCleared ? '#f0fdf4' : '#fef2f2'}; margin-bottom: 12px;">
          <strong style="color: ${isCleared ? '#166534' : '#dc2626'}; font-size: 14px;">
            ${isCleared ? 'CLEARED FOR SEMESTRAL / GRADUATION CLEARANCE' : 'HOLD: PENDING LIBRARY OBLIGATIONS'}
          </strong>
          <div style="font-size: 12px; color: #334155; margin-top: 4px;">
            Student: <strong>${esc(stu.full_name)}</strong> (${esc(stu.student_number)}) • ${esc(stu.course)} (${esc(stu.year_level)})
          </div>
        </div>
        <div style="font-size: 12.5px; line-height: 1.7; color: #0f172a;">
          <div>• Account Status: <strong>${esc((stu.account_status || 'active').toUpperCase())}</strong></div>
          <div>• Unreturned Active Books: <strong>${activeLoans.length}</strong></div>
          <div>• Unpaid / Accrued Fines: <strong>₱${unpaidSum.toFixed(2)}</strong></div>
        </div>
      `;
    }
    if (printBtn) {
      printBtn.disabled = !isCleared;
      printBtn.style.opacity = isCleared ? '1' : '0.5';
    }
    if (modal) modal.classList.add('active');
  }

  const clearanceModal = document.getElementById('clearanceCertModal');
  document.getElementById('closeClearanceModalBtn')?.addEventListener('click', () => clearanceModal?.classList.remove('active'));
  document.getElementById('cancelClearanceBtn')?.addEventListener('click', () => clearanceModal?.classList.remove('active'));
  document.getElementById('printClearanceCertBtn')?.addEventListener('click', function() {
    if (!selectedClearanceData || !selectedClearanceData.isCleared) return;
    const { stu, todayStr } = selectedClearanceData;
    const admin = getAdmin();
    const win = window.open('', '_blank', 'width=760,height=620');
    if (!win) {
      showToast('Allow popups to print Library Clearance Certificate.', 'error');
      return;
    }
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    win.document.write(`<!DOCTYPE html><html><head><title>Library Clearance - ${esc(stu.student_number)}</title></head><body style="font-family:Arial,sans-serif;padding:40px;color:#0f172a;">
      <div style="border:3px double #065f46;padding:30px;border-radius:10px;">
        <h2 style="margin:0;text-align:center;color:#065f46;">CAVITE STATE UNIVERSITY — IMUS CAMPUS</h2>
        <p style="margin:4px 0 22px 0;text-align:center;font-size:13px;color:#475569;">UNIVERSITY LIBRARY &amp; LEARNING RESOURCES CENTER</p>
        <h3 style="text-align:center;text-decoration:underline;margin:0 0 20px 0;">CERTIFICATE OF LIBRARY CLEARANCE</h3>
        <p style="font-size:14px;line-height:1.7;">This certifies that <strong>${esc(stu.full_name)}</strong> (Student No. <strong>${esc(stu.student_number)}</strong>), enrolled in <strong>${esc(stu.course)} (${esc(stu.year_level)})</strong>, has <strong>NO unreturned books and NO unsettled library fines</strong> as of <strong>${esc(todayStr)}</strong>.</p>
        <div style="margin-top:44px;display:flex;justify-content:space-between;font-size:13px;">
          <div>Issued by: <strong>${esc(admin.fullName)}</strong><br><span style="color:#475569;">${esc(admin.role)} (${esc(admin.employeeId)})</span></div>
          <div>Clearance Ref: <strong>CLR-${esc(stu.student_number)}-${esc(todayStr.replace(/-/g, ''))}</strong><br><span style="color:#16a34a;font-weight:700;">STATUS: CLEARED</span></div>
        </div>
      </div>
      <script>window.print();<\/script>
    </body></html>`);
    win.document.close();
  });

  document.getElementById('batchPrintStudentQrBtn')?.addEventListener('click', function() {
    const q = (document.getElementById('studentSearchInput')?.value || '').trim().toLowerCase();
    const list = cachedStudents.filter(s => !q || String(s.student_number).toLowerCase().includes(q) || String(s.full_name).toLowerCase().includes(q) || String(s.course).toLowerCase().includes(q));
    if (list.length === 0) {
      showToast('No registered students match the current filter.', 'error');
      return;
    }
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const cardsHtml = list.map(stu => {
      let qrImg = '';
      if (typeof QRCode !== 'undefined') {
        const temp = document.createElement('div');
        temp.style.position = 'absolute';
        temp.style.left = '-9999px';
        document.body.appendChild(temp);
        try {
          new QRCode(temp, {
            text: JSON.stringify({ type: 'CVSU_STUDENT_QR', studentNo: stu.student_number, name: stu.full_name, course: stu.course }),
            width: 110,
            height: 110,
            correctLevel: 1,
            colorDark: '#00875a',
            colorLight: '#ffffff'
          });
          const canvas = temp.querySelector('canvas');
          const src = canvas ? canvas.toDataURL('image/png') : (temp.querySelector('img')?.src || '');
          if (src) qrImg = `<img src="${src}" style="width:110px;height:110px;">`;
        } finally {
          temp.remove();
        }
      }
      return `
        <div style="border:1.5px solid #00875a;border-radius:8px;padding:12px;text-align:center;page-break-inside:avoid;">
          <div style="font-size:10px;font-weight:800;color:#00875a;border-bottom:1px solid #00875a;padding-bottom:4px;margin-bottom:8px;">CvSU IMUS LIBRARY PASS</div>
          ${qrImg}
          <div style="font-family:monospace;font-weight:800;font-size:12px;margin-top:6px;">${esc(stu.student_number)}</div>
          <div style="font-size:11.5px;font-weight:700;">${esc(stu.full_name)}</div>
          <div style="font-size:10px;color:#475569;">${esc(stu.course)} · ${esc(stu.year_level)}</div>
        </div>
      `;
    }).join('');

    const win = window.open('', '_blank', 'width=940,height=720');
    if (!win) {
      showToast('Allow popups to print Batch Student QR Passes.', 'error');
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Batch Student QR Passes</title></head><body style="font-family:Arial,sans-serif;padding:20px;">
      <h3 style="margin:0 0 12px 0;color:#065f46;">CvSU Imus Library — Batch Student QR ID Cards (${list.length})</h3>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">${cardsHtml}</div>
      <script>window.print();<\/script>
    </body></html>`);
    win.document.close();
  });

  document.getElementById('loanMonitorFilter')?.addEventListener('change', render);
  document.getElementById('exportOverdueFollowupBtn')?.addEventListener('click', function() {
    const engine = window.CvsuCirculationEngine;
    if (!engine) return;
    const todayStr = engine.toYmd(new Date());
    const overdueLoans = engine.getLoans().filter(l => (l.status === 'borrowed' || l.status === 'overdue') && engine.calculateOverdueFine(l.dueDate, todayStr).isOverdue);
    if (overdueLoans.length === 0) {
      showToast('No overdue books right now.', 'info');
      return;
    }
    const rows = overdueLoans.map(l => {
      const calc = engine.calculateOverdueFine(l.dueDate, todayStr);
      return [l.ref, l.studentNo, l.studentName || '', l.bookTitle, l.borrowDate, l.dueDate, calc.overdueDays, calc.fineAmount.toFixed(2)];
    });
    const csv = [['Transaction Code', 'Student No', 'Student Name', 'Book Title', 'Borrow Date', 'Due Date', 'Chargeable Days', 'Accrued Fine (PHP)'], ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cvsu_overdue_followup_${todayStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${overdueLoans.length} overdue follow-up record(s).`, 'success');
  });

  // Logout handler (topbar & sidebar)
  const handleAdminLogout = function() {
    showToast('Admin session terminated.', 'info');
    if (window.CvsuRouteGuard) {
      window.CvsuRouteGuard.logout('../index.html', SESSION_ADMIN_KEY);
      return;
    }
    sessionStorage.removeItem(SESSION_ADMIN_KEY);
    setTimeout(() => window.location.href = '../index.html', 500);
  };
  document.getElementById('adminLogoutBtn').addEventListener('click', handleAdminLogout);
  const sidebarLogoutBtn = document.getElementById('sidebarAdminLogoutBtn');
  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleAdminLogout);

  // Collapsible Sidebar & Module View Switcher
  function initAdminSidebar() {
    const SIDEBAR_PREF_KEY = 'cvsu_admin_sidebar_collapsed';
    const sidebarToggleBtn = document.getElementById('adminSidebarToggle');
    const topbarToggleBtn = document.getElementById('adminTopbarToggleBtn');
    const backdrop = document.getElementById('adminSidebarBackdrop');
    const container = document.getElementById('adminDashboardContainer');

    try {
      if (localStorage.getItem(SIDEBAR_PREF_KEY) === 'true' && window.innerWidth > 960) {
        document.body.classList.add('admin-sidebar-collapsed');
      }
    } catch (e) {}

    const toggleSidebar = () => {
      if (window.innerWidth <= 960) {
        const isOpen = document.body.classList.toggle('admin-sidebar-mobile-open');
        if (backdrop) backdrop.classList.toggle('active', isOpen);
      } else {
        const collapsed = document.body.classList.toggle('admin-sidebar-collapsed');
        try { localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? 'true' : 'false'); } catch (e) {}
      }
    };

    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);
    if (topbarToggleBtn) topbarToggleBtn.addEventListener('click', toggleSidebar);
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        document.body.classList.remove('admin-sidebar-mobile-open');
        backdrop.classList.remove('active');
      });
    }

    document.querySelectorAll('.admin-nav-btn[data-admin-view]').forEach(btn => {
      btn.addEventListener('click', function() {
        const view = this.getAttribute('data-admin-view') || 'all';
        document.querySelectorAll('.admin-nav-btn[data-admin-view]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        if (container) container.setAttribute('data-admin-section', view);
        if (window.innerWidth <= 960) {
          document.body.classList.remove('admin-sidebar-mobile-open');
          if (backdrop) backdrop.classList.remove('active');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    document.querySelectorAll('[data-jump-view]').forEach(btn => {
      btn.addEventListener('click', function() {
        const view = this.getAttribute('data-jump-view');
        const navBtn = document.querySelector(`.admin-nav-btn[data-admin-view="${view}"]`);
        if (navBtn) navBtn.click();
      });
    });

    document.querySelectorAll('[data-subtab-group][data-subtab-value]').forEach(tabBtn => {
      tabBtn.addEventListener('click', function() {
        const group = this.getAttribute('data-subtab-group');
        const val = this.getAttribute('data-subtab-value');
        document.querySelectorAll(`[data-subtab-group="${group}"]`).forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        if (container) container.setAttribute(`data-${group}-tab`, val);
      });
    });
  }
  initAdminSidebar();

  document.addEventListener('DOMContentLoaded', async function() {
    let isHeadLibrarian = true;
    let verifiedRole = null;
    if (window.CvsuRouteGuard) {
      const sessionData = await window.CvsuRouteGuard.requireSession('admin', '../index.html', SESSION_ADMIN_KEY);
      if (!sessionData) return;
      verifiedRole = sessionData.role;
      isHeadLibrarian = ['Head Librarian', 'Library Admin', 'Admin', 'System Administrator'].includes(sessionData.role);
      if (!isHeadLibrarian) {
        const bSql = document.getElementById('backupSqlBtn');
        const bJson = document.getElementById('backupJsonBtn');
        const bRestore = document.getElementById('restoreBackupBtn');
        const staffSec = document.getElementById('staffManagementSection');
        const staffNav = document.getElementById('sidebarStaffItem');
        if (bSql) bSql.style.display = 'none';
        if (bJson) bJson.style.display = 'none';
        if (bRestore) bRestore.style.display = 'none';
        if (staffSec) staffSec.style.display = 'none';
        if (staffNav) staffNav.style.display = 'none';
      }
    }
    render();
    if (verifiedRole) {
      applyRoleLabels(verifiedRole);
    }
    const bookSearchInp = document.getElementById('adminBookSearchInput');
    const bookCatSel = document.getElementById('adminBookCategoryFilter');
    const bookAvailSel = document.getElementById('adminBookAvailFilter');
    if (bookSearchInp) bookSearchInp.addEventListener('input', render);
    if (bookCatSel) bookCatSel.addEventListener('change', render);
    if (bookAvailSel) bookAvailSel.addEventListener('change', render);

    const syncOffBtn = document.getElementById('adminSyncOfflineBtn');
    const runOfflineSync = async () => {
      const eng = window.CvsuCirculationEngine;
      if (!eng || typeof eng.flushOfflineQueue !== 'function') return;
      const res = await eng.flushOfflineQueue();
      if (res && res.synced > 0) {
        showToast(`Synced ${res.synced} queued offline transaction(s) to MySQL.`, 'success');
        render();
      }
    };
    if (syncOffBtn) syncOffBtn.addEventListener('click', runOfflineSync);
    window.addEventListener('online', runOfflineSync);

    if (window.CvsuCirculationEngine) {
      if (typeof window.CvsuCirculationEngine.flushOfflineQueue === 'function') {
        window.CvsuCirculationEngine.flushOfflineQueue().then(syncRes => {
          if (syncRes && syncRes.synced > 0) {
            showToast(`Auto-synced ${syncRes.synced} offline transaction(s).`, 'success');
          }
        });
      }
      window.CvsuCirculationEngine.syncFromServer().then(res => {
        if (res && res.ok) render();
      });
      loadStudents();
    }
    initReportsAndCsv();
    initSystemAdminTools();
    initReservationsAndStaff(isHeadLibrarian);

    const adminPwdForm = document.getElementById('adminChangePasswordForm');
    if (adminPwdForm) {
      adminPwdForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const engine = window.CvsuCirculationEngine;
        if (!engine || !engine.API_BASE) {
          showToast('Changing password requires active server connection.', 'error');
          return;
        }
        const currentPassword = document.getElementById('adminCurPassword')?.value || '';
        const newPassword = document.getElementById('adminNewPassword')?.value || '';
        const confirmPassword = document.getElementById('adminConfirmPassword')?.value || '';
        if (newPassword.length < 8) {
          showToast('New password must be at least 8 characters.', 'error');
          return;
        }
        if (newPassword !== confirmPassword) {
          showToast('New password and confirmation do not match.', 'error');
          return;
        }
        const btn = document.getElementById('adminChangePasswordBtn');
        const origText = btn ? btn.textContent : '';
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Updating...';
        }
        try {
          const res = await fetch(`${engine.API_BASE}auth/changePassword.php`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
          });
          const json = await res.json();
          if (!res.ok || json.status !== 'success') {
            showToast(json.message || 'Could not update password.', 'error');
            return;
          }
          adminPwdForm.reset();
          showToast(json.message || 'Password updated successfully.', 'success');
        } catch (err) {
          showToast('Network error while updating password.', 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = origText;
          }
        }
      });
    }
  });

  function initReservationsAndStaff(isHeadLibrarian) {
    const engine = window.CvsuCirculationEngine;
    if (!engine || !engine.API_BASE) return;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    async function loadReservations() {
      const tbody = document.getElementById('adminReservationsTbody');
      if (!tbody) return;
      try {
        const res = await fetch(`${engine.API_BASE}books/reservations.php`, { credentials: 'same-origin' });
        const json = await res.json();
        if (json.status !== 'success') return;
        if (!json.data || json.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px;">No book reservations in queue.</td></tr>';
          return;
        }
        tbody.innerHTML = json.data.map(r => {
          const canAct = r.status === 'pending' || r.status === 'ready_for_pickup';
          return `
            <tr>
              <td><strong style="font-family:monospace;">${esc(r.student_number)}</strong><div style="font-size:11px;color:#64748b;">${esc(r.full_name)}</div></td>
              <td><strong>${esc(r.title)}</strong><div style="font-size:11px;color:#64748b;">${esc(r.book_code)} · ${esc(r.call_number)}</div></td>
              <td><strong>${Number(r.available_copies)}</strong> / ${Number(r.total_copies)}</td>
              <td><span class="badge-status">${esc(r.status.replace(/_/g, ' '))}</span></td>
              <td style="font-size:11.5px;color:#64748b;">${esc(r.created_at)}</td>
              <td>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                  ${r.status === 'pending' ? `<button type="button" class="btn-tbl-sm btn-res-action" data-id="${Number(r.id)}" data-action="mark_ready" style="color:#0284c7;">Mark Ready</button>` : ''}
                  ${canAct ? `<button type="button" class="btn-tbl-sm btn-res-action" data-id="${Number(r.id)}" data-action="fulfill" style="color:#16a34a;">Fulfill</button>` : ''}
                  ${canAct ? `<button type="button" class="btn-tbl-sm btn-res-action" data-id="${Number(r.id)}" data-action="cancel" style="color:#dc2626;">Cancel</button>` : '<span style="color:#94a3b8;font-size:11px;">Closed</span>'}
                </div>
              </td>
            </tr>
          `;
        }).join('');

        tbody.querySelectorAll('.btn-res-action').forEach(btn => {
          btn.addEventListener('click', async function() {
            const id = Number(this.getAttribute('data-id'));
            const action = this.getAttribute('data-action');
            const upd = await fetch(`${engine.API_BASE}books/reservations.php`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, action })
            });
            const updJson = await upd.json();
            showToast(updJson.message || 'Reservation updated.', updJson.status === 'success' ? 'success' : 'error');
            await loadReservations();
          });
        });
      } catch (e) {}
    }

    async function loadStaffAccounts() {
      if (!isHeadLibrarian) return;
      const tbody = document.getElementById('adminStaffTbody');
      if (!tbody) return;
      try {
        const res = await fetch(`${engine.API_BASE}staff/manage.php`, { credentials: 'same-origin' });
        const json = await res.json();
        if (json.status !== 'success') return;
        const roleOpts = ['Head Librarian', 'Circulation Desk Officer'];
        tbody.innerHTML = json.data.map(st => {
          const rowRoles = roleOpts.includes(st.role) ? roleOpts : [...roleOpts, st.role];
          return `
          <tr data-staff-id="${Number(st.id)}">
            <td><strong style="font-family:monospace;">${esc(st.employee_id)}</strong></td>
            <td><strong>${esc(st.full_name)}</strong><div style="font-size:11px;color:#64748b;">${esc(st.email)}</div></td>
            <td>
              <select class="form-control staff-role-sel" style="padding:4px 8px;font-size:12px;background:#fff;">
                ${rowRoles.map(ro => `<option value="${esc(ro)}" ${st.role === ro ? 'selected' : ''}>${esc(ro)}</option>`).join('')}
              </select>
            </td>
            <td>
              <select class="form-control staff-status-sel" style="padding:4px 8px;font-size:12px;background:#fff;">
                <option value="active" ${st.status === 'active' ? 'selected' : ''}>active</option>
                <option value="inactive" ${st.status === 'inactive' ? 'selected' : ''}>inactive</option>
              </select>
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="btn-tbl-sm btn-save-staff" data-id="${Number(st.id)}" style="color:#16a34a;">Save</button>
                <button type="button" class="btn-tbl-sm btn-reset-staff-pwd" data-id="${Number(st.id)}" data-emp="${esc(st.employee_id)}" style="color:#0284c7;border-color:#bae6fd;">Reset Pwd</button>
                <button type="button" class="btn-tbl-sm btn-del-staff" data-id="${Number(st.id)}" style="color:#dc2626;border-color:#fecaca;">Remove</button>
              </div>
            </td>
          </tr>
        `;
        }).join('');

        tbody.querySelectorAll('.btn-save-staff').forEach(btn => {
          btn.addEventListener('click', async function() {
            const row = this.closest('tr');
            const id = Number(this.getAttribute('data-id'));
            const role = row.querySelector('.staff-role-sel').value;
            const status = row.querySelector('.staff-status-sel').value;
            const r = await fetch(`${engine.API_BASE}staff/manage.php`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update', id, role, status })
            });
            const j = await r.json();
            showToast(j.message || 'Staff updated.', j.status === 'success' ? 'success' : 'error');
            await loadStaffAccounts();
          });
        });

        const resetPwdModal = document.getElementById('resetStaffPwdModal');
        const resetPwdIdInput = document.getElementById('resetStaffPwdTargetId');
        const resetPwdEmpLabel = document.getElementById('resetStaffPwdEmpLabel');
        const resetPwdInput = document.getElementById('resetStaffPwdInput');

        tbody.querySelectorAll('.btn-reset-staff-pwd').forEach(btn => {
          btn.addEventListener('click', function() {
            const id = Number(this.getAttribute('data-id'));
            const emp = this.getAttribute('data-emp') || 'staff';
            if (resetPwdIdInput) resetPwdIdInput.value = String(id);
            if (resetPwdEmpLabel) resetPwdEmpLabel.textContent = emp;
            if (resetPwdInput) resetPwdInput.value = '';
            if (resetPwdModal) resetPwdModal.classList.add('active');
          });
        });

        tbody.querySelectorAll('.btn-del-staff').forEach(btn => {
          btn.addEventListener('click', async function() {
            const id = Number(this.getAttribute('data-id'));
            const confirmed = await askConfirmation(
              'Remove Staff Account',
              'Remove this staff account? They will no longer be able to sign in.',
              'Remove Staff'
            );
            if (!confirmed) return;
            const r = await fetch(`${engine.API_BASE}staff/manage.php`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id })
            });
            const j = await r.json();
            showToast(j.message || 'Removed.', j.status === 'success' ? 'success' : 'error');
            await loadStaffAccounts();
          });
        });
      } catch (e) {}
    }

    document.getElementById('refreshReservationsBtn')?.addEventListener('click', loadReservations);
    document.getElementById('refreshStaffBtn')?.addEventListener('click', loadStaffAccounts);

    // Register New Staff Modal (Head Librarian)
    const registerStaffModal = document.getElementById('registerStaffModal');
    const registerStaffForm = document.getElementById('registerStaffForm');
    const openRegisterStaffBtn = document.getElementById('openRegisterStaffBtn');
    const closeRegisterStaffBtn = document.getElementById('closeRegisterStaffBtn');
    const cancelRegisterStaffBtn = document.getElementById('cancelRegisterStaffBtn');
    const closeRegisterStaffModal = () => {
      if (registerStaffModal) registerStaffModal.classList.remove('active');
    };
    if (openRegisterStaffBtn && registerStaffModal) {
      openRegisterStaffBtn.addEventListener('click', () => {
        if (registerStaffForm) registerStaffForm.reset();
        registerStaffModal.classList.add('active');
      });
    }
    if (closeRegisterStaffBtn) closeRegisterStaffBtn.addEventListener('click', closeRegisterStaffModal);
    if (cancelRegisterStaffBtn) cancelRegisterStaffBtn.addEventListener('click', closeRegisterStaffModal);
    if (registerStaffModal) {
      registerStaffModal.addEventListener('click', (e) => {
        if (e.target === registerStaffModal) closeRegisterStaffModal();
      });
    }

    if (registerStaffForm) {
      registerStaffForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const employeeId = (document.getElementById('staffRegEmpId')?.value || '').trim();
        const fullName = (document.getElementById('staffRegName')?.value || '').trim();
        const email = (document.getElementById('staffRegEmail')?.value || '').trim();
        const role = document.getElementById('staffRegRole')?.value || 'Circulation Desk Officer';
        const password = document.getElementById('staffRegPassword')?.value || '';
        const confirmPassword = document.getElementById('staffRegConfirmPassword')?.value || '';

        if (!employeeId || !fullName || !email) {
          showToast('Please fill in Employee ID, Full Name, and Email.', 'error');
          return;
        }
        if (password.length < 8) {
          showToast('Password must be at least 8 characters long.', 'error');
          return;
        }
        if (password !== confirmPassword) {
          showToast('Passwords do not match.', 'error');
          return;
        }

        const submitBtn = document.getElementById('submitRegisterStaffBtn');
        const origText = submitBtn ? submitBtn.textContent : 'Create Staff Account';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating...';
        }
        try {
          const res = await fetch(`${engine.API_BASE}auth/adminRegister.php`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, fullName, email, role, password, confirmPassword })
          });
          const json = await res.json();
          if (json.status !== 'success') {
            showToast(json.message || 'Could not register staff account.', 'error');
            return;
          }
          showToast(json.message || 'Staff account created and activated!', 'success');
          registerStaffForm.reset();
          closeRegisterStaffModal();
          await loadStaffAccounts();
        } catch (err) {
          showToast('Network error while creating staff account.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = origText;
          }
        }
      });
    }

    // Reset Staff Password Modal Handlers
    const resetPwdModalEl = document.getElementById('resetStaffPwdModal');
    const resetPwdFormEl = document.getElementById('resetStaffPwdForm');
    const closeResetPwdModal = () => {
      if (resetPwdModalEl) resetPwdModalEl.classList.remove('active');
    };
    document.getElementById('closeResetStaffPwdBtn')?.addEventListener('click', closeResetPwdModal);
    document.getElementById('cancelResetStaffPwdBtn')?.addEventListener('click', closeResetPwdModal);
    if (resetPwdModalEl) {
      resetPwdModalEl.addEventListener('click', (e) => {
        if (e.target === resetPwdModalEl) closeResetPwdModal();
      });
    }
    if (resetPwdFormEl) {
      resetPwdFormEl.addEventListener('submit', async function(e) {
        e.preventDefault();
        const id = Number(document.getElementById('resetStaffPwdTargetId')?.value || 0);
        const newPassword = document.getElementById('resetStaffPwdInput')?.value || '';
        if (id <= 0 || newPassword.length < 8) {
          showToast('Temporary password must be at least 8 characters long.', 'error');
          return;
        }
        const r = await fetch(`${engine.API_BASE}staff/manage.php`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset_password', id, newPassword })
        });
        const j = await r.json();
        showToast(j.message || 'Password reset.', r.ok && j.status === 'success' ? 'success' : 'error');
        if (r.ok && j.status === 'success') {
          resetPwdFormEl.reset();
          closeResetPwdModal();
        }
      });
    }

    loadReservations();
    loadStaffAccounts();
  }

  function initSystemAdminTools() {
    const engine = window.CvsuCirculationEngine;
    const holidaysTbody = document.getElementById('adminHolidaysTbody');
    const auditTbody = document.getElementById('adminAuditTbody');
    const auditFilter = document.getElementById('auditFilterSelect');
    if (!engine || !engine.API_BASE) return;

    async function loadHolidays() {
      const res = await fetch(`${engine.API_BASE}holidays/manage.php`, { credentials: 'same-origin' });
      const json = await res.json();
      if (json.status !== 'success' || !holidaysTbody) return;
      if (json.data.length === 0) {
        holidaysTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px;">No holidays configured.</td></tr>';
        return;
      }
      holidaysTbody.innerHTML = json.data.map(h => `
        <tr>
          <td><strong style="font-family:monospace;">${escHtml(h.holiday_date)}</strong></td>
          <td>${escHtml(h.description)}</td>
          <td><span style="font-size:11px;color:#475569;">${escHtml(h.holiday_type)}</span></td>
          <td><button type="button" class="btn-tbl-sm btn-del-holiday" data-id="${Number(h.id)}" style="color:#dc2626;border-color:#fecaca;">Remove</button></td>
        </tr>
      `).join('');

      holidaysTbody.querySelectorAll('.btn-del-holiday').forEach(btn => {
        btn.addEventListener('click', async function() {
          const id = Number(this.getAttribute('data-id'));
          const delRes = await fetch(`${engine.API_BASE}holidays/manage.php`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id })
          });
          const delJson = await delRes.json();
          showToast(delJson.message, delJson.status === 'success' ? 'success' : 'error');
          if (delJson.status === 'success') {
            await engine.syncFromServer();
            await loadHolidays();
          }
        });
      });
    }

    let cachedAuditRows = [];
    async function loadAuditLogs() {
      const actionType = auditFilter ? auditFilter.value : '';
      const qs = actionType ? `?action_type=${encodeURIComponent(actionType)}` : '';
      const res = await fetch(`${engine.API_BASE}audit/list.php${qs}`, { credentials: 'same-origin' });
      const json = await res.json();
      if (json.status !== 'success' || !auditTbody) return;
      cachedAuditRows = json.data;
      if (json.data.length === 0) {
        auditTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px;">No audit logs found.</td></tr>';
        return;
      }
      auditTbody.innerHTML = json.data.map(a => `
        <tr>
          <td><code style="font-size:11px;">${escHtml(a.action_type)}</code></td>
          <td><strong>${escHtml(a.student_number)}</strong></td>
          <td><strong>${escHtml(a.book_title)}</strong><div style="font-size:11px;color:#64748b;">${escHtml(a.details || '')}</div></td>
          <td style="font-size:11px;color:#64748b;white-space:nowrap;">${escHtml(a.created_at)}</td>
        </tr>
      `).join('');
    }

    const holidayForm = document.getElementById('addHolidayForm');
    if (holidayForm) {
      holidayForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const res = await fetch(`${engine.API_BASE}holidays/manage.php`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            holiday_date: document.getElementById('holidayDateInput').value,
            description: document.getElementById('holidayDescInput').value.trim(),
            holiday_type: document.getElementById('holidayTypeSelect').value
          })
        });
        const json = await res.json();
        showToast(json.message, json.status === 'success' ? 'success' : 'error');
        if (json.status === 'success') {
          holidayForm.reset();
          await engine.syncFromServer();
          await loadHolidays();
        }
      });
    }

    if (auditFilter) {
      auditFilter.addEventListener('change', loadAuditLogs);
    }

    document.getElementById('printAuditBtn').addEventListener('click', function() {
      const win = window.open('', '_blank', 'width=920,height=700');
      if (!win) {
        showToast('Allow popups to print audit log.', 'error');
        return;
      }
      const rowsHtml = cachedAuditRows.map(a => `<tr><td>${a.action_type}</td><td>${a.student_number}</td><td>${a.book_title}</td><td>${a.details || ''}</td><td>${a.created_at}</td></tr>`).join('');
      win.document.write(`<!DOCTYPE html><html><head><title>Circulation Audit Log</title></head><body style="font-family:Arial,sans-serif;padding:24px;">
        <h2 style="margin:0 0 4px 0;color:#065f46;">CvSU Imus Library - Circulation &amp; Staff Audit Log</h2>
        <p style="margin:0 0 14px 0;color:#475569;font-size:12.5px;">Printed on ${new Date().toLocaleString()}</p>
        <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f1f5f9;"><th>Action</th><th>Student No.</th><th>Book Title</th><th>Details</th><th>Timestamp</th></tr></thead>
          <tbody>${rowsHtml || '<tr><td colspan="5" align="center">No logs</td></tr>'}</tbody>
        </table>
      </body></html>`);
      win.document.close();
      win.focus();
      win.print();
    });

    document.getElementById('backupSqlBtn').addEventListener('click', function() {
      window.location.href = `${engine.API_BASE}system/backup.php?format=sql`;
      showToast('Downloading full SQL database backup...', 'success');
    });

    document.getElementById('backupJsonBtn').addEventListener('click', function() {
      window.location.href = `${engine.API_BASE}system/backup.php?format=json`;
      showToast('Downloading JSON database backup...', 'success');
    });

    let pendingRestoreFile = null;
    const restoreFileInput = document.getElementById('restoreBackupFile');
    const restoreModal = document.getElementById('restoreConfirmModal');
    const restoreSummaryEl = document.getElementById('restorePreviewSummary');
    const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');

    function closeRestoreModal() {
      if (restoreModal) restoreModal.classList.remove('active');
      pendingRestoreFile = null;
      if (restoreFileInput) restoreFileInput.value = '';
    }

    const closeRestoreModalBtn = document.getElementById('closeRestoreModalBtn');
    const cancelRestoreBtn = document.getElementById('cancelRestoreBtn');
    if (closeRestoreModalBtn) closeRestoreModalBtn.addEventListener('click', closeRestoreModal);
    if (cancelRestoreBtn) cancelRestoreBtn.addEventListener('click', closeRestoreModal);
    if (restoreModal) {
      restoreModal.addEventListener('click', function(e) {
        if (e.target === restoreModal) closeRestoreModal();
      });
    }

    if (restoreFileInput) {
      restoreFileInput.addEventListener('change', async function() {
        const file = this.files && this.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (!parsed || typeof parsed.tables !== 'object' || Array.isArray(parsed.tables)) {
            showToast('Invalid JSON backup file: missing "tables" object.', 'error');
            this.value = '';
            return;
          }
          const tableNames = Object.keys(parsed.tables);
          if (tableNames.length === 0) {
            showToast('Backup file contains no tables to restore.', 'error');
            this.value = '';
            return;
          }
          const escRestore = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
          let totalRows = 0;
          const breakdownHtml = tableNames.map(t => {
            const count = Array.isArray(parsed.tables[t]) ? parsed.tables[t].length : 0;
            totalRows += count;
            return `<li><code>${escRestore(t)}</code>: <strong>${count}</strong> row(s)</li>`;
          }).join('');
          if (restoreSummaryEl) {
            restoreSummaryEl.innerHTML = `
              <div><strong>File:</strong> ${escRestore(file.name)}</div>
              <div><strong>Exported At:</strong> ${escRestore(parsed.exported_at || 'Unknown')}</div>
              <div><strong>Total Rows:</strong> ${totalRows}</div>
              <ul style="margin: 8px 0 0 18px; padding: 0;">${breakdownHtml}</ul>
            `;
          }
          pendingRestoreFile = file;
          if (restoreModal) restoreModal.classList.add('active');
        } catch (err) {
          showToast('Could not parse JSON backup file.', 'error');
          this.value = '';
        }
      });
    }

    if (confirmRestoreBtn) {
      confirmRestoreBtn.addEventListener('click', async function() {
        if (!pendingRestoreFile) return;
        const origText = confirmRestoreBtn.textContent;
        confirmRestoreBtn.disabled = true;
        confirmRestoreBtn.textContent = 'Restoring...';
        try {
          const formData = new FormData();
          formData.append('backup_file', pendingRestoreFile);
          const res = await fetch(`${engine.API_BASE}system/restore.php`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
          });
          const json = await res.json();
          if (!res.ok || json.status !== 'success') {
            showToast(json.message || 'Database restore failed.', 'error');
            return;
          }
          showToast(json.message, 'success');
          closeRestoreModal();
          await engine.syncFromServer();
          render();
          await loadStudents();
          await loadHolidays();
          await loadAuditLogs();
        } catch (err) {
          showToast('Network error while restoring backup.', 'error');
        } finally {
          confirmRestoreBtn.disabled = false;
          confirmRestoreBtn.textContent = origText;
        }
      });
    }

    loadHolidays();
    loadAuditLogs();
  }

  function initReportsAndCsv() {
    const typeEl = document.getElementById('reportTypeSelect');
    const dateEl = document.getElementById('reportDateInput');
    const monthEl = document.getElementById('reportMonthInput');
    const dateGroup = document.getElementById('reportDateGroup');
    const monthGroup = document.getElementById('reportMonthGroup');
    const thead = document.getElementById('reportPreviewThead');
    const tbody = document.getElementById('reportPreviewTbody');
    const metaBanner = document.getElementById('reportMetaBanner');
    if (!typeEl || !dateEl || !monthEl) return;

    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    dateEl.value = todayIso;
    monthEl.value = todayIso.slice(0, 7);

    let lastReport = null;

    function toggleFilterInputs() {
      const t = typeEl.value;
      const isMonthly = t === 'monthly_transactions';
      const needsDate = t === 'daily_borrowing' || t === 'daily_return' || t === 'overdue_books';
      dateGroup.style.display = needsDate ? 'block' : 'none';
      monthGroup.style.display = isMonthly ? 'block' : 'none';
    }
    typeEl.addEventListener('change', toggleFilterInputs);
    toggleFilterInputs();

    function escapeCsvCell(v) {
      const s = String(v ?? '');
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function downloadCsv(filename, columns, rows) {
      const lines = [columns.map(escapeCsvCell).join(',')];
      rows.forEach(r => lines.push(r.map(escapeCsvCell).join(',')));
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function parseCsvText(text) {
      const rows = [];
      let row = [];
      let cur = '';
      let inQuotes = false;
      const clean = text.replace(/^\uFEFF/, '');
      for (let i = 0; i < clean.length; i++) {
        const ch = clean[i];
        if (inQuotes) {
          if (ch === '"' && clean[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            cur += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(cur.trim());
          cur = '';
        } else if (ch === '\r' || ch === '\n') {
          if (ch === '\r' && clean[i + 1] === '\n') i++;
          row.push(cur.trim());
          if (row.some(c => c !== '')) rows.push(row);
          row = [];
          cur = '';
        } else {
          cur += ch;
        }
      }
      if (cur !== '' || row.length > 0) {
        row.push(cur.trim());
        if (row.some(c => c !== '')) rows.push(row);
      }
      if (rows.length < 2) return [];
      const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
      return rows.slice(1).map(vals => {
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ''; });
        return obj;
      });
    }

    async function generateReport() {
      const engine = window.CvsuCirculationEngine;
      if (!engine || !engine.API_BASE) {
        showToast('Live reports require HTTP/MySQL server.', 'error');
        return null;
      }
      const params = new URLSearchParams({
        type: typeEl.value,
        date: dateEl.value || todayIso,
        month: monthEl.value || todayIso.slice(0, 7)
      });
      const res = await fetch(`${engine.API_BASE}reports/generate.php?${params.toString()}`, { credentials: 'same-origin' });
      const json = await res.json();
      if (json.status !== 'success') {
        showToast(json.message || 'Could not generate report.', 'error');
        return null;
      }
      lastReport = json;
      metaBanner.textContent = `${json.title} — ${json.subtitle} (${json.rows.length} record${json.rows.length === 1 ? '' : 's'})`;
      thead.innerHTML = '<tr>' + json.columns.map(c => `<th>${escHtml(c)}</th>`).join('') + '</tr>';
      if (json.rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${json.columns.length}" style="text-align:center;color:#94a3b8;padding:18px;">No records found for this report filter.</td></tr>`;
      } else {
        tbody.innerHTML = json.rows.map(r => '<tr>' + r.map(cell => `<td>${escHtml(cell)}</td>`).join('') + '</tr>').join('');
      }
      return json;
    }

    document.getElementById('generateReportBtn').addEventListener('click', generateReport);

    document.getElementById('exportReportCsvBtn').addEventListener('click', async function() {
      const rep = lastReport || await generateReport();
      if (!rep) return;
      downloadCsv(`${typeEl.value}_${todayIso}.csv`, rep.columns, rep.rows);
      showToast('Report exported to Excel-compatible CSV.', 'success');
    });

    document.getElementById('printReportBtn').addEventListener('click', async function() {
      const rep = lastReport || await generateReport();
      if (!rep) return;
      const win = window.open('', '_blank', 'width=960,height=700');
      if (!win) {
        showToast('Allow popups to print or save PDF.', 'error');
        return;
      }
      const tableHtml = `
        <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f1f5f9;">${rep.columns.map(c => `<th align="left">${escHtml(c)}</th>`).join('')}</tr></thead>
          <tbody>${rep.rows.length ? rep.rows.map(r => `<tr>${r.map(c => `<td>${escHtml(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${rep.columns.length}" align="center">No records</td></tr>`}</tbody>
        </table>
      `;
      win.document.write(`<!DOCTYPE html><html><head><title>${escHtml(rep.title)}</title></head><body style="font-family:Arial,sans-serif;padding:24px;">
        <h2 style="margin:0 0 4px 0;color:#065f46;">Cavite State University - Imus Campus Library</h2>
        <h3 style="margin:0 0 4px 0;">${escHtml(rep.title)}</h3>
        <p style="margin:0 0 16px 0;color:#475569;font-size:13px;">${escHtml(rep.subtitle)}</p>
        ${tableHtml}
      </body></html>`);
      win.document.close();
      win.focus();
      win.print();
    });

    document.getElementById('exportBooksCsvBtn').addEventListener('click', function() {
      const books = getBooksList();
      const cols = ['book_code', 'accession_number', 'classification_number', 'isbn', 'title', 'author', 'publisher', 'publication_year', 'category', 'call_number', 'total_copies', 'available_copies', 'room_use'];
      const rows = books.map(b => [b.id, b.accessionNumber, b.classificationNumber, b.isbn, b.title, b.author, b.publisher, b.publicationYear, b.category, b.location, b.totalCopies, b.availableCopies, b.isRoomUseOnly ? 'YES' : 'NO']);
      downloadCsv(`cvsu_books_export_${todayIso}.csv`, cols, rows);
      showToast('Exported books catalog CSV.', 'success');
    });

    document.getElementById('downloadBookTplBtn').addEventListener('click', function() {
      const cols = ['book_code', 'accession_number', 'classification_number', 'isbn', 'title', 'author', 'publisher', 'publication_year', 'category', 'call_number', 'total_copies', 'room_use'];
      const sample = [['BK-SAMPLE-01', 'ACC-2026-00999', '005.1', '978-0132350884', 'Clean Architecture', 'Robert C. Martin', 'Pearson', '2017', 'CS & IT', 'QA 76.76 .M37', '3', 'NO']];
      downloadCsv('cvsu_books_import_template.csv', cols, sample);
    });

    document.getElementById('importBooksFile').addEventListener('change', async function() {
      const file = this.files[0];
      if (!file) return;
      const text = await file.text();
      const rows = parseCsvText(text);
      if (rows.length === 0) {
        showToast('CSV file is empty or invalid.', 'error');
        this.value = '';
        return;
      }
      const engine = window.CvsuCirculationEngine;
      const res = await fetch(`${engine.API_BASE}books/import.php`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books: rows })
      });
      const json = await res.json();
      showToast(json.message || 'Import finished.', json.status === 'success' ? 'success' : 'error');
      if (json.status === 'success') {
        await engine.syncFromServer();
        render();
      }
      this.value = '';
    });

    document.getElementById('exportStudentsCsvBtn').addEventListener('click', async function() {
      await loadStudents();
      const cols = ['student_number', 'full_name', 'email', 'mobile_number', 'course', 'year_level', 'campus', 'account_status'];
      const rows = cachedStudents.map(s => [s.student_number, s.full_name, s.email, s.mobile_number, s.course, s.year_level, s.campus, s.account_status]);
      downloadCsv(`cvsu_students_export_${todayIso}.csv`, cols, rows);
      showToast('Exported students records CSV.', 'success');
    });

    document.getElementById('downloadStudentTplBtn').addEventListener('click', function() {
      const cols = ['student_number', 'full_name', 'email', 'mobile_number', 'course', 'year_level', 'campus', 'account_status'];
      const sample = [['202610099', 'Maria Clara Santos', 'maria.santos@cvsu.edu.ph', '09171239999', 'BS Information Technology', '1st Year', 'Imus Campus', 'active']];
      downloadCsv('cvsu_students_import_template.csv', cols, sample);
    });

    document.getElementById('importStudentsFile').addEventListener('change', async function() {
      const file = this.files[0];
      if (!file) return;
      const text = await file.text();
      const rows = parseCsvText(text);
      if (rows.length === 0) {
        showToast('CSV file is empty or invalid.', 'error');
        this.value = '';
        return;
      }
      const engine = window.CvsuCirculationEngine;
      const res = await fetch(`${engine.API_BASE}students/import.php`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: rows })
      });
      const json = await res.json();
      showToast(json.message || 'Import finished.', json.status === 'success' ? 'success' : 'error');
      if (json.status === 'success') {
        await loadStudents();
      }
      this.value = '';
    });
  }
  render();
})();
