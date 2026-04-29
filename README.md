# Shivrudra Graphics Quotation & Invoice Manager

A fast, browser-based quotation and invoice desk for printing, branding, signage, gifts, industrial labels, and fabrication jobs.

## What is included

- Step-based quotation flow with 8 guided stages
- Dynamic categories, products, materials, and presets
- Real-time pricing engine with discount limits and admin margin view
- Draft saving, repeat-client autofill, quote duplication, and recent records
- Branded quotation PDF and invoice PDF generation in the browser
- Google Sheets integration contract through Google Apps Script
- Dashboard metrics for quotes, conversion, revenue, and follow-ups

## Files

- `index.html` - the web app shell
- `styles.css` - dashboard styling
- `config.js` - business config, local pricing master, presets, company details
- `app.js` - app logic, pricing engine, local storage, PDF generation, Apps Script sync
- `apps-script/Code.gs` - Google Apps Script backend for Sheets
- `assets/logo.svg` - placeholder logo that can be replaced with the official one

## Run locally

Because this is a static app, it can be opened directly in the browser:

- Open [`index.html`](./index.html)

The app works in local mode immediately. Add the Apps Script URL in **Settings** to enable Google Sheets sync.

## Google Apps Script setup

1. Create a Google Spreadsheet.
2. Open **Extensions > Apps Script**.
3. Paste the contents of [`apps-script/Code.gs`](./apps-script/Code.gs).
4. Bind the script to the spreadsheet and save.
5. Deploy as a **Web App**:
   - Execute as: `Me`
   - Who has access: `Anyone`
6. Copy the deployed Web App URL.
7. In the app, open **Settings** and paste the URL.

The script creates these sheets if they do not exist:

- `Quotations`
- `Invoices`
- `Pricing Master`
- `Clients`

## Pricing master notes

The frontend can use:

- the local `pricingMaster` in `config.js`, or
- the remote `Pricing Master` sheet via Apps Script bootstrap

The Apps Script `Pricing Master` sheet expects these columns:

1. Category
2. Product
3. Material
4. Unit Type
5. Base Rate
6. Material Cost
7. Print Cost
8. Installation Cost
9. Minimum Charge
10. Quality Economy
11. Quality Premium
12. Print Eco-solvent
13. Print UV
14. Print Offset
15. Print Screen
16. Color BW
17. Color Color

## Notes

- PDF generation uses `jsPDF` from CDN.
- If Google Sheets save fails, the app keeps the quotation as a local draft instead of generating a PDF.
- Replace `assets/logo.svg` and update `config.js` with the official company branding for production use.
