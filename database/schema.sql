-- =========================================================================
-- Cavite State University - Imus Campus
-- Library Book Borrowing Management System (QR-Based)
-- Complete Database Schema: Milestones 1 to 5 (20% to 100%)
-- Database: cvsu_library_db
-- =========================================================================

CREATE DATABASE IF NOT EXISTS `cvsu_library_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cvsu_library_db`;

-- =========================================================================
-- MILESTONE 1 (20% SCOPE): Student Authentication & Account Registration
-- =========================================================================
CREATE TABLE IF NOT EXISTS `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_number` VARCHAR(30) NOT NULL UNIQUE,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `mobile_number` VARCHAR(15) NOT NULL,
  `date_of_birth` DATE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(120) DEFAULT 'CvSU Student',
  `course` VARCHAR(100) DEFAULT 'BS Information Technology',
  `campus` VARCHAR(100) DEFAULT 'Imus Campus',
  `account_status` ENUM('active', 'pending', 'inactive') DEFAULT 'active',
  `qr_token` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Pre-seeded Sample Account for Defense Testing
INSERT INTO `students` (`student_number`, `email`, `mobile_number`, `date_of_birth`, `password_hash`, `full_name`, `course`, `campus`, `qr_token`)
VALUES 
('202410001', 'juan.delacruz@cvsu.edu.ph', '09171234567', '2004-05-15', '$2y$10$wN1G78p6d/vHwZtYlE4.reVf.9c3uK7nI4.V9E/RkPq3L9q3G.K6a', 'Juan C. Dela Cruz', 'BS in Information Technology', 'Imus Campus', 'CVSU-202410001-PASS')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- =========================================================================
-- MILESTONE 2 (40% SCOPE): Book Catalog & Inventory Management
-- =========================================================================
CREATE TABLE IF NOT EXISTS `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_code` VARCHAR(30) NOT NULL UNIQUE,
  `isbn` VARCHAR(30) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `author` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `shelf_location` VARCHAR(100) NOT NULL,
  `total_copies` INT NOT NULL DEFAULT 1,
  `available_copies` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `books` (`book_code`, `isbn`, `title`, `author`, `category`, `shelf_location`, `total_copies`, `available_copies`)
VALUES 
('BK-1082', '978-0262046305', 'Introduction to Algorithms (4th Edition)', 'Thomas H. Cormen, Charles E. Leiserson', 'CS & IT', 'Section A-3 (Computer Science)', 5, 3),
('BK-3041', '978-0078022159', 'Database System Concepts (7th Edition)', 'Abraham Silberschatz, Henry F. Korth', 'CS & IT', 'Section A-4 (Database Systems)', 4, 2),
('BK-2015', '978-0132350884', 'Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', 'CS & IT', 'Section B-1 (Software Engineering)', 6, 5),
('BK-4099', '978-0136681557', 'Computer Networking: A Top-Down Approach', 'James F. Kurose, Keith W. Ross', 'Engineering', 'Section C-2 (Networks & Telecom)', 3, 3),
('BK-5520', '978-1337102063', 'Principles of Information Security (6th Ed)', 'Michael E. Whitman, Herbert J. Mattord', 'CS & IT', 'Section B-4 (Cybersecurity)', 4, 2),
('BK-6101', '978-0134204925', 'Modern Systems Analysis and Design', 'Jeffrey A. Hoffer, Joey George, Joseph Valacich', 'Business', 'Section D-1 (Information Systems)', 5, 5),
('BK-7742', '978-9710321155', 'Philippine History and Governance', 'F. Landa Jocano', 'General Education', 'Section E-2 (Filipiniana)', 8, 7),
('BK-8890', '978-9719808848', 'Purposive Communication: In Local and Global Contexts', 'C. Flores, E. Rosa', 'General Education', 'Section E-5 (Humanities)', 10, 9)
ON DUPLICATE KEY UPDATE `id`=`id`;

-- =========================================================================
-- MILESTONES 3 & 4 (60% & 80% SCOPE): Circulation Transactions & Due Dates
-- =========================================================================
CREATE TABLE IF NOT EXISTS `borrow_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_code` VARCHAR(40) NOT NULL UNIQUE,
  `student_id` INT NOT NULL,
  `book_id` INT NOT NULL,
  `borrow_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `return_date` DATE DEFAULT NULL,
  `status` ENUM('BORROWED', 'RETURNED', 'OVERDUE') DEFAULT 'BORROWED',
  `overdue_days` INT DEFAULT 0,
  `fine_amount` DECIMAL(8,2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================================
-- MILESTONE 5 (100% SCOPE): Activity Audit Logs & System Analytics
-- =========================================================================
CREATE TABLE IF NOT EXISTS `circulation_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `action_type` VARCHAR(50) NOT NULL,
  `student_number` VARCHAR(30) NOT NULL,
  `book_title` VARCHAR(255) NOT NULL,
  `details` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `circulation_audit_logs` (`action_type`, `student_number`, `book_title`, `details`)
VALUES
('ACCOUNT_REG', '202410001', 'System Account Activation', 'Pass QR Token Generated'),
('BORROW_QR', '202410001', 'Database System Concepts', 'Success (7-day loan issued)');
