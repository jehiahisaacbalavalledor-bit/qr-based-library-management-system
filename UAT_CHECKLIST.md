# CvSU Imus Library Management System — Client UAT & Defense Walkthrough Checklist

Use this quick 10-minute walkthrough to demonstrate and sign off every core module with the client or capstone panel.

---

## Pre-Demo Check
- [ ] Start MySQL (`cvsu_library_db` imported from `new-folder/database/schema.sql`) and start PHP server:
  ```bash
  php -S 127.0.0.1:8088 -t new-folder/public
  ```
- [ ] Run automated verification suite before demo (`22 passed, 0 failed`):
  ```bash
  php new-folder/tests/smoke_test.php --url=http://127.0.0.1:8088
  ```

---

## 1. Student Portal (`/index.html`, `/user/pages/dashboard.html`)
- [ ] **Student Sign Up (`/user/register.html`):** Confirm Full Name, Course, Year Level, Date of Birth, Mobile, and 8+ char password fields create a real MySQL student account.
- [ ] **Student Sign In (`/index.html`):** Sign in as `202410001` / `Password123!` and confirm Digital QR ID Card displays.
- [ ] **Reserve / Generate Borrow QR Slip:** Reserve a book or generate a `3-Day` borrow QR slip for a circulating title.
- [ ] **Change Password & Forgot Password:** Verify wrong current password rejects (`401`), valid change succeeds (`Account Security & Change Password` in Profile), and `/user/forgot-password.html` requires matching Student Number + Email + Date of Birth.

## 2. QR Spine Labels & Student Cards (`/admin/pages/books/books-qr.html`, `/admin/admin-dashboard.html`)
- [ ] **Sign In as Head Librarian (`/admin/admin-index.html`):** Use `LIB-2024-001` / `AdminPassword123!`.
- [ ] **Book QR Generator:** Preview single spine label and open **Batch Print Selected** (A4 3-col / 2-col / Thermal roll), then confirm **Sign Out** clears session.
- [ ] **Batch Student QR Cards:** Print or preview student QR pass cards from Admin Console.

## 3. Live Scanner, Fine Rules & Printable Receipt (`/admin/pages/transactions/scanner.html`)
- [ ] **Checkout via Scanner:** Use Quick Test Scan, webcam, or USB barcode input; confirm Room-Use-Only books (`BK-CVSU-006`) and >2-book quotas are blocked.
- [ ] **Printable Transaction Receipt:** Approve borrow and verify **BORROW RECEIPT** displays with `Print Transaction Receipt`.
- [ ] **Return, Renewal & ₱20/day Fine Engine:** Test advancing Return / Assessment Date over Fri–Sun or a configured Library Holiday (`adminHolidaysTbody`) to confirm Fri–Sun & holidays are skipped (`₱0` on exempt days, `₱20/weekday` chargeable), and verify **RETURN RECEIPT** updates automatically.

## 4. Library Administration, Clearance & Backup (`/admin/admin-dashboard.html`)
- [ ] **Clearance Certificate:** Click `Clearance` on a student row -> confirm eligibility check and printable Library Clearance Certificate.
- [ ] **Reservations Queue & Staff Management:** Mark a pending reservation `Ready` / `Fulfill`; update a staff account role/status or click `Reset Pwd` in Head Librarian Staff Management.
- [ ] **Reports, CSV & Backup/Restore:** Generate a Circulation/Fines report (print or CSV export), download JSON/SQL backup, and verify audit trail logging (`adminAuditTbody`).
