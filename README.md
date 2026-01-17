# SF CRM Extractor

A Chrome extension that extracts Salesforce CRM record data from Lightning Experience detail pages.

## Supported Objects

| Object | Fields Extracted |
|--------|------------------|
| **Opportunity** | Name, Amount, Close Date, Account, Owner |
| **Lead** | Name, Company, Email, Phone |
| **Contact** | Name, Title, Account Name, Email, Phone, Owner |
| **Account** | Name, Type, Phone, Website, Owner, Account Site, Industry |
| **Task** | Subject, Status, Priority, Due Date, Assigned To, Name, Related To |

---

## Installation

### Step 1: Download/Clone the Extension

```bash
git clone <repository-url>
cd crm-scraper
```

Or download and extract the ZIP file.

### Step 2: Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `crm-scraper` folder (the one containing `manifest.json`)
5. The extension icon will appear in your toolbar

### Step 3: Pin the Extension (Optional)

1. Click the puzzle piece icon in Chrome toolbar
2. Click the pin icon next to "SF CRM Extractor"

---

## Usage

1. Navigate to a Salesforce Lightning record page (e.g., `/lightning/r/Opportunity/006xxx/view`)
2. Click the **SF CRM Extractor** icon in your toolbar
3. Click **Extract Record**
4. View extracted data in the popup under the appropriate tab
5. Use **JSON** or **CSV** to export all data

### Features

- **Search**: Filter records by any field value
- **Delete**: Remove individual records
- **Tabs**: Organize by object type (Opps, Leads, Contacts, Accounts, Tasks)
- **Status Indicator**: Floating indicator on page shows extraction progress

---

## Architecture

### File Structure

```
crm-scraper/
├── manifest.json                    # Extension configuration
├── icons/                           # Extension icons
├── src/
│   ├── background/
│   │   └── service-worker.js        # Background service worker
│   ├── content/
│   │   ├── content-main.js          # Main content script & Shadow DOM indicator
│   │   └── extractors/              # Object-specific extractors
│   │       ├── opportunity.js
│   │       ├── lead.js
│   │       ├── contact.js
│   │       ├── account.js
│   │       └── task.js
│   └── popup/
│       ├── index.html               # Popup UI
│       └── popup.js                 # Popup logic
```

### Message Flow

```
┌─────────┐    REQUEST_EXTRACT    ┌────────────────┐
│  Popup  │ ───────────────────▶  │ Service Worker │
└─────────┘                       └───────┬────────┘
                                          │
                                   RUN_EXTRACTION
                                          │
                                          ▼
                                  ┌───────────────┐
                                  │ Content Script│
                                  │  (Extractor)  │
                                  └───────┬───────┘
                                          │
                                 EXTRACTION_RESULT
                                          │
                                          ▼
                               ┌─────────────────────┐
                               │ chrome.storage.local│
                               │  (salesforce_data)  │
                               └─────────────────────┘
```

---

## DOM Selection Strategy

### Why Text-Based Parsing?

Salesforce Lightning uses dynamic, complex DOM structures with:
- Shadow DOM components
- Dynamically generated class names
- SPA (Single Page Application) navigation that doesn't refresh the page

**Our solution**: Parse `document.body.innerText` to extract visible text content.

### Extraction Algorithm

```javascript
// 1. Get all visible text as lines
const pageText = document.body.innerText;
const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// 2. Find a field by its label
function getFieldByLabel(labelText) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase() === labelText.toLowerCase()) {
      // The value is typically on the next line
      const value = lines[i + 1];
      
      // Skip if the "value" is actually another label
      if (!isCommonLabel(value)) {
        return value;
      }
    }
  }
  return null; // Not found
}
```

### Record Name Extraction

```javascript
// Strategy 1: Find object type label, name follows
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === 'Opportunity') {
    return lines[i + 1]; // Next line is the record name
  }
}

// Strategy 2: DOM fallback
const primaryField = document.querySelector('lightning-formatted-text[slot="primaryField"]');
return primaryField?.textContent?.trim();
```

