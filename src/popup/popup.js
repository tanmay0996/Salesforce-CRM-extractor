/**
 * Popup Script
 * Handles UI interactions and communication with background service worker
 * Supports both Opportunities and Leads
 */

// DOM Elements
const extractBtn = document.getElementById('extractBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const opportunitiesList = document.getElementById('opportunitiesList');
const opportunitiesCount = document.getElementById('opportunitiesCount');
const leadsList = document.getElementById('leadsList');
const leadsCount = document.getElementById('leadsCount');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

/**
 * Show status message
 */
function showStatus(message, type = 'success') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;

  setTimeout(() => {
    statusDiv.className = 'status';
  }, 4000);
}

/**
 * Set loading state on extract button
 */
function setLoading(loading) {
  const btnText = extractBtn.querySelector('.btn-text');
  const spinner = extractBtn.querySelector('.spinner');

  extractBtn.disabled = loading;
  btnText.style.display = loading ? 'none' : 'inline';
  spinner.style.display = loading ? 'inline-block' : 'none';
}

/**
 * Format currency amount
 */
function formatAmount(amount) {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format date string
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render Opportunity card
 */
function renderOpportunityCard(record) {
  const data = record.data || {};

  return `
    <div class="record-card">
      <div class="record-name">${escapeHtml(data.name || 'Unnamed Opportunity')}</div>
      <div class="record-fields">
        <div class="record-field">
          <div class="label">Amount</div>
          <div class="value">${formatAmount(data.amount)}</div>
        </div>
        <div class="record-field">
          <div class="label">Stage</div>
          <div class="value">${escapeHtml(data.stage || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Close Date</div>
          <div class="value">${formatDate(data.closeDate)}</div>
        </div>
        <div class="record-field">
          <div class="label">Owner</div>
          <div class="value">${escapeHtml(data.owner || 'N/A')}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Lead card
 */
function renderLeadCard(record) {
  const data = record.data || {};

  return `
    <div class="record-card">
      <div class="record-name">${escapeHtml(data.name || 'Unnamed Lead')}</div>
      <div class="record-fields">
        <div class="record-field">
          <div class="label">Company</div>
          <div class="value">${escapeHtml(data.company || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Status</div>
          <div class="value">${escapeHtml(data.leadStatus || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Email</div>
          <div class="value">${escapeHtml(data.email || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Phone</div>
          <div class="value">${escapeHtml(data.phone || 'N/A')}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Load and render stored records
 */
function loadRecords() {
  chrome.storage.local.get(['salesforce_data'], (result) => {
    const data = result.salesforce_data || {};
    const opportunities = data.opportunities || [];
    const leads = data.leads || [];

    // Update counts
    opportunitiesCount.textContent = opportunities.length;
    leadsCount.textContent = leads.length;

    // Render Opportunities
    if (opportunities.length === 0) {
      opportunitiesList.innerHTML = `
        <div class="empty-state">
          <div class="icon">📋</div>
          <div>No opportunities extracted yet</div>
        </div>
      `;
    } else {
      const sorted = [...opportunities].sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      opportunitiesList.innerHTML = sorted.map(renderOpportunityCard).join('');
    }

    // Render Leads
    if (leads.length === 0) {
      leadsList.innerHTML = `
        <div class="empty-state">
          <div class="icon">👤</div>
          <div>No leads extracted yet</div>
        </div>
      `;
    } else {
      const sorted = [...leads].sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      leadsList.innerHTML = sorted.map(renderLeadCard).join('');
    }
  });
}

/**
 * Handle tab switching
 */
function switchTab(tabName) {
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

/**
 * Handle extract button click
 */
function handleExtract() {
  setLoading(true);

  chrome.runtime.sendMessage({ type: 'REQUEST_EXTRACT' }, (response) => {
    setLoading(false);

    if (chrome.runtime.lastError) {
      console.error('Message error:', chrome.runtime.lastError);
      showStatus('Failed to communicate with extension', 'error');
      return;
    }

    if (!response) {
      showStatus('No response from extension', 'error');
      return;
    }

    if (response.status === 'ok') {
      const { inserted, updated, objectType } = response.merged || {};
      const typeName = objectType === 'lead' ? 'Lead' : 'Opportunity';

      if (inserted) {
        showStatus(`✅ New ${typeName} extracted!`, 'success');
      } else if (updated) {
        showStatus(`✅ ${typeName} updated!`, 'success');
      } else {
        showStatus('✅ Extraction complete', 'success');
      }

      // Switch to the appropriate tab
      if (objectType === 'lead') {
        switchTab('leads');
      } else {
        switchTab('opportunities');
      }

      loadRecords();
    } else {
      const errorMessages = {
        'NOT_SALESFORCE': 'Navigate to a Salesforce Opportunity or Lead page',
        'NO_ACTIVE_TAB': 'No active tab found',
        'NO_CONTENT_SCRIPT': 'Could not connect to page. Try refreshing.',
        'INJECTION_FAILED': 'Failed to inject extraction script',
        'TIMEOUT': 'Extraction timed out. Page may still be loading.',
        'EXTRACTION_ERROR': response.error?.message || 'Extraction failed',
        'INVALID_PAYLOAD': 'Invalid data extracted',
        'UNKNOWN_ERROR': response.message || 'Unknown error occurred'
      };

      const message = errorMessages[response.reason] || response.message || 'Extraction failed';
      showStatus(`❌ ${message}`, 'error');
    }
  });
}

/**
 * Handle download button click
 */
function handleDownload() {
  chrome.storage.local.get(['salesforce_data'], (result) => {
    const data = result.salesforce_data || {};
    const opportunities = data.opportunities || [];
    const leads = data.leads || [];

    if (opportunities.length === 0 && leads.length === 0) {
      showStatus('No records to download', 'error');
      return;
    }

    const exportData = {
      opportunities,
      leads,
      exportedAt: new Date().toISOString()
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `salesforce-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('📥 JSON downloaded', 'success');
  });
}

// Event listeners
extractBtn.addEventListener('click', handleExtract);
downloadBtn.addEventListener('click', handleDownload);

// Tab switching
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Initial load
loadRecords();

console.log('[Popup] SF CRM Extractor popup initialized');
