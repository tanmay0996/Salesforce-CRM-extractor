/**
 * Opportunity Record Extractor
 * Extracts Opportunity fields from Salesforce Lightning detail pages
 */

const DEBUG = true;

function log(...args) {
    if (DEBUG) console.log('[Extractor]', ...args);
}

/**
 * Get Salesforce record ID from URL
 */
function getRecordIdFromUrl() {
    const url = window.location.href;
    const match = url.match(/\/lightning\/r\/Opportunity\/([a-zA-Z0-9]{15,18})\//);
    if (match) {
        log('ID from URL:', match[1]);
        return match[1];
    }
    return null;
}

/**
 * Parse page text into structured lines
 * This is the most reliable method for SPA content
 */
function getPageTextLines() {
    const pageText = document.body.innerText;
    return pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

/**
 * Get the opportunity name - use text parsing for SPA compatibility
 */
function getOpportunityName() {
    log('Looking for opportunity name...');
    const lines = getPageTextLines();

    // Strategy 1: Find "Opportunity" label, name is on next line
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === 'Opportunity') {
            const nextLine = lines[i + 1];
            // Skip action buttons
            if (nextLine && !['Follow', 'Following', 'New Case', 'New Note', 'Clone', 'Edit', 'Delete'].includes(nextLine)) {
                log('Name from text (after Opportunity):', nextLine);
                return nextLine;
            }
        }
    }

    // Strategy 2: Look in the record header area of DOM
    // Query fresh each time
    const recordHeader = document.querySelector('records-lwc-highlights-panel, records-highlights2, .slds-page-header');
    if (recordHeader) {
        // Get text content and find the name pattern
        const headerText = recordHeader.innerText;
        const headerLines = headerText.split('\n').map(l => l.trim()).filter(Boolean);

        for (let i = 0; i < headerLines.length; i++) {
            if (headerLines[i] === 'Opportunity' && headerLines[i + 1]) {
                const name = headerLines[i + 1];
                if (!['Follow', 'Following', 'New Case', 'New Note', 'Clone'].includes(name)) {
                    log('Name from header text:', name);
                    return name;
                }
            }
        }
    }

    // Strategy 3: Get the lightning-formatted-text in primaryField slot
    const primaryField = document.querySelector('lightning-formatted-text[slot="primaryField"]');
    if (primaryField) {
        const text = primaryField.textContent?.trim();
        if (text) {
            log('Name from primaryField:', text);
            return text;
        }
    }

    log('Name NOT FOUND');
    return null;
}

/**
 * Get the active stage - use multiple strategies for SPA compatibility
 */
function getActiveStage() {
    log('Looking for active stage...');

    // Strategy 1: Parse from page text - find the stage that appears after stage path indicators
    const lines = getPageTextLines();

    // Common stage names in Salesforce
    const stageNames = [
        'Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition',
        'Id. Decision Makers', 'Perception Analysis', 'Proposal/Price Quote',
        'Negotiation/Review', 'Closed Won', 'Closed Lost',
        // Shortened versions shown in UI
        'Needs Anal', 'Value Prop', 'Id. Decision', 'Perception', 'Proposal/Pr', 'Negotiatio'
    ];

    // Strategy 2: Look for stage in path component - query fresh
    // The current/active stage usually has specific attributes
    const pathContainer = document.querySelector('[class*="path" i]');
    if (pathContainer) {
        // Get fresh innerText from path
        const pathText = pathContainer.innerText;
        const pathLines = pathText.split('\n').map(l => l.trim()).filter(Boolean);
        log('Path text lines:', pathLines);

        // Try to find which stage is marked as current by checking aria attributes
        const currentItems = pathContainer.querySelectorAll('[aria-selected="true"], .slds-is-current, .slds-is-active');
        for (const item of currentItems) {
            const stageText = item.textContent?.trim();
            if (stageText && stageText.length > 0 && stageText !== '✓') {
                log('Stage from aria/class current:', stageText);
                return stageText;
            }
        }

        // Look for path title in current item
        const currentTitle = pathContainer.querySelector('.slds-is-current .slds-path__title, .slds-is-active .slds-path__title');
        if (currentTitle) {
            const text = currentTitle.textContent?.trim();
            if (text) {
                log('Stage from current path title:', text);
                return text;
            }
        }
    }

    // Strategy 3: Find Stage field in the Details tab
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === 'stage' && lines[i + 1]) {
            const value = lines[i + 1];
            if (stageNames.some(s => s.toLowerCase().startsWith(value.toLowerCase().substring(0, 5)))) {
                log('Stage from text field:', value);
                return value;
            }
        }
    }

    // Strategy 4: Find any known stage name in the header/highlights area
    const highlightsText = document.querySelector('.slds-page-header, records-highlights2')?.innerText || '';
    for (const stage of stageNames) {
        if (highlightsText.includes(stage)) {
            log('Stage from highlights text:', stage);
            return stage;
        }
    }

    log('Stage NOT FOUND');
    return null;
}