### Handling Dynamic Labels

Some labels include counts (e.g., "Phone (2)"):

```javascript
// Partial match for labels like "Phone (2)"
function getFieldByLabel(labelText, partialMatch = false) {
  const matches = partialMatch 
    ? line.toLowerCase().startsWith(labelText.toLowerCase())
    : line.toLowerCase() === labelText.toLowerCase();
}
```

### Filtering Invalid Values

We skip button labels and navigation text:

```javascript
const skipLabels = ['Follow', 'Edit', 'Delete', 'Clone', 'New Case', ...];
if (skipLabels.includes(potentialValue)) {
  continue; // Not a real value
}
```

---

## Storage Schema

All extracted data is stored in `chrome.storage.local` under a unified key:

```json
{
  "salesforce_data": {
    "opportunities": [
      {
        "id": "006gK00000xxxxxx",
        "objectType": "opportunity",
        "data": {
          "name": "Acme Deal",
          "amount": 50000,
          "closeDate": "2026-03-15",
          "account": "Acme Corp",
          "owner": "John Smith"
        },
        "sourceUrl": "https://org.lightning.force.com/lightning/r/Opportunity/006gK00000xxxxxx/view",
        "lastUpdated": 1737145000000
      }
    ],
    "leads": [
      {
        "id": "00QgK00000xxxxxx",
        "objectType": "lead",
        "data": {
          "name": "Jane Doe",
          "company": "Tech Corp",
          "email": "jane@techcorp.com",
          "phone": "(555) 123-4567"
        },
        "sourceUrl": "...",
        "lastUpdated": 1737145000000
      }
    ],
    "contacts": [...],
    "accounts": [...],
    "tasks": [...],
    "lastSync": 1737145000000
  }
}
```

### Deduplication

Records are deduplicated by Salesforce ID:

```javascript
const existingIndex = collection.findIndex(r => r.id === record.id);
if (existingIndex >= 0) {
  collection[existingIndex] = record; // Update existing
} else {
  collection.push(record); // Insert new
}
```

---

## Export Formats

### JSON Export

Complete data structure with metadata:

```json
{
  "opportunities": [...],
  "leads": [...],
  "contacts": [...],
  "accounts": [...],
  "tasks": [...],
  "exportedAt": "2026-01-17T18:00:00.000Z",
  "lastSync": 1737145000000
}
```

### CSV Export

Flat format with all fields:

```csv
id,objectType,name,amount,closeDate,account,owner,sourceUrl,lastUpdated
006gK...,opportunity,Acme Deal,50000,2026-03-15,Acme Corp,John Smith,https://...,2026-01-17T18:00:00.000Z
```

---

## Shadow DOM Status Indicator

A floating UI element appears on the Salesforce page during extraction:

| Status | Message | Color |
|--------|---------|-------|
| Extracting | "Extracting..." | Blue (animated spinner) |
| Success | "Success! Record extracted" | Green |
| Error | "Error: [message]" | Red |

Uses Shadow DOM for complete style isolation from Salesforce's CSS.

---

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Store extracted records locally |
| `tabs` | Get active tab URL to detect Salesforce pages |
| `activeTab` | Access current tab content |
| `scripting` | Execute content scripts for extraction |

---

## Development

### Debug in DevTools

On any Salesforce record page, open DevTools Console:

```javascript
// Manual extraction test
await window.runExtractionForDebug()

// View page text lines
window.getPageTextLines()
```

### Reload After Changes

1. Make code changes
2. Go to `chrome://extensions/`
3. Click the reload icon on the extension card
4. Refresh the Salesforce page

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Could not connect to page" | Refresh the Salesforce page |
| Fields showing "N/A" | Field may be empty or label text differs |
| Extension not loading | Check `chrome://extensions/` for errors |
| SPA navigation issues | Wait for page to fully load before extracting |

---

## License

MIT License
