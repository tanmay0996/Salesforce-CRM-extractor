/**
 * Service Worker (Background Script)
 * Handles messaging between popup and content scripts
 * Implements handshake protocol and extraction orchestration
 */

// Salesforce URL patterns for validation
const SALESFORCE_PATTERNS = [
  /^https:\/\/[^/]*\.lightning\.force\.com\//,
  /^https:\/\/[^/]*\.salesforce\.com\//
];

/**
 * Generate a UUID v4 for request tracking
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Check if URL matches Salesforce patterns
 */
function isSalesforceUrl(url) {
  if (!url) return false;
  return SALESFORCE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send PING to tab and wait for PONG response
 * Returns true if content script responds, false otherwise
 */
async function pingTab(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[SW] PING failed:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        if (response && response.type === 'PONG') {
          console.log('[SW] PONG received');
          resolve(true);
        } else {
          resolve(false);
        }
      });
    } catch (err) {
      console.error('[SW] PING exception:', err);
      resolve(false);
    }
  });
}

/**
 * Inject content script programmatically
 */
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content/content-main.js']
    });
    console.log('[SW] Content script injected successfully');
    return true;
  } catch (err) {
    console.error('[SW] Failed to inject content script:', err);
    return false;
  }
}

/**
 * Perform handshake with content script
 * 1. Try PING
 * 2. If fails, inject script and retry PING after 300ms
 */
async function performHandshake(tabId) {
  // First attempt
  let pongReceived = await pingTab(tabId);
  if (pongReceived) {
    return { success: true };
  }

  // Inject content script
  console.log('[SW] No PONG, injecting content script...');
  const injected = await injectContentScript(tabId);
  if (!injected) {
    return { success: false, reason: 'INJECTION_FAILED' };
  }

  // Wait and retry
  await sleep(300);
  pongReceived = await pingTab(tabId);
  if (pongReceived) {
    return { success: true };
  }

  return { success: false, reason: 'NO_CONTENT_SCRIPT' };
}

/**
 * Send extraction request and wait for result
 */
function sendExtractionRequest(tabId, requestId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('[SW] Extraction timeout for requestId:', requestId);
      resolve({ success: false, reason: 'TIMEOUT' });
    }, 10000);

    // Set up listener for extraction result
    const listener = (message, sender) => {
      if (sender.tab?.id !== tabId) return;

      if (message.type === 'EXTRACTION_RESULT' && message.requestId === requestId) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        resolve({ success: true, payload: message.payload });
      } else if (message.type === 'EXTRACTION_ERROR' && message.requestId === requestId) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        resolve({ success: false, reason: 'EXTRACTION_ERROR', error: message.error });
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // Send extraction request
    chrome.tabs.sendMessage(tabId, {
      type: 'RUN_EXTRACTION',
      requestId: requestId
    }, (response) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        console.error('[SW] RUN_EXTRACTION send failed:', chrome.runtime.lastError.message);
        resolve({ success: false, reason: 'SEND_FAILED' });
      }
      // Response just confirms message received, actual result comes via listener
    });
  });
}

/**
 * Merge extracted record into storage
 * Supports opportunities, leads, and contacts based on objectType
 */
async function mergeToStorage(record) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['salesforce_data'], (result) => {
      let data = result.salesforce_data || {};

      // Determine which collection to use based on objectType
      const objectType = record.objectType || 'opportunity';
      let collectionName;
      if (objectType === 'lead') {
        collectionName = 'leads';
      } else if (objectType === 'contact') {
        collectionName = 'contacts';
      } else if (objectType === 'account') {
        collectionName = 'accounts';
      } else {
        collectionName = 'opportunities';
      }

      let collection = data[collectionName] || [];

      // Find existing record by id
      const existingIndex = collection.findIndex(r => r.id === record.id);
      let inserted = 0, updated = 0;

      if (existingIndex >= 0) {
        collection[existingIndex] = record;
        updated = 1;
      } else {
        collection.push(record);
        inserted = 1;
      }

      data[collectionName] = collection;

      chrome.storage.local.set({ salesforce_data: data }, () => {
        console.log(`[SW] ${objectType} record merged to storage:`, { inserted, updated });
        resolve({ inserted, updated, objectType });
      });
    });
  });
}

/**
 * Handle REQUEST_EXTRACT from popup
 */
async function handleExtractRequest(sendResponse) {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      sendResponse({ status: 'error', reason: 'NO_ACTIVE_TAB' });
      return;
    }

    // Validate URL
    if (!isSalesforceUrl(tab.url)) {
      sendResponse({
        status: 'error',
        reason: 'NOT_SALESFORCE',
        message: 'Please navigate to a Salesforce Opportunity page'
      });
      return;
    }

    // Perform handshake
    const handshake = await performHandshake(tab.id);
    if (!handshake.success) {
      sendResponse({ status: 'error', reason: handshake.reason });
      return;
    }

    // Send extraction request
    const requestId = generateUUID();
    let result = await sendExtractionRequest(tab.id, requestId);

    // Retry once on timeout
    if (!result.success && result.reason === 'TIMEOUT') {
      console.log('[SW] Retrying extraction...');
      result = await sendExtractionRequest(tab.id, generateUUID());
    }

    if (!result.success) {
      sendResponse({
        status: 'error',
        reason: result.reason,
        error: result.error
      });
      return;
    }

    // Validate payload
    const payload = result.payload;
    if (!payload || !payload.id || !payload.data) {
      sendResponse({ status: 'error', reason: 'INVALID_PAYLOAD' });
      return;
    }

    // Merge to storage
    const mergeResult = await mergeToStorage(payload);

    sendResponse({
      status: 'ok',
      merged: mergeResult,
      record: payload
    });

  } catch (err) {
    console.error('[SW] Extract request error:', err);
    sendResponse({
      status: 'error',
      reason: 'UNKNOWN_ERROR',
      message: err.message
    });
  }
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SW] Message received:', message.type, 'from:', sender.tab ? 'tab' : 'popup');

  if (message.type === 'REQUEST_EXTRACT') {
    // Handle async - return true to keep channel open
    handleExtractRequest(sendResponse);
    return true;
  }

  // EXTRACTION_RESULT and EXTRACTION_ERROR are handled in sendExtractionRequest listener
  return false;
});

console.log('[SW] Service worker initialized');
