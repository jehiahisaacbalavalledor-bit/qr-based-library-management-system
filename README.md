# QR-Based Library Book Borrowing Management System
### Cavite State University - Imus Campus (CvSU)

An intelligent library book borrowing management system featuring student authentication, dynamic QR Code generation with student & book information, and a library circulation counter QR scanner that reads and processes loan transactions in real-time.

---

## 🌟 Key Features

### 1. Student Authentication & Registration
- **Sign In (`index.html`)**: Log in with Student Number & Password (based on official Student Portal branding).
- **Registration (`register.html`)**: Full account registration with 11-digit mobile validation (`09XXXXXXXXX`), birth date, and student ID formatting.
- **Pre-seeded Demo Student**:
  - **Student Number:** `202410001`
  - **Password:** `Password123!`

### 2. QR Code Generation for Book Borrowing (`dashboard.html`)
- When a student logs in, they can select a library book (e.g. *Clean Code*, *Head First Java*, *Database System Concepts*, etc.) or enter a custom title.
- Clicking **"Generate Book Borrowing QR Code"** creates an official **Library Borrowing QR Slip**:
  - Student Name (e.g., `Juan C. Dela Cruz`)
  - Student Number (e.g., `202410001`)
  - Course / Program (e.g., `BS in Information Technology`)
  - Contact Information
  - Book Title & Call Number
  - Issue Date & 14-day Due Date
  - Reference Code (e.g., `BRW-2026-8492`)
  - Scannable 2D QR Code rendered dynamically on-screen.
- Includes buttons to **"Print / Save Slip"** and **"Open Scanner to Read This QR Now"**.

### 3. Library QR Scanner & Reader (`scanner.html`)
- **Live Camera Scanner**: Opens your webcam/device camera with a targeting viewfinder and animated green laser beam.
- **Automatic QR Decoding**: As soon as the QR Code is positioned in view, the scanner:
  - 🔊 Plays an authentic **POS Barcode Scanner Beep** sound (Web Audio API).
  - ✨ Highlights with a green verification flash.
  - 📖 **Reads and displays all decoded student & borrowing details**:
    - Verified Student Name, Number, and Department
    - Book Title, Call Number, and Return Due Date
    - Transaction Reference Number
- **One-Click Quick Scan Buttons (Ideal for Presentations / Thesis Defense)**:
  - `⚡ Scan Latest Student Borrow Slip (Juan Dela Cruz)`
  - `⚡ Scan Student ID Pass (Maria Santos)`
- **Physical USB Scanner Support**: Automatically listens for USB/Bluetooth handheld barcode scanner gun keystrokes.
- **Circulation Log**: Records every scan in a real-time table with timestamps and status.

---

## 📁 Directory Structure
```
qr-based-library-management-system/
├── index.html                 # Student Sign In Page
├── register.html              # Account Registration Page
├── forgot-password.html       # Password Reset Page
├── dashboard.html             # Student Portal & Book Borrow QR Generator
├── scanner.html               # Library Circulation Counter QR Scanner
├── css/
│   └── style.css              # CvSU Green theme, viewfinder laser, QR slip styles
├── js/
│   ├── auth.js                # Login & registration authentication handlers
│   ├── dashboard.js           # Student profile & borrow QR slip generator
│   ├── scanner.js             # Camera stream, beep audio, QR reader & circulation log
│   └── qrcode.min.js          # Pure JavaScript offline QR generator
├── api/                       # Optional PHP backend for XAMPP
│   ├── db.php                 # MySQL PDO connection
│   ├── login.php              # POST /api/login.php
│   └── register.php           # POST /api/register.php
├── database/
│   └── schema.sql             # MySQL schema with sample students
├── assets/
│   └── logo.svg               # Vector Student Portal emblem
└── README.md
```

---

## 🚀 How to Run and Test

### Method 1: Direct Double-Click (No server needed)
1. Double click **[`index.html`](file:///c:/Users/janga/Downloads/qr-based-library-management-system/index.html)** in your browser.
2. Click **"Auto-fill"** or enter `202410001` and `Password123!`, then click **Sign In**.
3. In the student dashboard, pick a book and click **"Generate Book Borrowing QR Code"**.
4. Click **"Open Scanner to Read This QR Now"** (or open [`scanner.html`](file:///c:/Users/janga/Downloads/qr-based-library-management-system/scanner.html)).
5. The scanner reads the QR code, beeps, and displays the borrower's name, student number, and book!

### Method 2: Local Server (PHP / Node.js)
```powershell
cd "C:\Users\janga\Downloads\qr-based-library-management-system"
php -S localhost:8000
```
Then visit `http://localhost:8000` in your web browser.
