/* ==========================================================================
   CBDC Ration Portal - Core JS Logic
   Pali Gram Panchayat
   ========================================================================== */

// Global State
let appData = {
  metadata: {
    district: "મહેસાણા",
    taluka: "ઊંઝા",
    fps_area: "પટેલ બાબુભાઈ કાશીરામદાસ : 2312 (પળી : 14785 - કાયમી )",
    generated_on: "03/03/2026 13:44:12"
  },
  beneficiaries: [],
  households: [] // Grouped by ration card
};

let filterState = {
  query: "",
  filteredHouseholds: [],
  displayedCount: 15
};

// DOM Elements
const tabs = document.querySelectorAll('.tab-content');
const navItems = document.querySelectorAll('.nav-item');
const searchInput = document.getElementById('beneficiary-search');
const clearSearchBtn = document.getElementById('search-clear-btn');
const resultsCount = document.getElementById('results-count');
const lastUpdatedBadge = document.getElementById('last-updated-badge');
const listContainer = document.getElementById('beneficiaries-list');
const loadMoreContainer = document.getElementById('load-more-container');
const loadMoreBtn = document.getElementById('load-more-btn');

// Home/Quick Search Elements
const quickSearchInput = document.getElementById('quick-search-input');
const quickSearchBtn = document.getElementById('quick-search-btn');

/* ==========================================================================
   1. Router & Tab Navigation
   ========================================================================== */

const tabHashMapping = {
  '#home': 'home-tab',
  '#list': 'list-tab',
  '#process': 'process-tab',
  '#info': 'info-tab'
};

function initRouter() {
  // Listen for hash changes
  window.addEventListener('hashchange', handleRoute);
  
  // Set default route if none exists
  if (!window.location.hash || !tabHashMapping[window.location.hash]) {
    window.location.hash = '#home';
  } else {
    handleRoute();
  }
}

function handleRoute() {
  const hash = window.location.hash;
  const activeTabId = tabHashMapping[hash] || 'home-tab';
  
  switchTab(activeTabId);
}

function switchTab(tabId) {
  // Hide all tabs
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // Show active tab
  const activeTab = document.getElementById(tabId);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  // Update navbar items active state
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Scroll to top of body on page change
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Bind Navigation Clicks
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tabId = item.getAttribute('data-tab');
    const targetHash = Object.keys(tabHashMapping).find(key => tabHashMapping[key] === tabId);
    if (targetHash) {
      window.location.hash = targetHash;
    }
  });
});

// Home Page Grid Actions Navigation
document.getElementById('action-go-to-list').addEventListener('click', () => {
  window.location.hash = '#list';
});

document.getElementById('action-go-to-process').addEventListener('click', () => {
  window.location.hash = '#process';
});

document.getElementById('info-btn-to-process').addEventListener('click', () => {
  window.location.hash = '#process';
});

/* ==========================================================================
   2. Data Loading & Indexing
   ========================================================================== */

