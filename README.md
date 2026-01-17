# SF CRM Extractor

Chrome extension for extracting Salesforce Opportunity records from detail pages.

## Project Structure

```
crm-scraper/
├── manifest.json                    # Extension manifest v3
├── src/
│   ├── background/
│   │   └── service-worker.js        # Background service worker
│   ├── content/
│   │   ├── content-main.js          # Content script entry
│   │   └── extractors/
│   │       └── opportunity.js       # Opportunity field extractor
│   └── popup/
│       ├── index.html               # Popup UI
│       └── popup.js                 # Popup logic
├── dev/
│   ├── fixture-opportunity.html     # Test fixture HTML
│   ├── run_fixture_extraction.js    # Puppeteer test runner
│   └── extracted.json               # Output from test runner
└── README.md
```

## Installation

### Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `crm-scraper` folder
5. The extension icon should appear in your toolbar

## Usage

### Extract from Salesforce

1. Navigate to a Salesforce Opportunity record page  
   URL pattern: `https://*.lightning.force.com/lightning/r/Opportunity/{id}/view`
2. Click the extension icon to open the popup
3. Click **Extract Opportunity**
4. View extracted data in the popup
5. Click **Download JSON** to save all records locally

## Development

### Prerequisites

- Node.js 16+
- npm

### Install Dependencies

```bash
npm install puppeteer
```

### Run Fixture Test

The dev runner uses Puppeteer to test extraction on a static HTML fixture:

```bash
node dev/run_fixture_extraction.js
```

This will:
- Open `dev/fixture-opportunity.html` in headless Chrome
- Inject and run the extraction code
- Write results to `dev/extracted.json`
- Print extraction summary

### Manual Testing

1. Load the extension in Chrome
2. Open `dev/fixture-opportunity.html` in a browser tab
3. Open DevTools Console
4. Run: `window.runExtractionForDebug()`

## Messaging Protocol

### Popup → Background
```js
{ type: "REQUEST_EXTRACT" }
```

### Background → Content Script
```js
{ type: "PING" }                              // Handshake check
{ type: "RUN_EXTRACTION", requestId: "uuid" } // Run extraction
```

### Content Script → Background
```js
{ type: "PONG" }                                              // Handshake response
{ type: "EXTRACTION_RESULT", requestId: "uuid", payload: {} } // Success
{ type: "EXTRACTION_ERROR", requestId: "uuid", error: {} }    // Error
```

## Extracted Data Format

```json
{
  "id": "006gK00000AwFtmQAF",
  "objectType": "opportunity",
  "data": {
    "name": "test three",
    "amount": 12562156,
    "stage": "Qualification",
    "closeDate": "2026-01-16",
    "account": "Acme Corporation",
    "owner": "Tanmay Srivastava"
  },
  "sourceUrl": "https://...",
  "lastUpdated": 1737131036000
}
```

## Troubleshooting

### "Could not establish connection"
- Refresh the Salesforce page
- The extension will auto-inject the content script if needed

### Extraction returns null fields
- Wait for the page to fully load
- Some Lightning components load dynamically

### No PONG response
- The content script may not have loaded
- Click Extract again (auto-retry is built in)
