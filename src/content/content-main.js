/**
 * Content Script - Main Entry Point
 * Handles messaging with background service worker
 * Orchestrates extraction from Opportunity pages
 */

// The extractor (opportunity.js) is loaded BEFORE this script via manifest content_scripts
// Functions like extractRecordDetail are available directly (not on window in content script context)

/**
 * Run extraction and send result to background
 */
async function runExtraction(requestId) {
    console.log('[Content] Running extraction for requestId:', requestId);

    try {
        // extractRecordDetail is defined in opportunity.js which loads first
        if (typeof extractRecordDetail !== 'function') {
            throw new Error('Extractor function not available - opportunity.js may not have loaded');
        }

        const record = await extractRecordDetail();

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
            // Respond to handshake ping
            console.log('[Content] Responding to PING');
            sendResponse({ type: 'PONG' });
            return true;

        case 'RUN_EXTRACTION':
            // Start extraction async, respond immediately
            console.log('[Content] Starting extraction for requestId:', message.requestId);
            sendResponse({ status: 'started' });
            runExtraction(message.requestId);
            return true;

        default:
            return false;
    }
});

/**
 * Expose debug function for manual testing in devtools
 */
window.runExtractionForDebug = async function () {
    if (typeof extractRecordDetail === 'function') {
        return await extractRecordDetail();
    }
    throw new Error('Extractor not available');
};

console.log('[Content] SF CRM Extractor content script initialized');
console.log('[Content] Use window.runExtractionForDebug() for manual testing');
