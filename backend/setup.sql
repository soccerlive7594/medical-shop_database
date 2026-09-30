CREATE DATABASE IF NOT EXISTS medical_shop;
USE medical_shop;

DROP TABLE IF EXISTS restocks;
DROP TABLE IF EXISTS medicines;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medicines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  current_stock INT NOT NULL DEFAULT 0,
  minimum_stock INT NOT NULL DEFAULT 0,
  maximum_stock INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  supplier_id INT,
  rack_location VARCHAR(100) NOT NULL,
  expiry_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_medicines_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE TABLE restocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medicine_id INT NOT NULL,
  supplier_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(12,2) NOT NULL,
  restock_date DATE NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_restock_medicine
    FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_restock_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES
  ('Medico Plus', 'Ravi Sharma', '+91 9876543210', 'ravi@medicoplus.in', 'Banjara Hills, Hyderabad'),
  ('HealthBridge Labs', 'Anita Verma', '+91 9988776655', 'anita@healthbridge.in', 'Koramangala, Bengaluru'),
  ('Apex Pharma', 'Sandeep Nair', '+91 9123456780', 'sandeep@apexpharma.in', 'Andheri East, Mumbai'),
  ('Wellcare Distributors', 'Priya Iyer', '+91 9765432109', 'priya@wellcaredist.in', 'Saket, New Delhi');

INSERT INTO medicines (name, category, current_stock, minimum_stock, maximum_stock, unit_price, supplier_id, rack_location, expiry_date, description) VALUES
  ('Azithromycin', 'Antibiotic', 60, 80, 200, 42.50, 1, 'A1-02', '2027-06-15', 'Broad-spectrum antibiotic for bacterial infections.'),
  ('Ibuprofen', 'Pain Relief', 400, 350, 600, 18.75, 2, 'B3-08', '2028-02-12', 'Anti-inflammatory and analgesic medicine.'),
  ('Metformin', 'Diabetes', 160, 120, 200, 25.00, 3, 'C2-04', '2026-11-20', 'Oral diabetes medication for controlling blood sugar.'),
  ('Paracetamol', 'Fever', 250, 150, 300, 12.00, 1, 'A2-06', '2027-08-10', 'Common analgesic and antipyretic.'),
  ('Amoxicillin', 'Antibiotic', 118, 100, 180, 39.00, 2, 'A1-07', '2027-04-22', 'Penicillin group antibiotic for respiratory infections.'),
  ('Cough Syrup', 'Respiratory', 90, 80, 150, 55.00, 4, 'D1-11', '2026-12-30', 'Herbal cough syrup for cold symptoms.'),
  ('Vitamin D3', 'Supplements', 220, 120, 260, 28.50, 3, 'E4-02', '2028-01-18', 'Vitamin D supplement for bone health.'),
  ('Omeprazole', 'Gastrointestinal', 180, 150, 240, 31.00, 4, 'B1-15', '2027-05-07', 'Acid reflux and stomach ulcer medication.'),
  ('Amlodipine', 'Cardiac', 85, 90, 160, 22.50, 2, 'C4-09', '2027-09-24', 'Blood pressure medication for hypertension control.'),
  ('Cetirizine', 'Allergy', 310, 200, 350, 16.25, 1, 'D2-16', '2028-03-19', 'Antihistamine for allergies and itching.');

INSERT INTO restocks (medicine_id, supplier_id, quantity, unit_cost, total_cost, restock_date, remarks) VALUES
  (1, 1, 80, 36.50, 2920.00, '2025-05-12', 'Monthly purchase for antibiotics'),
  (2, 2, 120, 15.50, 1860.00, '2025-06-03', 'Bulk stock replenishment'),
  (3, 3, 60, 21.00, 1260.00, '2025-06-18', 'New shipment for diabetic care'),
  (4, 1, 90, 10.20, 918.00, '2025-07-02', 'High seasonal demand'),
  (5, 2, 40, 30.00, 1200.00, '2025-07-21', 'Restock for respiratory medicine'),
  (6, 4, 30, 48.00, 1440.00, '2025-08-14', 'Cold and flu preparation'),
  (7, 3, 70, 24.25, 1697.50, '2025-08-28', 'Supplement supply cycle'),
  (8, 4, 50, 27.00, 1350.00, '2025-09-04', 'Acid reflux treatment restock'),
  (9, 2, 45, 19.75, 888.75, '2025-09-15', 'Cardiac medicine refill'),
  (10, 1, 100, 14.10, 1410.00, '2025-09-22', 'Seasonal allergy demand');

INSERT INTO users (name, email, password, created_at) VALUES
  ('System Admin', 'admin@medicalshop.in', '$2b$10$L8d0W4i4iS9A1rD7M7Bu3Oqv0xvK6wF.1pfaeKwn96VbP4sO9wXbK', NOW());