async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    appData.metadata = data.metadata;
    appData.beneficiaries = data.beneficiaries;
    
    // Indexing: Group individual beneficiaries into households by Ration Card
    const householdGroups = {};
    appData.beneficiaries.forEach(beneficiary => {
      const cardNo = beneficiary.ration_card;
      if (!householdGroups[cardNo]) {
        householdGroups[cardNo] = {
          ration_card: cardNo,
          clean_ration_card: beneficiary.clean_ration_card,
          members: []
        };
      }
      householdGroups[cardNo].members.push(beneficiary);
    });
    
    appData.households = Object.values(householdGroups);
    
    // Update Stats/Metadata in UI
    lastUpdatedBadge.textContent = `માહિતી અપડેટ: ${appData.metadata.generated_on.split(' ')[0]}`;
    
    // Initial display
    filterState.filteredHouseholds = [...appData.households];
    renderStats();
    renderList();
    
  } catch (error) {
    console.error("Error loading beneficiary database:", error);
    listContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⚠️</span>
        <h4>યાદી લોડ કરવામાં ભૂલ આવી</h4>
        <p>કૃપા કરીને ઇન્ટરનેટ કનેક્શન તપાસો અથવા પેજ રિફ્રેશ કરો.</p>
      </div>
    `;
  }
}

/* ==========================================================================
   3. Search & Highlighting Logic
   ========================================================================== */

function performSearch(queryText) {
  filterState.query = queryText.trim().toUpperCase();
  
  if (filterState.query === "") {
    filterState.filteredHouseholds = [...appData.households];
    clearSearchBtn.style.display = 'none';
  } else {
    clearSearchBtn.style.display = 'block';
    
    // Match either the ration card number or ANY member's name
    filterState.filteredHouseholds = appData.households.filter(household => {
      // 1. Match ration card (removing spaces for flexibility)
      const cleanQuery = filterState.query.replace(/\s+/g, '');
      const cardMatch = household.clean_ration_card.includes(cleanQuery) || household.ration_card.includes(filterState.query);
      
      // 2. Match family member names
      const nameMatch = household.members.some(member => 
        member.name.toUpperCase().includes(filterState.query)
      );
      
      return cardMatch || nameMatch;
    });
  }
  
  // Reset pagination on new search
  filterState.displayedCount = 15;
  renderStats();
  renderList();
}

function renderStats() {
  resultsCount.textContent = `કુલ રેશન કાર્ડ: ${filterState.filteredHouseholds.length}`;
}

// Highlight helper (safe from HTML injection, case-insensitive match)
function highlightMatch(text, query) {
  if (!query) return text;
  
  // Escape HTML entities to prevent scripting injection
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Clean up special regex characters in search query
  const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/* ==========================================================================
   4. Render Loop & Pagination
   ========================================================================== */

function renderList() {
  listContainer.innerHTML = "";
  
  if (filterState.filteredHouseholds.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🔍</span>
        <h4>કોઈ પરિણામ મળ્યું નથી</h4>
        <p>"${filterState.query}" માટે કોઈ પાત્ર રેશન કાર્ડ મળ્યું નથી. કૃપા કરીને નામ અથવા રેશનકાર્ડ નંબર ફરીથી તપાસો.</p>
      </div>
    `;
    loadMoreContainer.style.display = 'none';
    return;
  }
  
  const displaySlice = filterState.filteredHouseholds.slice(0, filterState.displayedCount);
  
  displaySlice.forEach(household => {
    const cardEl = document.createElement('div');
    cardEl.className = 'household-card';
    
    // Highlighted Ration Card No
    const highlightedCard = highlightMatch(household.ration_card, filterState.query);
    
    // Build Members List HTML
    let membersHtml = "";
    household.members.forEach((member, index) => {
      const highlightedName = highlightMatch(member.name, filterState.query);
      membersHtml += `
        <div class="member-row">
          <span class="member-bullet">${index + 1}.</span>
          <span class="member-name">${highlightedName}</span>
        </div>
      `;
    });
    
    cardEl.innerHTML = `
      <div class="household-header">
        <div class="card-num-label">
          રેશન કાર્ડ નં:
          <span class="card-num-val">${highlightedCard}</span>
        </div>
        <span class="status-badge">પાત્ર (Active)</span>
      </div>
      <div class="household-body">
        <div class="member-list-title">લાભાર્થી સભ્યો (Members)</div>
        ${membersHtml}
      </div>
    `;
    
    listContainer.appendChild(cardEl);
  });
  
  // Show / Hide pagination button
  if (filterState.filteredHouseholds.length > filterState.displayedCount) {
    loadMoreContainer.style.display = 'flex';
  } else {
    loadMoreContainer.style.display = 'none';
  }
}

// Bind search input listeners
searchInput.addEventListener('input', (e) => {
  performSearch(e.target.value);
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = "";
  performSearch("");
  searchInput.focus();
});

loadMoreBtn.addEventListener('click', () => {
  filterState.displayedCount += 15;
  renderList();
});

/* ==========================================================================
   5. Home Search Redirect
   ========================================================================== */

function executeQuickSearch() {
  const query = quickSearchInput.value;
  if (query.trim() !== "") {
    // Set value on main search bar
    searchInput.value = query;
    // Go to list tab hash
    window.location.hash = '#list';
    // Run search
    performSearch(query);
    // Clear quick input
    quickSearchInput.value = "";
  } else {
    // If empty input, just transition to list tab
    window.location.hash = '#list';
  }
}

quickSearchBtn.addEventListener('click', executeQuickSearch);
quickSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    executeQuickSearch();
  }
});

/* ==========================================================================
   6. Simple Info Page Handler (Accordion logic removed)
   ========================================================================== */

/* ==========================================================================
   7. Application Bootstrapping
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  loadData();
});
