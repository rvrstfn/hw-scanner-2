CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  employee TEXT NOT NULL,
  qr_data TEXT,
  barcode_data TEXT,
  extra TEXT
);
