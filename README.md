# QR-Based Library Book Borrowing Management System
### Cavite State University - Imus Campus (CvSU)
**Project Status:** Complete Multi-Milestone Integrated System (20% to 100%)

---

## 🎯 Capstone Development Roadmap & Deliverables

| Milestone | Scope | Modules Delivered | Status |
| :---: | :--- | :--- | :---: |
| **20%** | **Phase 1: Student Authentication & Registration** | Sign In, Registration, CvSU Validation, Student QR ID Pass | **COMPLETED** |
| **40%** | **Phase 2: Library Book Inventory & Catalog Search** | Live Keyword Search, Category Filters, Real-Time Stock Status | **COMPLETED** |
| **60%** | **Phase 3: QR Scanner & Circulation Desk** | QR Token Validation, Instant Book Checkout Kiosk, Loan Issue | **COMPLETED** |
| **80%** | **Phase 4: Due Date Tracking & Penalty Computation** | Active Loans Tracker, Due Date Countdown, ₱10/day Overdue Calculation, 1-Click Return | **COMPLETED** |
| **100%** | **Phase 5: Librarian Analytics, Audit Logs & Reports** | Live KPI Counters, Audit Trail, Printable Circulation Report Slip | **COMPLETED** |

---

## 🚀 How to Run the System

### Option 1: Direct Browser Launch (No installation required)
- Double-click **`index.html`** in your browser.
- Use demo credentials:
  - **Student Number:** `202410001`
  - **Password:** `Password123!`
- Once in `dashboard.html`, use the interactive **Milestone Controller** at the top to filter and test any milestone from 20% to 100% live.

### Option 2: Live Server / XAMPP
```powershell
# Using PHP local server:
php -S localhost:8000
```
Then visit `http://localhost:8000` in your browser.

---

## 🗄️ Database
- Database schema and seed data for all milestones are located in `database/schema.sql`.
