/**
 * Opportunity Record Extractor
 * Extracts Opportunity fields from Salesforce Lightning detail pages
 */

(function () {
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
     */
    function getPageTextLines() {
        const pageText = document.body.innerText;
        return pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }

    /**
     * Get the opportunity name
     */
    function getOpportunityName() {
        log('Looking for opportunity name...');
        const lines = getPageTextLines();

        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === 'Opportunity') {
                const nextLine = lines[i + 1];
                if (nextLine && !['Follow', 'Following', 'New Case', 'New Note', 'Clone', 'Edit', 'Delete'].includes(nextLine)) {
                    log('Name from text (after Opportunity):', nextLine);
                    return nextLine;
                }
            }
        }

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
     * Get the active stage using text-based parsing
     * Avoids intermixing with Lead status by using Opportunity-specific values
     */
    function getActiveStage() {
        log('Looking for active stage...');
        const lines = getPageTextLines();

        // Common Opportunity stage names
        const stageNames = [
            'Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition',
            'Id. Decision Makers', 'Perception Analysis', 'Proposal/Price Quote',
            'Negotiation/Review', 'Closed Won', 'Closed Lost'
        ];

        // Verify we're on Opportunity page before searching
        if (!window.location.href.includes('/lightning/r/Opportunity/')) {
            log('Not on Opportunity page');
            return null;
        }

        // Strategy 1: Find stage in page text that matches known values
        for (const stage of stageNames) {
            if (lines.includes(stage)) {
                log('Stage from known values:', stage);
                return stage;
            }
        }

        // Strategy 2: Use Stage label
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase() === 'stage' && lines[i + 1]) {
                const value = lines[i + 1];
                if (stageNames.some(s => s.toLowerCase() === value.toLowerCase())) {
                    log('Stage from label:', value);
                    return value;
                }
            }
        }

        // Strategy 3: Look in path but only for Opportunity-specific stages
        const pathContainer = document.querySelector('[class*="path" i]');
        if (pathContainer) {
            const pathText = pathContainer.innerText;
            for (const stage of stageNames) {
                if (pathText.includes(stage)) {
                    log('Stage from path text:', stage);
                    return stage;
                }
            }
        }

        log('Stage NOT FOUND');
        return null;
    }

    /**
     * Find field value by label
     */
    function getByLabel(labelText) {
        const normalizedLabel = labelText.trim().toLowerCase();
        log(`Looking for label: "${labelText}"`);

        const lines = getPageTextLines();

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase() === normalizedLabel) {
                if (lines[i + 1]) {
                    const value = lines[i + 1];
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
     * Get Account Name
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
     * Normalize amount to number
     */
    function normalizeAmount(amountStr) {
        if (!amountStr) return null;
        const cleaned = amountStr.replace(/[^0-9.\-]/g, '');
        const num = parseFloat(cleaned);
        log('Amount raw:', amountStr, '-> parsed:', num);
        return isNaN(num) ? null : num;
    }

    /**
     * Parse date to ISO format
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
     * Wait for content
     */
    async function waitForFreshContent(expectedId) {
        log('Waiting for fresh content, expected ID:', expectedId);
        await new Promise(r => setTimeout(r, 300));
        log('Content ready');
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

        await waitForFreshContent(id);

        const name = getOpportunityName();
        const amountRaw = getByLabel('Amount');
        const amount = normalizeAmount(amountRaw);
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

    // Expose to global scope
    window.extractRecordDetail = extractRecordDetail;
    window.getByLabel = getByLabel;
    window.getPageTextLines = getPageTextLines;
})();
