/**
 * Task Record Extractor
 * Extracts Task fields from Salesforce Lightning detail pages
 */

(function () {
    const DEBUG = true;

    function log(...args) {
        if (DEBUG) console.log('[Task Extractor]', ...args);
    }

    /**
     * Get Salesforce record ID from URL
     */
    function getTaskRecordIdFromUrl() {
        const url = window.location.href;
        const match = url.match(/\/lightning\/r\/Task\/([a-zA-Z0-9]{15,18})\//);
        if (match) {
            log('ID from URL:', match[1]);
            return match[1];
        }
        return null;
    }

    /**
     * Parse page text into structured lines
     */
    function getTaskPageTextLines() {
        const pageText = document.body.innerText;
        return pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }

    /**
     * Get the Task subject from the record header
     */
    function getTaskSubject() {
        log('Looking for task subject...');
        const lines = getTaskPageTextLines();

        // Strategy 1: Find "Task" label, subject is on next line
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === 'Task') {
                const nextLine = lines[i + 1];
                if (nextLine && !['Mark Complete', 'Edit Comments', 'Change Date', 'Create Follow-Up Task', 'Follow', 'Edit', 'Delete'].includes(nextLine)) {
                    log('Subject from text (after Task):', nextLine);
                    return nextLine;
                }
            }
        }

        // Strategy 2: Get from primaryField slot
        const primaryField = document.querySelector('lightning-formatted-text[slot="primaryField"]');
        if (primaryField) {
            const text = primaryField.textContent?.trim();
            if (text) {
                log('Subject from primaryField:', text);
                return text;
            }
        }

        log('Subject NOT FOUND');
        return null;
    }

    /**
     * Find field value by label using text parsing
     */
    function getTaskFieldByLabel(labelText, partialMatch = false) {
        const normalizedLabel = labelText.trim().toLowerCase();
        log(`Looking for label: "${labelText}" (partial: ${partialMatch})`);

        const lines = getTaskPageTextLines();

        for (let i = 0; i < lines.length; i++) {
            const lineLC = lines[i].toLowerCase();
            const matches = partialMatch
                ? lineLC.startsWith(normalizedLabel)
                : lineLC === normalizedLabel;

            if (matches) {
                if (lines[i + 1]) {
                    const value = lines[i + 1];
                    const commonLabels = [
                        'Subject', 'Assigned To', 'Status', 'Due Date', 'Priority', 'Name',
                        'Related To', 'Created By', 'Last Modified By', 'Comments',
                        'Mark Complete', 'Edit Comments', 'Change Date', 'Create Follow-Up Task',
                        'Details', 'Related', 'Follow', 'Edit', 'Delete'
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
    async function waitForTaskContent(expectedId) {
        log('Waiting for fresh content, expected ID:', expectedId);
        await new Promise(r => setTimeout(r, 300));
        log('Content ready');
    }

    /**
     * Main extraction function for Task records
     */
    async function extractTaskRecordDetail() {
        log('========================================');
        log('Starting Task extraction at', new Date().toISOString());
        log('Current URL:', window.location.href);
        log('========================================');

        const id = getTaskRecordIdFromUrl();
        if (!id) {
            throw new Error('Could not determine Salesforce Task record ID from URL');
        }

        await waitForTaskContent(id);

        // Extract fields
        const subject = getTaskSubject();
        const assignedTo = getTaskFieldByLabel('Assigned To');
        const status = getTaskFieldByLabel('Status');
        const dueDate = getTaskFieldByLabel('Due Date');
        const priority = getTaskFieldByLabel('Priority');
        const name = getTaskFieldByLabel('Name');
        const relatedTo = getTaskFieldByLabel('Related To');

        const record = {
            id,
            objectType: 'task',
            data: {
                subject: subject || null,
                assignedTo: assignedTo || null,
                status: status || null,
                dueDate: dueDate || null,
                priority: priority || null,
                name: name || null,
                relatedTo: relatedTo || null
            },
            sourceUrl: window.location.href,
            lastUpdated: Date.now()
        };

        log('=== EXTRACTED TASK RECORD ===');
        log(JSON.stringify(record, null, 2));

        return record;
    }

    // Expose to global scope
    window.extractTaskRecordDetail = extractTaskRecordDetail;
})();
