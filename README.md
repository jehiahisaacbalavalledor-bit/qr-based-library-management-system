# QR-Based Library Book Borrowing Management System
### Cavite State University - Imus Campus (CvSU)
**Project Status:** Milestone 1 — 20% Minimum System Requirement Deliverable

---

## 🎯 20% Milestone Scope & Deliverables
This submission satisfies the **20% Phase 1 Minimum System Requirement** focusing on the **Student Authentication & Account Registration Module**:

1. **Sign In Page (`index.html` / `login.html`)**:
   - Replicated from Reference Image 1.
   - CvSU - Imus Campus branding and official Student Portal circuit emblem.
   - Inputs: `Student Number *` and `Password *`.
   - Centered `Forgot Password?` link.
   - Green `Sign In` button.
   - `Don't have an account yet? Register here` link.
   - Footer: `? Support | Walkthrough` modal guides.

2. **Account Registration Page (`register.html`)**:
   - Replicated from Reference Image 2.
   - Header divider and `Account Registration` title.
   - Inputs in exact order:
     - `Student Number *`
     - `Email Address *`
     - `Mobile Number *` with centered hint `Format: 11 digit number (09XXXXXXXXX)`
     - `Date of Birth *` (`mm/dd/yyyy`)
     - `Password *`
     - `Confirm Password *`
   - Green `Register` button.
   - `Already have an account ? Sign in here` link.
   - Footer: `? Portal Guide` modal.

3. **Prototype Dashboard & QR Pass (`dashboard.html`)**:
   - Demonstrates successful authentication and registration.
   - Generates the student's unique **Digital QR ID Pass** preview.
   - Displays a 20% Progress Bar and a Defense Roadmap for the panel.

4. **Lightweight Backend / API (20% Scope)**:
   - `api/login.php`: Validates credentials.
   - `api/register.php`: Registers students.
   - `database/schema.sql`: Single `students` table schema for Phase 1.
   - Works in **Dual Mode**: runs directly in browser (`file://`) or on XAMPP/Apache with MySQL.

---

## 🗺️ Capstone Development Roadmap (For Defense Panel)

| Milestone | Scope | Status |
| :---: | :--- | :---: |
| **20%** | **Phase 1: Student Authentication & Registration (UI, Validation, QR ID Pass)** | **COMPLETED (Current)** |
| **40%** | Phase 2: Library Book Inventory & Catalog Search | Upcoming |
| **60%** | Phase 3: QR Scanner & Circulation Desk (Borrow & Return Workflow) | Upcoming |
| **80%** | Phase 4: Due Date Tracking, SMS Alerts & Overdue Penalty Computation | Upcoming |
| **100%** | Phase 5: Librarian Analytics, Reports & Final Campus Rollout | Upcoming |

---

## 🚀 How to Run the 20% Prototype

### Option 1: Direct Browser Launch (No installation required)
- Double-click **`index.html`** in your browser.
- Use the quick **Auto-fill** button or demo credentials:
  - **Student Number:** `202410001`
  - **Password:** `Password123!`

### Option 2: Live Server / XAMPP
```powershell
# Using PHP local server:
php -S localhost:8000
```
Then visit `http://localhost:8000` in your browser.