/**
 * Find field value by label using text parsing
 */
function getByLabel(labelText) {
    const normalizedLabel = labelText.trim().toLowerCase();
    log(`Looking for label: "${labelText}"`);

    const lines = getPageTextLines();

    // Find the label and get the next line as value
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === normalizedLabel) {
            if (lines[i + 1]) {
                const value = lines[i + 1];
                // Make sure it's not another label
                const commonLabels = ['Account Name', 'Close Date', 'Amount', 'Opportunity Owner', 'Stage', 'Follow', 'New Case', 'New Note', 'Clone', 'Edit'];
                if (!commonLabels.some(l => value.toLowerCase() === l.toLowerCase())) {
                    log(`Found "${labelText}" via text:`, value);
                    return value;
                }
            }
        }
    }

    log(`"${labelText}" NOT FOUND`);
    return null;
}

/**
 * Get Account Name with special handling
 */
function getAccountName() {
    log('Looking for Account Name...');
    const lines = getPageTextLines();

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === 'account name') {
            const nextLine = lines[i + 1];
            const fieldLabels = ['Close Date', 'Amount', 'Opportunity Owner', 'Stage', 'Follow', 'New Case'];
            if (nextLine && !fieldLabels.some(l => nextLine.toLowerCase() === l.toLowerCase())) {
                log('Account Name found:', nextLine);
                return nextLine;
            } else {
                log('Account Name appears empty');
                return null;
            }
        }
    }
    return null;
}

/**
 * Normalize amount string to number
 */
function normalizeAmount(amountStr) {
    if (!amountStr) return null;
    const cleaned = amountStr.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    log('Amount raw:', amountStr, '-> parsed:', num);
    return isNaN(num) ? null : num;
}

/**
 * Parse date string to ISO format
 */
function parseToISODate(dateStr) {
    if (!dateStr) return null;
    try {
        const parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (parts) {
            const [, month, day, year] = parts;
            const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            log('Date raw:', dateStr, '-> ISO:', iso);
            return iso;
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
}

/**
 * Wait for page content to be ready after SPA navigation
 */
async function waitForFreshContent(expectedId) {
    log('Waiting for fresh content, expected ID:', expectedId);

    const maxWait = 2000;
    const checkInterval = 100;
    let waited = 0;

    while (waited < maxWait) {
        // Check if URL contains our expected ID
        if (window.location.href.includes(expectedId)) {
            // Check if page text includes the ID or related content has updated
            const pageText = document.body.innerText;
            // Give it a moment for content to render
            await new Promise(r => setTimeout(r, 200));
            log('Content appears ready after', waited + 200, 'ms');
            return;
        }
        await new Promise(r => setTimeout(r, checkInterval));
        waited += checkInterval;
    }

    log('Wait timed out, proceeding anyway');
}

/**
 * Main extraction function
 */
async function extractRecordDetail() {
    log('========================================');
    log('Starting extraction at', new Date().toISOString());
    log('Current URL:', window.location.href);
    log('========================================');

    const id = getRecordIdFromUrl();
    if (!id) {
        throw new Error('Could not determine Salesforce record ID from URL');
    }

    // Wait for content to be fresh for this specific record
    await waitForFreshContent(id);

    // Extract all fields fresh from current page text
    const name = getOpportunityName();
    const amountRaw = getByLabel('Amount');
    const amount = normalizeAmount(amountRaw);
    const stage = getActiveStage();
    const closeDateRaw = getByLabel('Close Date');
    const closeDate = parseToISODate(closeDateRaw);
    const account = getAccountName();
    const owner = getByLabel('Opportunity Owner');

    const record = {
        id,
        objectType: 'opportunity',
        data: {
            name: name || null,
            amount: amount,
            stage: stage || null,
            closeDate: closeDate || null,
            account: account || null,
            owner: owner || null
        },
        sourceUrl: window.location.href,
        lastUpdated: Date.now()
    };

    log('=== EXTRACTED RECORD ===');
    log(JSON.stringify(record, null, 2));

    return record;
}

// Make available globally
window.extractRecordDetail = extractRecordDetail;
window.getByLabel = getByLabel;
window.getPageTextLines = getPageTextLines;
