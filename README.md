# QR-Based Library Book Borrowing Management System
### Cavite State University - Imus Campus (CvSU)

**Project Status:** Complete Multi-Milestone Integrated Library Management System (20% to 100%) with Admin Portal & Dual QR Code Circulation.

An intelligent library management and book borrowing system featuring student and administrative authentication, physical book QR spine label generation and printing, dynamic borrowing QR slips, circulation counter scanner, due date & penalty computation, and comprehensive library catalog management.

---

## 🎯 Capstone Development Roadmap & Deliverables

| Milestone | Scope | Modules Delivered | Status |
| :---: | :--- | :--- | :--- |
| **20%** | **Phase 1: Student & Admin Authentication** | Sign In, Registration, Admin Login/Register, CvSU Validation, Student QR ID Pass | **COMPLETED** |
| **40%** | **Phase 2: Book Inventory & Physical QR Generator** | Catalog Search, Book QR Spine Label Generator (`books-qr.html`), Stock Tracking | **COMPLETED** |
| **60%** | **Phase 3: QR Scanner & Circulation Desk** | Camera Scanner (`scanner.html`), Beep Audio, Dual QR Recognition (Book & Student), Instant Loan Desk | **COMPLETED** |
| **40% - 80%** | **Phase 4: Due Date Tracking & Penalty Computation** | Active Loans Tracker, Due Date Countdown, ₱20/day Overdue Fine (skips Fri-Sun & holidays), 1-Click Return | **COMPLETED** |
| **100%** | **Phase 5: Librarian Analytics & Admin Dashboard** | KPI Overview Cards, Due Today Banner, Admin Portal (`admin-dashboard.html`), Circulation Slips | **COMPLETED** |

---

## 🌟 Key Features

### 1. Dual QR Code System
- **Book Identification QR Code (`books-qr.html`)**: Generates official Cavite State University QR spine labels for physical books. Each printable sticker includes Book ID, Accession Number, Call Number, and Title label at the bottom.
- **Student Borrowing QR Pass / Slip (`dashboard.html`)**: Generates real-time loan QR passes containing verified student credentials, selected titles, loan duration, and transaction references.

### 2. Student & Admin Portals
- **Student Portal (`index.html`, `dashboard.html`)**: Student authentication, live catalog search, digital QR ID, active borrowings, and return history.
- **Admin & Librarian Portal (`admin-index.html`, `admin-dashboard.html`)**: Administrative authentication, staff access, book catalog management, and library controls.

### 3. Circulation Desk QR Scanner (`scanner.html`)
- Live webcam and USB/Bluetooth barcode gun scanner support.
- Automatic recognition of `CVSU_BOOK_QR` and student borrow tokens with POS sound effects.
- Room-use-only alerts for Special Collections and instant circulation log.

---

## 📁 Directory Structure
```
qr-based-library-management-system/
├── index.html                 # Student Sign In Page
├── register.html              # Student Registration Page
├── forgot-password.html       # Student Password Reset Page
├── dashboard.html             # Student Dashboard & Borrowing Hub
├── books-qr.html              # Book QR Label Generator & Catalog Printer
├── scanner.html               # Circulation Desk QR Scanner & Loan Processor
├── admin-index.html           # Admin Portal Login
├── admin-register.html        # Admin Account Registration
├── admin-dashboard.html       # Librarian & Admin Dashboard
├── css/
│   ├── style.css              # CvSU Green theme and shared component styles
│   ├── dashboard.css          # Modern dashboard grid, dark mode & layout
│   └── books-qr.css           # QR sticker print sheets and catalog UI
├── js/
│   ├── auth.js                # Student login & registration handlers
│   ├── admin.js               # Admin authentication and dashboard handlers
│   ├── dashboard.js           # Student circulation & borrow request logic
│   ├── books-qr.js            # Book catalog and sticker rendering
│   ├── scanner.js             # Camera stream, beep audio & scanner logic
│   └── qrcode.min.js          # QR code rendering engine (40-version support)
├── api/                       # PHP API backend for XAMPP / MySQL
│   ├── db.php                 # MySQL PDO connection
│   ├── login.php              # Student authentication endpoint
│   ├── register.php           # Student registration endpoint
│   ├── adminLogin.php         # Admin authentication endpoint
│   └── adminRegister.php      # Admin registration endpoint
├── database/
│   └── schema.sql             # MySQL relational database schema and seed data
├── assets/
│   └── logo.svg               # Vector University emblem
└── README.md
```

---

## 🚀 How to Run and Test

### Method 1: Direct Browser Launch (No server needed)
1. Open **`index.html`** directly in any modern web browser.
2. Sign in with demo credentials:
   - **Student Number:** `202410001`
   - **Password:** `Password123!`
3. Or open **`books-qr.html`** to generate and print book spine QR labels.
4. Open **`scanner.html`** to test camera or simulated scanning.

### Method 2: Local XAMPP Server
1. Move or clone the project folder into `C:\xampp\htdocs\qr-based-library-management-system`.
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. Import `database/schema.sql` into phpMyAdmin (`http://localhost/phpmyadmin`).
4. Access the system at:
   - Student Portal: `http://localhost/qr-based-library-management-system/`
   - Admin Portal: `http://localhost/qr-based-library-management-system/admin-index.html`
