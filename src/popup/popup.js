/**
 * Popup Script
 * Handles UI interactions and communication with background service worker
 * Supports Opportunities, Leads, Contacts, Accounts, and Tasks
 */

// DOM Elements
const extractBtn = document.getElementById('extractBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const searchInput = document.getElementById('searchInput');
const statusDiv = document.getElementById('status');
const opportunitiesList = document.getElementById('opportunitiesList');
const opportunitiesCount = document.getElementById('opportunitiesCount');
const leadsList = document.getElementById('leadsList');
const leadsCount = document.getElementById('leadsCount');
const contactsList = document.getElementById('contactsList');
const contactsCount = document.getElementById('contactsCount');
const accountsList = document.getElementById('accountsList');
const accountsCount = document.getElementById('accountsCount');
const tasksList = document.getElementById('tasksList');
const tasksCount = document.getElementById('tasksCount');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Current search text
let currentSearchText = '';

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
 * Filter records by search text
 */
function filterRecords(records, searchText) {
  if (!searchText) return records;
  const lower = searchText.toLowerCase();
  return records.filter(r => {
    const data = r.data || {};
    return Object.values(data).some(v =>
      String(v || '').toLowerCase().includes(lower)
    );
  });
}

/**
 * Delete a record from storage
 */
function deleteRecord(objectType, recordId) {
  chrome.storage.local.get(['salesforce_data'], (result) => {
    const data = result.salesforce_data || {};

    const collectionMap = {
      'opportunity': 'opportunities',
      'lead': 'leads',
      'contact': 'contacts',
      'account': 'accounts',
      'task': 'tasks'
    };

    const collectionName = collectionMap[objectType];
    if (!collectionName || !data[collectionName]) return;

    data[collectionName] = data[collectionName].filter(r => r.id !== recordId);
    data.lastSync = Date.now();

    chrome.storage.local.set({ salesforce_data: data }, () => {
      showStatus('🗑️ Record deleted', 'success');
      loadRecords();
    });
  });
}

/**
 * Render Opportunity card
 */
function renderOpportunityCard(record) {
  const data = record.data || {};

  return `
    <div class="record-card">
      <div class="record-header">
        <div class="record-name">${escapeHtml(data.name || 'N/A')}</div>
        <button class="delete-btn" data-type="opportunity" data-id="${escapeHtml(record.id)}">Delete</button>
      </div>
      <div class="record-fields">
        <div class="record-field">
          <div class="label">Amount</div>
          <div class="value">${formatAmount(data.amount)}</div>
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
      <div class="record-header">
        <div class="record-name">${escapeHtml(data.name || 'N/A')}</div>
        <button class="delete-btn" data-type="lead" data-id="${escapeHtml(record.id)}">Delete</button>
      </div>
      <div class="record-fields">
        <div class="record-field">
          <div class="label">Company</div>
          <div class="value">${escapeHtml(data.company || 'N/A')}</div>
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
 * Render Contact card
 */
function renderContactCard(record) {
  const data = record.data || {};

  return `
    <div class="record-card">
      <div class="record-header">
        <div class="record-name">${escapeHtml(data.name || 'N/A')}</div>
        <button class="delete-btn" data-type="contact" data-id="${escapeHtml(record.id)}">Delete</button>
      </div>
      <div class="record-fields">
        <div class="record-field">
          <div class="label">Title</div>
          <div class="value">${escapeHtml(data.title || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Account</div>
          <div class="value">${escapeHtml(data.accountName || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Email</div>
          <div class="value">${escapeHtml(data.email || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Phone</div>
          <div class="value">${escapeHtml(data.phone || 'N/A')}</div>
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
 * Render Account card
 */
function renderAccountCard(record) {
  const data = record.data || {};

  return `
    <div class="record-card">
      <div class="record-header">
        <div class="record-name">${escapeHtml(data.name || 'N/A')}</div>
        <button class="delete-btn" data-type="account" data-id="${escapeHtml(record.id)}">Delete</button>
      </div>
      <div class="record-fields">
        <div class="record-field">
          <div class="label">Type</div>
          <div class="value">${escapeHtml(data.type || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Industry</div>
          <div class="value">${escapeHtml(data.industry || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Phone</div>
          <div class="value">${escapeHtml(data.phone || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Website</div>
          <div class="value">${escapeHtml(data.website || 'N/A')}</div>
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
 * Render Task card
 */
function renderTaskCard(record) {
  const data = record.data || {};

  return `
    <div class="record-card">
      <div class="record-header">
        <div class="record-name">${escapeHtml(data.subject || 'N/A')}</div>
        <button class="delete-btn" data-type="task" data-id="${escapeHtml(record.id)}">Delete</button>
      </div>
      <div class="record-fields">
        <div class="record-field">
          <div class="label">Status</div>
          <div class="value">${escapeHtml(data.status || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Priority</div>
          <div class="value">${escapeHtml(data.priority || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Due Date</div>
          <div class="value">${escapeHtml(data.dueDate || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Assigned To</div>
          <div class="value">${escapeHtml(data.assignedTo || 'N/A')}</div>
        </div>
        <div class="record-field">
          <div class="label">Related To</div>
          <div class="value">${escapeHtml(data.relatedTo || 'N/A')}</div>
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
    let opportunities = data.opportunities || [];
    let leads = data.leads || [];
    let contacts = data.contacts || [];
    let accounts = data.accounts || [];
    let tasks = data.tasks || [];

    // Apply search filter
    opportunities = filterRecords(opportunities, currentSearchText);
    leads = filterRecords(leads, currentSearchText);
    contacts = filterRecords(contacts, currentSearchText);
    accounts = filterRecords(accounts, currentSearchText);
    tasks = filterRecords(tasks, currentSearchText);

    // Update counts
    opportunitiesCount.textContent = opportunities.length;
    leadsCount.textContent = leads.length;
    contactsCount.textContent = contacts.length;
    accountsCount.textContent = accounts.length;
    tasksCount.textContent = tasks.length;

    // Render Opportunities
    if (opportunities.length === 0) {
      opportunitiesList.innerHTML = `
        <div class="empty-state">
          <div class="icon">📋</div>
          <div>${currentSearchText ? 'No matches found' : 'No opportunities extracted yet'}</div>
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
          <div>${currentSearchText ? 'No matches found' : 'No leads extracted yet'}</div>
        </div>
      `;
    } else {
      const sorted = [...leads].sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      leadsList.innerHTML = sorted.map(renderLeadCard).join('');
    }

    // Render Contacts
    if (contacts.length === 0) {
      contactsList.innerHTML = `
        <div class="empty-state">
          <div class="icon">📇</div>
          <div>${currentSearchText ? 'No matches found' : 'No contacts extracted yet'}</div>
        </div>
      `;
    } else {
      const sorted = [...contacts].sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      contactsList.innerHTML = sorted.map(renderContactCard).join('');
    }

    // Render Accounts
    if (accounts.length === 0) {
      accountsList.innerHTML = `
        <div class="empty-state">
          <div class="icon">🏢</div>
          <div>${currentSearchText ? 'No matches found' : 'No accounts extracted yet'}</div>
        </div>
      `;
    } else {
      const sorted = [...accounts].sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      accountsList.innerHTML = sorted.map(renderAccountCard).join('');
    }

    // Render Tasks
    if (tasks.length === 0) {
      tasksList.innerHTML = `
        <div class="empty-state">
          <div class="icon">✅</div>
          <div>${currentSearchText ? 'No matches found' : 'No tasks extracted yet'}</div>
        </div>
      `;
    } else {
      const sorted = [...tasks].sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      tasksList.innerHTML = sorted.map(renderTaskCard).join('');
    }

    // Attach delete button listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        const id = e.target.dataset.id;
        if (confirm('Delete this record?')) {
          deleteRecord(type, id);
        }
      });
    });
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
 * Get display name for object type
 */
function getTypeName(objectType) {
  const names = {
    'opportunity': 'Opportunity',
    'lead': 'Lead',
    'contact': 'Contact',
    'account': 'Account',
    'task': 'Task'
  };
  return names[objectType] || 'Record';
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
      const typeName = getTypeName(objectType);

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
      } else if (objectType === 'contact') {
        switchTab('contacts');
      } else if (objectType === 'account') {
        switchTab('accounts');
      } else if (objectType === 'task') {
        switchTab('tasks');
      } else {
        switchTab('opportunities');
      }

      loadRecords();
    } else {
      const errorMessages = {
        'NOT_SALESFORCE': 'Navigate to a Salesforce record page',
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
 * Handle JSON download
 */
function handleDownloadJson() {
  chrome.storage.local.get(['salesforce_data'], (result) => {
    const data = result.salesforce_data || {};
    const opportunities = data.opportunities || [];
    const leads = data.leads || [];
    const contacts = data.contacts || [];
    const accounts = data.accounts || [];
    const tasks = data.tasks || [];

    if (opportunities.length === 0 && leads.length === 0 && contacts.length === 0 && accounts.length === 0 && tasks.length === 0) {
      showStatus('No records to download', 'error');
      return;
    }

    const exportData = {
      opportunities,
      leads,
      contacts,
      accounts,
      tasks,
      exportedAt: new Date().toISOString(),
      lastSync: data.lastSync
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

/**
 * Convert records to CSV
 */
function recordsToCsv(records, objectType) {
  if (records.length === 0) return '';

  // Get all unique keys from data
  const allKeys = new Set();
  records.forEach(r => {
    Object.keys(r.data || {}).forEach(k => allKeys.add(k));
  });

  const headers = ['id', 'objectType', ...Array.from(allKeys), 'sourceUrl', 'lastUpdated'];

  const rows = records.map(r => {
    const data = r.data || {};
    return headers.map(h => {
      let value;
      if (h === 'id') value = r.id;
      else if (h === 'objectType') value = r.objectType;
      else if (h === 'sourceUrl') value = r.sourceUrl;
      else if (h === 'lastUpdated') value = r.lastUpdated ? new Date(r.lastUpdated).toISOString() : '';
      else value = data[h] || '';

      // Escape CSV values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    }).join(',');
  });

  return headers.join(',') + '\n' + rows.join('\n');
}

/**
 * Handle CSV download
 */
function handleDownloadCsv() {
  chrome.storage.local.get(['salesforce_data'], (result) => {
    const data = result.salesforce_data || {};
    const allRecords = [
      ...(data.opportunities || []),
      ...(data.leads || []),
      ...(data.contacts || []),
      ...(data.accounts || []),
      ...(data.tasks || [])
    ];

    if (allRecords.length === 0) {
      showStatus('No records to download', 'error');
      return;
    }

    const csv = recordsToCsv(allRecords, 'all');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `salesforce-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('📥 CSV downloaded', 'success');
  });
}

/**
 * Handle search input
 */
function handleSearch(e) {
  currentSearchText = e.target.value.trim();
  loadRecords();
}

// Event listeners
extractBtn.addEventListener('click', handleExtract);
downloadBtn.addEventListener('click', handleDownloadJson);
downloadCsvBtn.addEventListener('click', handleDownloadCsv);
searchInput.addEventListener('input', handleSearch);

// Tab switching
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Initial load
loadRecords();

console.log('[Popup] SF CRM Extractor popup initialized');
