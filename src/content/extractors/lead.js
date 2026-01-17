/**
 * Lead Record Extractor
 * Extracts Lead fields from Salesforce Lightning detail pages
 */

(function () {
    const DEBUG = true;

    function log(...args) {
        if (DEBUG) console.log('[Lead Extractor]', ...args);
    }

    /**
     * Get Salesforce record ID from URL
     */
    function getLeadRecordIdFromUrl() {
        const url = window.location.href;
        const match = url.match(/\/lightning\/r\/Lead\/([a-zA-Z0-9]{15,18})\//);
        if (match) {
            log('ID from URL:', match[1]);
            return match[1];
        }
        return null;
    }

    /**
     * Parse page text into structured lines
     */
    function getLeadPageTextLines() {
        const pageText = document.body.innerText;
        return pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }

    /**
     * Get the Lead name from the record header
     */
    function getLeadName() {
        log('Looking for lead name...');
        const lines = getLeadPageTextLines();

        // Strategy 1: Find "Lead" label, name is on next line
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === 'Lead') {
                const nextLine = lines[i + 1];
                if (nextLine && !['Follow', 'Following', 'New Case', 'New Note', 'Clone', 'Edit', 'Delete', 'Convert', 'Submit for Approval'].includes(nextLine)) {
                    log('Name from text (after Lead):', nextLine);
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
    function getLeadFieldByLabel(labelText, partialMatch = false) {
        const normalizedLabel = labelText.trim().toLowerCase();
        log(`Looking for label: "${labelText}" (partial: ${partialMatch})`);

        const lines = getLeadPageTextLines();

        for (let i = 0; i < lines.length; i++) {
            const lineLC = lines[i].toLowerCase();
            const matches = partialMatch
                ? lineLC.startsWith(normalizedLabel)
                : lineLC === normalizedLabel;

            if (matches) {
                if (lines[i + 1]) {
                    const value = lines[i + 1];
                    const commonLabels = [
                        'Company', 'Email', 'Phone', 'Lead Source', 'Lead Status', 'Lead Owner',
                        'Title', 'Name', 'Address', 'Follow', 'New Case', 'New Note', 'Clone',
                        'Convert', 'Edit', 'Delete', 'Submit for Approval'
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
     * Get Lead Status using text-based parsing (not path selectors)
     * This avoids the intermixing issue with Opportunity stages
     */
    function getLeadStatus() {
        log('Looking for Lead Status...');
        const lines = getLeadPageTextLines();

        // Common Lead status values
        const leadStatusValues = [
            'Open - Not Contacted', 'Working - Contacted', 'Closed - Converted',
            'Closed - Not Converted', 'Converted', 'New', 'Contacted', 'Qualified',
            'Unqualified'
        ];

        // Strategy 1: Find in page text - look for known status values
        for (const status of leadStatusValues) {
            if (lines.includes(status)) {
                log('Status from known values:', status);
                return status;
            }
        }

        // Strategy 2: Look for Lead Status label
        const statusFromLabel = getLeadFieldByLabel('Lead Status');
        if (statusFromLabel) {
            return statusFromLabel;
        }

        // Strategy 3: Look for Status label
        const statusSimple = getLeadFieldByLabel('Status');
        if (statusSimple) {
            return statusSimple;
        }

        // Strategy 4: Find status path but only in Lead-specific context
        // Check if URL confirms we're on Lead page before using path
        if (window.location.href.includes('/lightning/r/Lead/')) {
            const pathContainer = document.querySelector('[class*="path" i]');
            if (pathContainer) {
                // Get the text and find the active status
                const pathText = pathContainer.innerText;
                for (const status of leadStatusValues) {
                    if (pathText.includes(status)) {
                        log('Status from path text:', status);
                        return status;
                    }
                }
            }
        }

        log('Lead Status NOT FOUND');
        return null;
    }

    /**
     * Wait for page content to be ready
     */
    async function waitForLeadContent(expectedId) {
        log('Waiting for fresh content, expected ID:', expectedId);
        await new Promise(r => setTimeout(r, 300));
        log('Content ready');
    }

    /**
     * Main extraction function for Lead records
     */
    async function extractLeadRecordDetail() {
        log('========================================');
        log('Starting Lead extraction at', new Date().toISOString());
        log('Current URL:', window.location.href);
        log('========================================');

        const id = getLeadRecordIdFromUrl();
        if (!id) {
            throw new Error('Could not determine Salesforce Lead record ID from URL');
        }

        await waitForLeadContent(id);

        // Extract fields
        const name = getLeadName();
        const company = getLeadFieldByLabel('Company');
        const email = getLeadFieldByLabel('Email');
        // Phone label might be "Phone (2)" or similar, use partial match
        const phone = getLeadFieldByLabel('Phone', true);

        const record = {
            id,
            objectType: 'lead',
            data: {
                name: name || null,
                company: company || null,
                email: email || null,
                phone: phone || null
            },
            sourceUrl: window.location.href,
            lastUpdated: Date.now()
        };

        log('=== EXTRACTED LEAD RECORD ===');
        log(JSON.stringify(record, null, 2));

        return record;
    }

    // Expose to global scope
    window.extractLeadRecordDetail = extractLeadRecordDetail;
})();
