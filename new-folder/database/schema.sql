-- =========================================================================
-- Cavite State University - Imus Campus
-- Library Book Borrowing Management System (QR-Based)
-- Complete Production Database Schema: Students, Admins, Circulation & Fines
-- Database: cvsu_library_db
-- =========================================================================

CREATE DATABASE IF NOT EXISTS `cvsu_library_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cvsu_library_db`;

-- Drop tables in proper foreign key dependency order if resetting
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `book_copies`;
DROP TABLE IF EXISTS `book_reservations`;
DROP TABLE IF EXISTS `circulation_audit_logs`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `fines`;
DROP TABLE IF EXISTS `borrow_transactions`;
DROP TABLE IF EXISTS `library_holidays`;
DROP TABLE IF EXISTS `books`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `admins`;
DROP TABLE IF EXISTS `library_staff`;
SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================================
-- 1. ADMINS TABLE (For Admin Portal & Role-Based Access)
-- =========================================================================
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(30) NOT NULL UNIQUE,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `role` ENUM('Head Librarian', 'Circulation Desk Officer', 'Cataloger', 'System Administrator') DEFAULT 'Head Librarian',
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================================================================
-- 2. LIBRARY STAFF & CIRCULATION OFFICERS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS `library_staff` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `staff_id` VARCHAR(30) NOT NULL UNIQUE,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `contact_no` VARCHAR(20) DEFAULT NULL,
  `role` ENUM('admin', 'librarian', 'assistant') NOT NULL DEFAULT 'librarian',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================================================================
