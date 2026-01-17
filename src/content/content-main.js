/**
 * Content Script - Main Entry Point
 * Handles messaging with background service worker
 * Orchestrates extraction from Opportunity, Lead, and Contact pages
 */

// The extractors are loaded BEFORE this script via manifest content_scripts:
// - opportunity.js provides: extractRecordDetail()
// - lead.js provides: extractLeadRecordDetail()
// - contact.js provides: extractContactRecordDetail()

/**
 * Detect the current Salesforce object type from URL
 */
function detectObjectType() {
    const url = window.location.href;

    if (url.includes('/lightning/r/Opportunity/')) {
        return 'opportunity';
    }
    if (url.includes('/lightning/r/Lead/')) {
        return 'lead';
    }
    if (url.includes('/lightning/r/Contact/')) {
        return 'contact';
    }

    return null;
}

/**
 * Run extraction based on detected object type
 */
async function runExtraction(requestId) {
    console.log('[Content] Running extraction for requestId:', requestId);

    const objectType = detectObjectType();
    console.log('[Content] Detected object type:', objectType);

    try {
        let record;

        if (objectType === 'opportunity') {
            if (typeof extractRecordDetail !== 'function') {
                throw new Error('Opportunity extractor not available');
            }
            record = await extractRecordDetail();
        } else if (objectType === 'lead') {
            if (typeof extractLeadRecordDetail !== 'function') {
                throw new Error('Lead extractor not available');
            }
            record = await extractLeadRecordDetail();
        } else if (objectType === 'contact') {
            if (typeof extractContactRecordDetail !== 'function') {
                throw new Error('Contact extractor not available');
            }
            record = await extractContactRecordDetail();
        } else {
            throw new Error('Unsupported page. Navigate to an Opportunity, Lead, or Contact record page.');
        }

        console.log('[Content] Extraction successful:', record);
        chrome.runtime.sendMessage({
            type: 'EXTRACTION_RESULT',
            requestId: requestId,
            payload: record
        });

    } catch (err) {
        console.error('[Content] Extraction failed:', err);
        chrome.runtime.sendMessage({
            type: 'EXTRACTION_ERROR',
            requestId: requestId,
            error: {
                message: err.message,
                stack: err.stack
            }
        });
    }
}

/**
 * Message listener for commands from background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] Message received:', message.type);

    switch (message.type) {
        case 'PING':
            console.log('[Content] Responding to PING');
            sendResponse({ type: 'PONG' });
            return true;

        case 'RUN_EXTRACTION':
            console.log('[Content] Starting extraction for requestId:', message.requestId);
            sendResponse({ status: 'started' });
            runExtraction(message.requestId);
            return true;

        default:
            return false;
    }
});

/**
 * Expose debug functions for manual testing in devtools
 */
window.runExtractionForDebug = async function () {
    const objectType = detectObjectType();
    if (objectType === 'opportunity' && typeof extractRecordDetail === 'function') {
        return await extractRecordDetail();
    }
    if (objectType === 'lead' && typeof extractLeadRecordDetail === 'function') {
        return await extractLeadRecordDetail();
    }
    if (objectType === 'contact' && typeof extractContactRecordDetail === 'function') {
        return await extractContactRecordDetail();
    }
    throw new Error('No extractor available for this page');
};

console.log('[Content] SF CRM Extractor content script initialized');
console.log('[Content] Supports: Opportunity, Lead, Contact');
console.log('[Content] Use window.runExtractionForDebug() for manual testing');
