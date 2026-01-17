/**
 * Content Script - Main Entry Point
 * Handles messaging with background service worker
 * Orchestrates extraction from Salesforce record pages
 */

// The extractors are loaded BEFORE this script via manifest content_scripts:
// - opportunity.js provides: extractRecordDetail()
// - lead.js provides: extractLeadRecordDetail()
// - contact.js provides: extractContactRecordDetail()
// - account.js provides: extractAccountRecordDetail()
// - task.js provides: extractTaskRecordDetail()

/**
 * Shadow DOM Indicator - Shows extraction status on the page
 */
const StatusIndicator = (function () {
    let container = null;
    let shadowRoot = null;
    let statusEl = null;
    let hideTimeout = null;

    function init() {
        if (container) return;

        // Create container element
        container = document.createElement('div');
        container.id = 'sf-extractor-indicator';

        // Attach shadow DOM for style isolation
        shadowRoot = container.attachShadow({ mode: 'closed' });

        // Add styles and HTML to shadow DOM
        shadowRoot.innerHTML = `
      <style>
        .indicator {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 500;
          z-index: 999999;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: all 0.3s ease;
          opacity: 0;
          transform: translateY(20px);
        }
        
        .indicator.visible {
          opacity: 1;
          transform: translateY(0);
        }
        
        .indicator.extracting {
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          color: #00b4d8;
          border: 1px solid rgba(0, 180, 216, 0.3);
        }
        
        .indicator.success {
          background: linear-gradient(135deg, #064e3b, #065f46);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        
        .indicator.error {
          background: linear-gradient(135deg, #450a0a, #7f1d1d);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .icon {
          font-size: 16px;
        }
      </style>
      <div class="indicator">
        <span class="icon"></span>
        <span class="text"></span>
      </div>
    `;

        statusEl = shadowRoot.querySelector('.indicator');
        document.body.appendChild(container);
    }

    function show(message, type = 'extracting') {
        init();

        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        const iconEl = shadowRoot.querySelector('.icon');
        const textEl = shadowRoot.querySelector('.text');

        statusEl.className = 'indicator ' + type;

        if (type === 'extracting') {
            iconEl.innerHTML = '<div class="spinner"></div>';
        } else if (type === 'success') {
            iconEl.textContent = '✓';
        } else if (type === 'error') {
            iconEl.textContent = '✕';
        }

        textEl.textContent = message;

        // Trigger reflow for animation
        statusEl.offsetHeight;
        statusEl.classList.add('visible');
    }

    function hide(delay = 0) {
        if (!statusEl) return;

        hideTimeout = setTimeout(() => {
            statusEl.classList.remove('visible');
        }, delay);
    }

    return { show, hide };
})();

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
    if (url.includes('/lightning/r/Account/')) {
        return 'account';
    }
    if (url.includes('/lightning/r/Task/')) {
        return 'task';
    }

    return null;
}

/**
 * Run extraction based on detected object type
 */
async function runExtraction(requestId) {
    console.log('[Content] Running extraction for requestId:', requestId);

    // Show extracting indicator
    StatusIndicator.show('Extracting...', 'extracting');

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
        } else if (objectType === 'account') {
            if (typeof extractAccountRecordDetail !== 'function') {
                throw new Error('Account extractor not available');
            }
            record = await extractAccountRecordDetail();
        } else if (objectType === 'task') {
            if (typeof extractTaskRecordDetail !== 'function') {
                throw new Error('Task extractor not available');
            }
            record = await extractTaskRecordDetail();
        } else {
            throw new Error('Unsupported page');
        }

        console.log('[Content] Extraction successful:', record);

        // Show success indicator
        StatusIndicator.show('Success! Record extracted', 'success');
        StatusIndicator.hide(2500);

        chrome.runtime.sendMessage({
            type: 'EXTRACTION_RESULT',
            requestId: requestId,
            payload: record
        });

    } catch (err) {
        console.error('[Content] Extraction failed:', err);

        // Show error indicator
        StatusIndicator.show('Error: ' + err.message, 'error');
        StatusIndicator.hide(3500);

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
    StatusIndicator.show('Extracting...', 'extracting');

    try {
        const objectType = detectObjectType();
        let result;

        if (objectType === 'opportunity' && typeof extractRecordDetail === 'function') {
            result = await extractRecordDetail();
        } else if (objectType === 'lead' && typeof extractLeadRecordDetail === 'function') {
            result = await extractLeadRecordDetail();
        } else if (objectType === 'contact' && typeof extractContactRecordDetail === 'function') {
            result = await extractContactRecordDetail();
        } else if (objectType === 'account' && typeof extractAccountRecordDetail === 'function') {
            result = await extractAccountRecordDetail();
        } else if (objectType === 'task' && typeof extractTaskRecordDetail === 'function') {
            result = await extractTaskRecordDetail();
        } else {
            throw new Error('No extractor available for this page');
        }

        StatusIndicator.show('Success!', 'success');
        StatusIndicator.hide(2500);
        return result;
    } catch (err) {
        StatusIndicator.show('Error: ' + err.message, 'error');
        StatusIndicator.hide(3500);
        throw err;
    }
};

/**
 * DOM Change Detection - Detect SPA navigation
 * Shows indicator when navigating to a supported record page
 */
const DOMChangeDetector = (function () {
    let lastUrl = window.location.href;
    let observer = null;

    function checkUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            const objectType = detectObjectType();
            if (objectType) {
                console.log('[Content] SPA navigation detected to:', objectType);
                // Brief indicator that we're ready to extract
                StatusIndicator.show(`${objectType.charAt(0).toUpperCase() + objectType.slice(1)} page detected`, 'success');
                StatusIndicator.hide(1500);
            }
        }
    }

    function init() {
        // Use MutationObserver to detect DOM changes (SPA navigation)
        observer = new MutationObserver(() => {
            checkUrlChange();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also listen to popstate for browser back/forward
        window.addEventListener('popstate', checkUrlChange);

        console.log('[Content] DOM change detection initialized');
    }

    return { init };
})();

// Initialize DOM change detection
DOMChangeDetector.init();

console.log('[Content] SF CRM Extractor content script initialized');
console.log('[Content] Supports: Opportunity, Lead, Contact, Account, Task');
console.log('[Content] Use window.runExtractionForDebug() for manual testing');

