/* ==========================================================================
   CBDC Ration Portal - Core JS Logic
   Pali Gram Panchayat
   ========================================================================== */

// Global State
let appData = {
  metadata: {
    district: "મહેસાણા",
    taluka: "ઊંઝા",
    fps_area: "ભરતભાઈ હરગોવનજી બારોટ : 2310 (પળી : 14785 - હંગામી )",
    generated_on: "22/07/2026 16:11:28"
  },
  beneficiaries: [],
  households: [] // Grouped by ration card
};

let filterState = {
  query: "",
  selectedCategory: "ALL",
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
  window.addEventListener('hashchange', handleRoute);
  
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
  tabs.forEach(tab => tab.classList.remove('active'));
  
  const activeTab = document.getElementById(tabId);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'instant' });
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tabId = item.getAttribute('data-tab');
    const targetHash = Object.keys(tabHashMapping).find(key => tabHashMapping[key] === tabId);
    if (targetHash) {
      window.location.hash = targetHash;
    }
  });
});

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
   3. Search & Highlighting & Filtering Logic
   ========================================================================== */

function performSearch(queryText, category) {
  if (queryText !== undefined) filterState.query = queryText.trim().toUpperCase();
  if (category !== undefined) filterState.selectedCategory = category;

  let result = appData.households;

  // Category filter
  if (filterState.selectedCategory !== "ALL") {
    result = result.filter(h => {
      const type = h.members[0] && h.members[0].card_type ? h.members[0].card_type.toUpperCase() : '';
      if (filterState.selectedCategory === "ONBOARDED") {
        return h.members.some(m => m.onboarded === "Yes");
      }
      return type === filterState.selectedCategory;
    });
  }

  // Text search query
  if (filterState.query !== "") {
    clearSearchBtn.style.display = 'block';
    const cleanQuery = filterState.query.replace(/\s+/g, '');
    result = result.filter(household => {
      const cardMatch = household.clean_ration_card.includes(cleanQuery) || household.ration_card.includes(filterState.query);
      const nameMatch = household.members.some(member => 
        member.name.toUpperCase().includes(filterState.query)
      );
      return cardMatch || nameMatch;
    });
  } else {
    clearSearchBtn.style.display = 'none';
  }

  filterState.filteredHouseholds = result;
  filterState.displayedCount = 15;
  renderStats();
  renderList();
}

function renderStats() {
  resultsCount.textContent = `કુલ રેશન કાર્ડ: ${filterState.filteredHouseholds.length}`;
  
  // Home tab live stats
  const homeBeneficiaries = document.getElementById('home-stat-beneficiaries');
  const homeHouseholds = document.getElementById('home-stat-households');
  const homeShop = document.getElementById('home-stat-shop');
  const homeDate = document.getElementById('home-stat-date');

  if (homeBeneficiaries && appData.beneficiaries.length > 0) homeBeneficiaries.textContent = appData.beneficiaries.length;
  if (homeHouseholds && appData.households.length > 0) homeHouseholds.textContent = appData.households.length;
  if (homeShop) homeShop.textContent = "ભરતભાઈ બારોટ";
  if (homeDate && appData.metadata.generated_on) homeDate.textContent = appData.metadata.generated_on.split(' ')[0];
}

function highlightMatch(text, query) {
  if (!query) return text;
  
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
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
        <p>"${filterState.query}" અથવા પસંદ કરેલ ફિર્લ્ટર માટે કોઈ રેશન કાર્ડ મળ્યું નથી.</p>
      </div>
    `;
    loadMoreContainer.style.display = 'none';
    return;
  }
  
  const displaySlice = filterState.filteredHouseholds.slice(0, filterState.displayedCount);
  
  displaySlice.forEach(household => {
    const cardEl = document.createElement('div');
    cardEl.className = 'household-card';
    
    const highlightedCard = highlightMatch(household.ration_card, filterState.query);
    
    let membersHtml = "";
    household.members.forEach((member, index) => {
      const highlightedName = highlightMatch(member.name, filterState.query);
      const onboardTag = member.onboarded === "Yes" 
        ? `<span class="onboarded-tag yes">✓ ઓનબોર્ડ</span>` 
        : `<span class="onboarded-tag no">⏳ પેન્ડિંગ</span>`;

      membersHtml += `
        <div class="member-row">
          <div class="member-left">
            <span class="member-bullet">${index + 1}.</span>
            <span class="member-name">${highlightedName}</span>
          </div>
          ${onboardTag}
        </div>
      `;
    });
    
    const cardType = (household.members[0] && household.members[0].card_type) ? household.members[0].card_type : '';
    const typeBadgeHtml = cardType ? `<span class="card-type-badge">${cardType}</span>` : '';
    
    cardEl.innerHTML = `
      <div class="household-header">
        <div class="card-num-label">
          રેશન કાર્ડ નં:
          <span class="card-num-val">${highlightedCard}</span>
        </div>
        <div class="header-badges">
          <span class="member-count-badge">${household.members.length} સભ્યો</span>
          ${typeBadgeHtml}
          <span class="status-badge">પાત્ર (Active)</span>
        </div>
      </div>
      <div class="household-body">
        <div class="member-list-title">લાભાર્થી સભ્યો (Members)</div>
        ${membersHtml}
      </div>
      <div class="card-footer-info">
        <span>દુકાન: ભરતભાઈ હરગોવનજી બારોટ (૨૩૧૦)</span>
        <span>સ્થળ: પળી (૧૪૭૮૫)</span>
      </div>
    `;
    
    listContainer.appendChild(cardEl);
  });
  
  if (filterState.filteredHouseholds.length > filterState.displayedCount) {
    loadMoreContainer.style.display = 'flex';
  } else {
    loadMoreContainer.style.display = 'none';
  }
}

// Bind search & filter listeners
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

// Category filter pills listener
const filterPillsContainer = document.getElementById('filter-pills-container');
if (filterPillsContainer) {
  filterPillsContainer.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    
    const filter = pill.getAttribute('data-filter');
    performSearch(undefined, filter);
  });
}

/* ==========================================================================
   5. Home Search Redirect
   ========================================================================== */

function executeQuickSearch() {
  const query = quickSearchInput.value;
  if (query.trim() !== "") {
    searchInput.value = query;
    window.location.hash = '#list';
    performSearch(query);
    quickSearchInput.value = "";
  } else {
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
   6. Image Lightbox Handler
   ========================================================================== */

function initLightbox() {
  const modal = document.getElementById('image-lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const caption = document.getElementById('lightbox-caption');
  const closeBtn = document.getElementById('lightbox-close-btn');
  const overlay = document.getElementById('lightbox-overlay');

  if (!modal) return;

  document.querySelectorAll('.process-step-card .step-image-container').forEach((card, idx) => {
    card.addEventListener('click', () => {
      const img = card.querySelector('img');
      if (img) {
        lightboxImg.src = img.src;
        caption.textContent = `સ્ટેપ ${idx + 1} વિગતવાર સ્ક્રીનશોટ`;
        modal.classList.add('open');
      }
    });
  });

  const closeModal = () => modal.classList.remove('open');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);
}

/* ==========================================================================
   7. Application Bootstrapping
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  loadData();
  initLightbox();
});
