# Korea Rental Asset Scanner

Simple inventory tool that lets employees select their name, scan the rental label (QR code + barcode), and store the results for later review. The web UI runs entirely in the browser, while the API is implemented as Cloudflare Pages Functions backed by a D1 database.

## Local preview

```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install pillow  # only needed for zbarimg fallback scripts
python server.py
```

Open <http://localhost:8000> on a phone or computer. Select your name, take a clear photo of the asset label, press **Decode image**, then **Submit scan** to write the record to SQLite (`data/inventory.db`).

## Cloudflare Pages deployment

This repo is ready for Cloudflare Pages:

1. Ensure `wrangler` is logged in (`wrangler whoami`).
2. Install JS dependencies locally: `npm install`.
2. Create/apply database migrations locally:
   ```bash
   wrangler d1 migrations apply hw-scanner-inventory --local
   wrangler d1 migrations apply hw-scanner-inventory
   ```
3. Run a preview:
   ```bash
   wrangler pages dev public --d1=DB=hw-scanner-inventory
   ```
4. Deploy:
   ```bash
   wrangler pages deploy public
   ```

`wrangler.toml` already binds the D1 database as `env.DB`. Pages Functions are under `functions/api/*`.

## Dependencies

* `zbarimg` (optional, used previously to decode the label on the CLI)
* Modern browser (Chrome, Edge, Safari) with camera support. The page uses the ZXing browser build from JSDelivr CDN.

## Data export

Use `python export_scans.py` to dump the stored scans to `scan-export.csv`.
