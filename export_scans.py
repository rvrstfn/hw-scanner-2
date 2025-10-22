"""Export stored scans to CSV for reporting."""

from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data" / "inventory.db"


def ensure_database() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                employee TEXT NOT NULL,
                qr_data TEXT,
                barcode_data TEXT,
                extra JSON
            )
            """
        )
        conn.commit()


def export_to_csv(output_path: Path) -> None:
    with sqlite3.connect(DB_PATH) as conn, output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["timestamp_utc", "employee", "qr_data", "barcode_data", "extra_json"])
        for row in conn.execute("SELECT created_at, employee, qr_data, barcode_data, extra FROM scans ORDER BY created_at"):
            writer.writerow(row)


if __name__ == "__main__":
    ensure_database()
    default_path = Path("scan-export.csv")
    export_to_csv(default_path)
    print(f"Exported scans to {default_path}")