-- 3. REGISTERED STUDENTS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_number` VARCHAR(30) NOT NULL UNIQUE,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `mobile_number` VARCHAR(15) NOT NULL,
  `course` VARCHAR(100) NOT NULL DEFAULT 'BS Information Technology',
  `year_level` ENUM('1st Year', '2nd Year', '3rd Year', '4th Year') NOT NULL DEFAULT '1st Year',
  `campus` VARCHAR(100) NOT NULL DEFAULT 'Imus Campus',
  `date_of_birth` DATE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `account_status` ENUM('active', 'suspended', 'graduated') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================================================================
-- 4. BOOKS & INVENTORY CATALOG TABLE
-- Complete bibliographic, accession, classification, and availability data
-- =========================================================================
CREATE TABLE IF NOT EXISTS `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_code` VARCHAR(50) NOT NULL UNIQUE,             -- e.g. BK-CVSU-001 (Encoded in Book QR)
  `accession_number` VARCHAR(50) NOT NULL UNIQUE,      -- Accession barcoding number
  `call_number` VARCHAR(50) NOT NULL,                  -- Shelf location (e.g. QA 76.6 .C67)
  `classification_number` VARCHAR(50) NOT NULL,        -- DDC or LCC number
  `isbn` VARCHAR(30) DEFAULT NULL,
  `title` VARCHAR(255) NOT NULL,
  `author` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `publisher` VARCHAR(150) DEFAULT NULL,
  `publication_year` YEAR DEFAULT NULL,
  `total_copies` INT NOT NULL DEFAULT 1,
  `available_copies` INT NOT NULL DEFAULT 1,
  `is_room_use_only` TINYINT(1) NOT NULL DEFAULT 0,    -- 1 = Special / Thesis collection (Library Room Use Only)
  `marc_tags` TEXT DEFAULT NULL,                       -- JSON structured MARC 21 catalog tags
  `status` ENUM('available', 'borrowed', 'reserved', 'maintenance', 'lost') NOT NULL DEFAULT 'available',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================================================================
-- 5. CIRCULATION & BORROW TRANSACTIONS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS `borrow_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_code` VARCHAR(50) NOT NULL UNIQUE,      -- e.g. BRW-2026-0001
  `student_id` INT NOT NULL,
  `book_id` INT NOT NULL,
  `borrow_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `loan_type` ENUM('1_day', '2_days', '3_days', 'overnight') NOT NULL DEFAULT '3_days',
  `renewal_count` INT NOT NULL DEFAULT 0,
  `actual_return_date` DATE DEFAULT NULL,
  `return_status` ENUM('borrowed', 'returned', 'overdue', 'lost', 'damaged') NOT NULL DEFAULT 'borrowed',
  `book_condition` ENUM('good', 'minor_wear', 'damaged', 'lost') NOT NULL DEFAULT 'good',
  `librarian_id` INT DEFAULT NULL,                     -- Staff who approved and released the book
  `return_librarian_id` INT DEFAULT NULL,              -- Staff who received the returned book
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_trans_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trans_book` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================================
-- 6. PENALTIES & FINES TABLE
-- Custom CvSU Rule: ₱20.00/day excluding Fridays, Saturdays, Sundays, and Holidays
-- Also tracks identical replacement requirement for lost or damaged books
-- =========================================================================
CREATE TABLE IF NOT EXISTS `fines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `overdue_days` INT NOT NULL DEFAULT 0,               -- Chargeable days (excluding Fri-Sun & holidays)
  `fine_rate` DECIMAL(8,2) NOT NULL DEFAULT 20.00,    -- ₱20 per day
  `fine_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `book_condition` ENUM('good', 'damaged', 'lost') NOT NULL DEFAULT 'good',
  `replacement_status` ENUM('none', 'pending_replacement', 'replaced') NOT NULL DEFAULT 'none',
  `payment_status` ENUM('unpaid', 'paid', 'waived') NOT NULL DEFAULT 'unpaid',
  `settled_at` DATETIME DEFAULT NULL,
  `received_by` INT DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_fine_transaction` FOREIGN KEY (`transaction_id`) REFERENCES `borrow_transactions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fine_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================================
-- 7. SYSTEM HOLIDAYS CALENDAR TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS `library_holidays` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `holiday_date` DATE NOT NULL UNIQUE,
  `description` VARCHAR(150) NOT NULL,
  `holiday_type` ENUM('regular', 'special_non_working', 'school_holiday') DEFAULT 'regular',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================================================================
-- 8. AUDIT & ACTIVITY LOGS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `actor_type` ENUM('staff', 'student', 'system', 'admin') NOT NULL DEFAULT 'staff',
  `actor_id` INT DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `circulation_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `action_type` VARCHAR(50) NOT NULL,
  `student_number` VARCHAR(30) NOT NULL,
  `book_title` VARCHAR(255) NOT NULL,
  `details` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `book_reservations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `book_id` INT NOT NULL,
  `status` ENUM('pending', 'ready_for_pickup', 'fulfilled', 'cancelled') NOT NULL DEFAULT 'pending',
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_res_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_res_book` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `book_copies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_id` INT NOT NULL,
  `copy_number` INT NOT NULL,
  `copy_barcode` VARCHAR(64) NOT NULL UNIQUE,
  `condition_status` ENUM('available', 'borrowed', 'damaged', 'lost', 'room_use') NOT NULL DEFAULT 'available',
  `notes` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_copy_book` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================================
-- SEED DATA: Realistic CvSU Imus Campus Records
-- =========================================================================

-- 1. Seed Admins
INSERT INTO `admins` (`employee_id`, `full_name`, `email`, `role`, `password_hash`)
VALUES 
('LIB-2024-001', 'Prof. Maria C. Santos', 'admin@cvsu.edu.ph', 'Head Librarian', '$2y$12$eW2KWovIZjPhqEzYMz2z5ODM27inTndOYQkA8WisPtjRaT0OPz0iG')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- 2. Seed Library Staff
INSERT INTO `library_staff` (`staff_id`, `username`, `password_hash`, `full_name`, `email`, `contact_no`, `role`, `status`)
VALUES
('STF-2024-001', 'admin', '$2y$12$eW2KWovIZjPhqEzYMz2z5ODM27inTndOYQkA8WisPtjRaT0OPz0iG', 'Head Librarian Admin', 'library.admin@cvsu.edu.ph', '09170001111', 'admin', 'active'),
('STF-2024-002', 'librarian1', '$2y$12$eW2KWovIZjPhqEzYMz2z5ODM27inTndOYQkA8WisPtjRaT0OPz0iG', 'Maria Elena Santos, RL', 'elena.santos@cvsu.edu.ph', '09170002222', 'librarian', 'active')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- 3. Seed Students
INSERT INTO `students` (`student_number`, `full_name`, `email`, `mobile_number`, `course`, `year_level`, `campus`, `date_of_birth`, `password_hash`, `account_status`)
VALUES
('202410001', 'Juan C. Dela Cruz', 'juan.delacruz@cvsu.edu.ph', '09171234567', 'BS Information Technology', '3rd Year', 'Imus Campus', '2004-05-15', '$2y$12$IQarQO.S2EBx82MmD2JGIe2l998xyUMvMvkIq64RM.NaxgzIw322q', 'active'),
('202410002', 'Maria Clara De Los Reyes', 'maria.delosreyes@cvsu.edu.ph', '09181234568', 'BS Computer Science', '2nd Year', 'Imus Campus', '2005-08-20', '$2y$12$IQarQO.S2EBx82MmD2JGIe2l998xyUMvMvkIq64RM.NaxgzIw322q', 'active'),
('202410003', 'Paolo M. Gomez', 'paolo.gomez@cvsu.edu.ph', '09191234569', 'BS Business Management', '4th Year', 'Imus Campus', '2003-11-10', '$2y$12$IQarQO.S2EBx82MmD2JGIe2l998xyUMvMvkIq64RM.NaxgzIw322q', 'active')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- 4. Seed Books Catalog (With Call Numbers, Accession Numbers, MARC tag, & Room-Use Only Collections)
INSERT INTO `books` (`book_code`, `accession_number`, `call_number`, `classification_number`, `isbn`, `title`, `author`, `category`, `publisher`, `publication_year`, `total_copies`, `available_copies`, `is_room_use_only`, `marc_tags`, `status`)
VALUES
('BK-CVSU-001', 'ACC-2026-00101', 'QA 76.6 .C67', '005.1', '978-0132350884', 'Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', 'Computer Science & IT', 'Prentice Hall', 2008, 4, 3, 0, '{"245": "Clean Code", "100": "Robert C. Martin", "082": "005.1"}', 'available'),
('BK-CVSU-002', 'ACC-2026-00102', 'QA 76.73 .J38', '005.133', '978-1491910771', 'Head First Java (3rd Edition)', 'Kathy Sierra & Bert Bates', 'Computer Science & IT', 'O Reilly Media', 2022, 3, 3, 0, '{"245": "Head First Java", "100": "Kathy Sierra", "082": "005.133"}', 'available'),
('BK-CVSU-003', 'ACC-2026-00103', 'QA 76.9 .D3 S54', '005.74', '978-0078022159', 'Database System Concepts (7th Edition)', 'Abraham Silberschatz, Henry F. Korth', 'Information Technology', 'McGraw-Hill', 2019, 3, 2, 0, '{"245": "Database System Concepts", "100": "Abraham Silberschatz", "082": "005.74"}', 'available'),
('BK-CVSU-004', 'ACC-2026-00104', 'QA 76.58 .T36', '004.6', '978-0132126953', 'Computer Networks (5th Edition)', 'Andrew S. Tanenbaum, David J. Wetherall', 'Networking', 'Pearson', 2011, 2, 2, 0, '{"245": "Computer Networks", "100": "Andrew S. Tanenbaum", "082": "004.6"}', 'available'),
('BK-CVSU-005', 'ACC-2026-00105', 'QA 76.76 .C672', '005.276', '978-1118531648', 'Web Design with HTML, CSS, JavaScript and jQuery', 'Jon Duckett', 'Web Development', 'Wiley', 2014, 5, 4, 0, '{"245": "Web Design with HTML, CSS", "100": "Jon Duckett", "082": "005.276"}', 'available'),
('BK-CVSU-006', 'ACC-SPEC-00001', 'FIL QA 76.2 .C8', '378.599', 'N/A-SPECIAL-THESIS', 'CvSU Imus Campus Undergraduate IT Theses Compendium Vol. IV', 'CvSU Department of Computer Studies', 'Special Collections', 'CvSU Imus Publications', 2024, 1, 1, 1, '{"245": "IT Theses Compendium Vol. IV", "500": "Library Room Use Only"}', 'available')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- 5. Seed Philippine Holidays
INSERT INTO `library_holidays` (`holiday_date`, `description`, `holiday_type`)
VALUES
('2026-01-01', 'New Year\'s Day', 'regular'),
('2026-04-09', 'Araw ng Kagitingan', 'regular'),
('2026-05-01', 'Labor Day', 'regular'),
('2026-06-12', 'Independence Day', 'regular'),
('2026-08-31', 'National Heroes Day', 'regular'),
('2026-11-30', 'Bonifacio Day', 'regular'),
('2026-12-25', 'Christmas Day', 'regular'),
('2026-12-30', 'Rizal Day', 'regular')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- 6. Seed Sample Transactions
INSERT INTO `borrow_transactions` (`transaction_code`, `student_id`, `book_id`, `borrow_date`, `due_date`, `loan_type`, `renewal_count`, `return_status`, `book_condition`, `librarian_id`, `notes`)
VALUES
('BRW-2026-0001', 1, 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), '3_days', 0, 'borrowed', 'good', 1, 'Initial checkout with verified Student QR pass')
ON DUPLICATE KEY UPDATE `id`=`id`;

INSERT INTO `circulation_audit_logs` (`action_type`, `student_number`, `book_title`, `details`)
VALUES
('ACCOUNT_REG', '202410001', 'System Account Activation', 'Pass QR Token Generated'),
('BORROW_QR', '202410001', 'Database System Concepts', 'Success (3-day loan issued)');
