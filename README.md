# Korea Rental Asset Scanner

Simple inventory tool that lets employees select their name, scan the rental label (QR code + barcode), and stores the results for later review.

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install pillow  # only needed for zbarimg fallback scripts
python server.py
```

Open <http://localhost:8000> on a phone or computer. Select your name, press **Start camera**, and aim at the QR code or the barcode. Once both are captured, press **Submit scan** to write the record to SQLite (`data/inventory.db`).

## Dependencies

* `zbarimg` (optional, used previously to decode the label on the CLI)
* Modern browser (Chrome, Edge, Safari) with camera support. The page uses the ZXing browser build from JSDelivr CDN.

## Data export

Use `python export_scans.py` to dump the stored scans to `scan-export.csv`.
