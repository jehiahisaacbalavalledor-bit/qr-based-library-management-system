# QR-Based Library Book Borrowing Management System
### Cavite State University - Imus Campus (CvSU)

An integrated full-stack library management and QR circulation system featuring Role-Based Access Control (RBAC), dual QR code checkout/return scanning, custom CvSU overdue penalty computation, book reservations, student clearance certificates, batch QR label/card printing, CSV import/export, and JSON/SQL backup & restore.

---

## Key Features

1. **Dual QR Code Circulation**
   - **Book QR Spine Label Generator** (`admin/pages/books/books-qr.html`): Generates single or batch A4/2-column/thermal printable QR stickers encoding Book ID, Accession Number, Call Number, and Title.
   - **Student Digital QR Pass & Borrow Slip** (`user/pages/dashboard.html`): Generates scannable student ID passes, borrow QR slips, and batch printable student QR cards (`admin/admin-dashboard.html`).
   - **Live Circulation Scanner & Receipt Printer** (`admin/pages/transactions/scanner.html`): Supports webcam scanning, USB barcode guns, manual QR/token entry, sound feedback, and one-click printable BORROW / RENEW / RETURN receipts.

2. **Smart Circulation & Fine Rules (`FineEngine` / `circulation-engine.js`)**
   - Enforces a **2-book active loan limit** per student and blocks **Room Use Only** items from checkout.
   - Prevents borrowing or renewals when a student has **unpaid fines**.
   - Supports **1–3 day** and **overnight** loans with up to **2 renewals**.
   - Calculates **₱20.00/day** overdue fines automatically **skipping Fridays, Saturdays, Sundays, and configured Library Holidays**.
   - Tracks damaged/lost book replacement requirements and fine settlement (`paid` / `waived`).

3. **Security, Authentication & RBAC**
   - Server-side PHP session RBAC (`backend/helpers/AuthGuard.php`) protecting 18+ API endpoints and `route-guard.js` protecting portal pages.
   - Bcrypt password verification (`password_verify`), active account checks, in-app password updates (`api/auth/changePassword.php`), DOB-verified student self-service password reset, and Head Librarian approval/reset controls for staff accounts.
   - HTML-escaped table rendering (`escHtml`) and same-origin session cookies across client calls.

4. **Librarian & System Administration (`admin/admin-dashboard.html`)**
   - Live KPIs, overdue/due-soon alert badges, overdue follow-up CSV export, daily/monthly/fine reports.
   - Book & Student CRUD + CSV bulk import/export templates.
   - Student **Library Clearance Certificate** verifier & printable slip.
   - **Book Reservations & Hold Queue** (student reserve/cancel + staff mark ready/fulfill).
   - **Head Librarian Staff Management** (role assignment, account activation/deactivation, temporary password reset).
   - **Holiday Calendar**, filterable **Circulation Audit Trail**, and **1-Click JSON/SQL Backup & Safe Restore**.

---

## Directory Structure

```text
qr-based-library-management-system/
├── README.md
└── new-folder/
    ├── backend/
    │   ├── config/
    │   │   └── db.php                  # MySQL PDO configuration (cvsu_library_db)
    │   └── helpers/
    │       ├── AuthGuard.php           # Session & RBAC enforcement
    │       └── FineEngine.php          # CvSU ₱20/day fine & holiday calculation
    ├── database/
    │   └── schema.sql                  # Full MySQL schema & seeded campus data
    ├── tests/
    │   └── smoke_test.php              # CLI schema, FineEngine & API smoke tests
    └── public/
        ├── index.html                  # Student Sign In (index.php redirects here)
        ├── user/
        │   ├── register.html
        │   ├── forgot-password.html
        │   └── pages/dashboard.html    # Student Dashboard, Borrow Slip & Reservations
        ├── admin/
        │   ├── admin-index.html        # Admin / Staff Sign In
        │   ├── admin-register.html     # Staff Registration (Head Librarian approval)
        │   ├── admin-forgot-password.html
        │   ├── admin-dashboard.html    # Main Librarian & Head Librarian Console
        │   ├── js/                     # dashboard.js, scanner.js, books-qr.js
        │   └── pages/
        │       ├── books/books-qr.html
        │       └── transactions/scanner.html
        ├── api/                        # Authenticated PHP REST endpoints
        │   ├── audit/, auth/, books/, circulation/
        │   ├── holidays/, reports/, staff/, students/, system/
        └── assets/
            ├── images/                 # University logo assets
            ├── js/                     # auth.js, circulation-engine.js, route-guard.js
            └── vendor/qrcode/          # Local qrcode.min.js bundle
```

---

## Quick Start (Local Development)

1. **Import the Database**
   - Start MySQL (e.g., via XAMPP) and import [`new-folder/database/schema.sql`](new-folder/database/schema.sql) (`cvsu_library_db`).
   - Check DB credentials in [`new-folder/backend/config/db.php`](new-folder/backend/config/db.php) (`localhost`, `root`, empty password by default — override via environment variables `CVSU_DB_HOST`, `CVSU_DB_NAME`, `CVSU_DB_USER`, `CVSU_DB_PASS` or an ignored `new-folder/backend/config/.env.php`).

2. **Serve the Application**
   ```bash
   php -S 127.0.0.1:8088 -t new-folder/public
   ```
   Or copy `new-folder/` under `htdocs/` in XAMPP Apache.

3. **Demo Accounts & UAT Walkthrough**
   - **Head Librarian:** Employee ID `LIB-2024-001` | Password `AdminPassword123!` (`/admin/admin-index.html`)
   - **Student:** Student No `202410001` (DOB `2004-05-15`) | Password `Password123!` (`/index.html`)
   - See [`UAT_CHECKLIST.md`](UAT_CHECKLIST.md) for a step-by-step client walkthrough & capstone demo checklist.

4. **Run Automated Smoke Tests**
   ```bash
   php new-folder/tests/smoke_test.php --url=http://127.0.0.1:8088
   ```
