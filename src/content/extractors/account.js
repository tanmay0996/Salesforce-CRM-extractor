/**
 * Account Record Extractor
 * Extracts Account fields from Salesforce Lightning detail pages
 */

(function () {
    const DEBUG = true;

    function log(...args) {
        if (DEBUG) console.log('[Account Extractor]', ...args);
    }

    /**
     * Get Salesforce record ID from URL
     */
    function getAccountRecordIdFromUrl() {
        const url = window.location.href;
        const match = url.match(/\/lightning\/r\/Account\/([a-zA-Z0-9]{15,18})\//);
        if (match) {
            log('ID from URL:', match[1]);
            return match[1];
        }
        return null;
    }

    /**
     * Parse page text into structured lines
     */
    function getAccountPageTextLines() {
        const pageText = document.body.innerText;
        return pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }

    /**
     * Get the Account name from the record header
     */
    function getAccountName() {
        log('Looking for account name...');
        const lines = getAccountPageTextLines();

        // Strategy 1: Find "Account" label, name is on next line
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === 'Account') {
                const nextLine = lines[i + 1];
                if (nextLine && !['Follow', 'Following', 'New Case', 'New Note', 'Clone', 'Edit', 'Delete', 'Submit for Approval'].includes(nextLine)) {
                    log('Name from text (after Account):', nextLine);
                    return nextLine;
                }
            }
        }

        // Strategy 2: Get from primaryField slot
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
     * Find field value by label using text parsing
     */
    function getAccountFieldByLabel(labelText, partialMatch = false) {
        const normalizedLabel = labelText.trim().toLowerCase();
        log(`Looking for label: "${labelText}" (partial: ${partialMatch})`);

        const lines = getAccountPageTextLines();

        for (let i = 0; i < lines.length; i++) {
            const lineLC = lines[i].toLowerCase();
            const matches = partialMatch
                ? lineLC.startsWith(normalizedLabel)
                : lineLC === normalizedLabel;

            if (matches) {
                if (lines[i + 1]) {
                    const value = lines[i + 1];
                    const commonLabels = [
                        'Type', 'Phone', 'Website', 'Account Owner', 'Account Site', 'Industry',
                        'Name', 'Follow', 'New Case', 'New Note', 'Clone', 'Edit', 'Delete',
                        'Submit for Approval', 'Description', 'Billing Address', 'Shipping Address'
                    ];
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
     * Wait for page content to be ready
     */
    async function waitForAccountContent(expectedId) {
        log('Waiting for fresh content, expected ID:', expectedId);
        await new Promise(r => setTimeout(r, 300));
        log('Content ready');
    }

    /**
     * Main extraction function for Account records
     */
    async function extractAccountRecordDetail() {
        log('========================================');
        log('Starting Account extraction at', new Date().toISOString());
        log('Current URL:', window.location.href);
        log('========================================');

        const id = getAccountRecordIdFromUrl();
        if (!id) {
            throw new Error('Could not determine Salesforce Account record ID from URL');
        }

        await waitForAccountContent(id);

        // Extract fields
        const name = getAccountName();
        const type = getAccountFieldByLabel('Type');
        const phone = getAccountFieldByLabel('Phone', true);
        const website = getAccountFieldByLabel('Website');
        const owner = getAccountFieldByLabel('Account Owner');
        const accountSite = getAccountFieldByLabel('Account Site');
        const industry = getAccountFieldByLabel('Industry');

        const record = {
            id,
            objectType: 'account',
            data: {
                name: name || null,
                type: type || null,
                phone: phone || null,
                website: website || null,
                owner: owner || null,
                accountSite: accountSite || null,
                industry: industry || null
            },
            sourceUrl: window.location.href,
            lastUpdated: Date.now()
        };

        log('=== EXTRACTED ACCOUNT RECORD ===');
        log(JSON.stringify(record, null, 2));

        return record;
    }

    // Expose to global scope
    window.extractAccountRecordDetail = extractAccountRecordDetail;
})();
