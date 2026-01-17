/**
 * Contact Record Extractor
 * Extracts Contact fields from Salesforce Lightning detail pages
 */

(function () {
    const DEBUG = true;

    function log(...args) {
        if (DEBUG) console.log('[Contact Extractor]', ...args);
    }

    /**
     * Get Salesforce record ID from URL
     */
    function getContactRecordIdFromUrl() {
        const url = window.location.href;
        const match = url.match(/\/lightning\/r\/Contact\/([a-zA-Z0-9]{15,18})\//);
        if (match) {
            log('ID from URL:', match[1]);
            return match[1];
        }
        return null;
    }

    /**
     * Parse page text into structured lines
     */
    function getContactPageTextLines() {
        const pageText = document.body.innerText;
        return pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }

    /**
     * Get the Contact name from the record header
     */
    function getContactName() {
        log('Looking for contact name...');
        const lines = getContactPageTextLines();

        // Strategy 1: Find "Contact" label, name is on next line
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === 'Contact') {
                const nextLine = lines[i + 1];
                if (nextLine && !['Follow', 'Following', 'New Case', 'New Note', 'Clone', 'Edit', 'Delete', 'Submit for Approval'].includes(nextLine)) {
                    log('Name from text (after Contact):', nextLine);
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
     * Supports partial label matching for labels like "Phone (2)"
     */
    function getContactFieldByLabel(labelText, partialMatch = false) {
        const normalizedLabel = labelText.trim().toLowerCase();
        log(`Looking for label: "${labelText}" (partial: ${partialMatch})`);

        const lines = getContactPageTextLines();

        for (let i = 0; i < lines.length; i++) {
            const lineLC = lines[i].toLowerCase();
            const matches = partialMatch
                ? lineLC.startsWith(normalizedLabel)
                : lineLC === normalizedLabel;

            if (matches) {
                if (lines[i + 1]) {
                    const value = lines[i + 1];
                    const commonLabels = [
                        'Title', 'Account Name', 'Phone', 'Email', 'Contact Owner',
                        'Name', 'Address', 'Follow', 'New Case', 'New Note', 'Clone',
                        'Edit', 'Delete', 'Submit for Approval', 'Mailing Address'
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
    async function waitForContactContent(expectedId) {
        log('Waiting for fresh content, expected ID:', expectedId);
        await new Promise(r => setTimeout(r, 300));
        log('Content ready');
    }

    /**
     * Main extraction function for Contact records
     */
    async function extractContactRecordDetail() {
        log('========================================');
        log('Starting Contact extraction at', new Date().toISOString());
        log('Current URL:', window.location.href);
        log('========================================');

        const id = getContactRecordIdFromUrl();
        if (!id) {
            throw new Error('Could not determine Salesforce Contact record ID from URL');
        }

        await waitForContactContent(id);

        // Extract fields
        const name = getContactName();
        const title = getContactFieldByLabel('Title');
        const accountName = getContactFieldByLabel('Account Name');
        // Phone label might be "Phone (2)" or similar, use partial match
        const phone = getContactFieldByLabel('Phone', true);
        const email = getContactFieldByLabel('Email');
        const owner = getContactFieldByLabel('Contact Owner');

        const record = {
            id,
            objectType: 'contact',
            data: {
                name: name || null,
                title: title || null,
                accountName: accountName || null,
                phone: phone || null,
                email: email || null,
                owner: owner || null
            },
            sourceUrl: window.location.href,
            lastUpdated: Date.now()
        };

        log('=== EXTRACTED CONTACT RECORD ===');
        log(JSON.stringify(record, null, 2));

        return { record, relatedRecords: [] };
    }

    // Expose to global scope
    window.extractContactRecordDetail = extractContactRecordDetail;
})();
