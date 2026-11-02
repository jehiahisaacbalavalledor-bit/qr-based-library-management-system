-- =========================================================================
-- Cavite State University - Imus Campus
-- Library Book Borrowing Management System (QR-Based)
-- Milestone 1: 20% Minimum System Requirement (User Authentication & Registration)
-- Database Schema: cvsu_library_db
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
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Pre-seeded Sample Account for 20% Defense Testing
INSERT INTO `students` (`student_number`, `email`, `mobile_number`, `date_of_birth`, `password_hash`, `full_name`, `course`, `campus`)
VALUES 
('202410001', 'juan.delacruz@cvsu.edu.ph', '09171234567', '2004-05-15', '$2y$10$wN1G78p6d/vHwZtYlE4.reVf.9c3uK7nI4.V9E/RkPq3L9q3G.K6a', 'Juan C. Dela Cruz', 'BS in Information Technology', 'Imus Campus')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- =========================================================================
-- FUTURE MILESTONES ROADMAP:
-- [ ] 40% Milestone: Book Catalog & Inventory Management
-- [ ] 60% Milestone: QR Circulation Desk & Self-Checkout Scanner
-- [ ] 80% Milestone: Returns, Overdue Computation & Penalty Tracker
-- [ ] 100% Milestone: Comprehensive Reporting & Final System Deployment
-- =========================================================================
