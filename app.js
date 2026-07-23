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

let adminState = {
  isAuthenticated: false,
  username: "nikunjdarji",
  password: "Nikunj@97",
  searchQuery: "",
  filterStatus: "ALL",
  onboardingOverrides: {}
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
  '#info': 'info-tab',
  '#admin': 'admin-tab'
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

  if (tabId === 'admin-tab' && adminState.isAuthenticated) {
    renderAdminDashboard();
  }

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

const actionListBtn = document.getElementById('action-go-to-list');
if (actionListBtn) actionListBtn.addEventListener('click', () => { window.location.hash = '#list'; });

const actionProcessBtn = document.getElementById('action-go-to-process');
if (actionProcessBtn) actionProcessBtn.addEventListener('click', () => { window.location.hash = '#process'; });

const infoProcessBtn = document.getElementById('info-btn-to-process');
if (infoProcessBtn) infoProcessBtn.addEventListener('click', () => { window.location.hash = '#process'; });

/* ==========================================================================
   2. Data Loading & LocalStorage Persistence
   ========================================================================== */

function loadOnboardingOverrides() {
  try {
    const saved = localStorage.getItem('cbdc_onboarding_overrides');
    if (saved) {
      adminState.onboardingOverrides = JSON.parse(saved);
      appData.beneficiaries.forEach(b => {
        if (adminState.onboardingOverrides[b.sr_no] !== undefined) {
          b.onboarded = adminState.onboardingOverrides[b.sr_no];
        }
      });
    }
  } catch (e) {
    console.error("Error loading onboarding overrides:", e);
  }
}

async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    appData.metadata = data.metadata;
    appData.beneficiaries = data.beneficiaries;
    
    // Apply localStorage overrides
    loadOnboardingOverrides();

    // Group into households
    groupHouseholds();

    lastUpdatedBadge.textContent = `માહિતી અપડેટ: ${appData.metadata.generated_on.split(' ')[0]}`;
    
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

function groupHouseholds() {
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
}

/* ==========================================================================
   3. Search & Highlighting & Filtering Logic
   ========================================================================== */

function performSearch(queryText, category) {
  if (queryText !== undefined) filterState.query = queryText.trim().toUpperCase();
  if (category !== undefined) filterState.selectedCategory = category;

  let result = appData.households;

  if (filterState.selectedCategory !== "ALL") {
    result = result.filter(h => {
      const type = h.members[0] && h.members[0].card_type ? h.members[0].card_type.toUpperCase() : '';
      if (filterState.selectedCategory === "ONBOARDED") {
        return h.members.some(m => m.onboarded === "Yes");
      }
      return type === filterState.selectedCategory;
    });
  }

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
if (searchInput) searchInput.addEventListener('input', (e) => { performSearch(e.target.value); });
if (clearSearchBtn) clearSearchBtn.addEventListener('click', () => { searchInput.value = ""; performSearch(""); searchInput.focus(); });
if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => { filterState.displayedCount += 15; renderList(); });

const filterPillsContainer = document.getElementById('filter-pills-container');
if (filterPillsContainer) {
  filterPillsContainer.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    performSearch(undefined, pill.getAttribute('data-filter'));
  });
}

/* ==========================================================================
   5. Admin Portal & Onboarding Management Logic
   ========================================================================== */

function initAdminAuth() {
  const userInput = document.getElementById('admin-username-input');
  const passInput = document.getElementById('admin-password-input');
  const loginBtn = document.getElementById('admin-login-btn');
  const pinError = document.getElementById('admin-pin-error');
  const authCard = document.getElementById('admin-auth-card');
  const dashWrapper = document.getElementById('admin-dashboard-wrapper');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const exportBtn = document.getElementById('admin-export-json-btn');

  const attemptLogin = () => {
    const u = userInput ? userInput.value.trim() : '';
    const p = passInput ? passInput.value : '';

    if (u === adminState.username && p === adminState.password) {
      adminState.isAuthenticated = true;
      authCard.style.display = 'none';
      dashWrapper.style.display = 'block';
      pinError.style.display = 'none';
      if (userInput) userInput.value = '';
      if (passInput) passInput.value = '';
      showToast("🔓 સ્વાગત છે nikunjdarji! તલાટી (Tatali) લૉગિન સફળ થયું.");
      renderAdminDashboard();
    } else {
      pinError.style.display = 'block';
    }
  };

  if (loginBtn) loginBtn.addEventListener('click', attemptLogin);
  if (userInput) userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') attemptLogin(); });
  if (passInput) passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') attemptLogin(); });

  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    adminState.isAuthenticated = false;
    authCard.style.display = 'block';
    dashWrapper.style.display = 'none';
    showToast("🔒 તલાટી (Tatali) લૉગઆઉટ થયું.");
  });

  if (exportBtn) exportBtn.addEventListener('click', exportUpdatedJSON);

  // Admin filter pills
  const adminPillsContainer = document.querySelector('.admin-filter-pills');
  if (adminPillsContainer) {
    adminPillsContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.admin-filter-pill');
      if (!pill) return;
      document.querySelectorAll('.admin-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      adminState.filterStatus = pill.getAttribute('data-admin-filter');
      renderAdminTable();
    });
  }

  // Admin search input
  const adminSearchInput = document.getElementById('admin-search-input');
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
      adminState.searchQuery = e.target.value;
      renderAdminTable();
    });
  }

  // Analytics tabs
  const analyticsHeader = document.querySelector('.analytics-tabs-header');
  if (analyticsHeader) {
    analyticsHeader.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.analytics-tab-btn');
      if (!tabBtn) return;
      document.querySelectorAll('.analytics-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.analytics-tab-content').forEach(c => c.classList.remove('active'));
      
      tabBtn.classList.add('active');
      const targetId = `analytics-${tabBtn.getAttribute('data-analytics')}-content`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  }
}

function renderAdminDashboard() {
  if (!adminState.isAuthenticated) return;

  const totalMembers = appData.beneficiaries.length;
  const totalCards = appData.households.length;
  const onboardedMembers = appData.beneficiaries.filter(b => b.onboarded === "Yes").length;
  const onboardedPercent = totalMembers > 0 ? ((onboardedMembers / totalMembers) * 100).toFixed(1) : 0;

  const kpiMembers = document.getElementById('kpi-total-members');
  const kpiCards = document.getElementById('kpi-total-cards');
  const kpiOnboarded = document.getElementById('kpi-onboarded-members');
  const kpiProgress = document.getElementById('kpi-onboarded-progress');
  const kpiPercent = document.getElementById('kpi-onboarded-percent');

  if (kpiMembers) kpiMembers.textContent = totalMembers;
  if (kpiCards) kpiCards.textContent = totalCards;
  if (kpiOnboarded) kpiOnboarded.textContent = onboardedMembers;
  if (kpiProgress) kpiProgress.style.width = `${onboardedPercent}%`;
  if (kpiPercent) kpiPercent.textContent = `${onboardedPercent}% પૂર્ણ થયું (${totalMembers - onboardedMembers} પેન્ડિંગ)`;

  renderSharedMobilesWidget();
  renderFamilyBreakdownWidget();
  renderCardTypesWidget();
  renderAdminTable();
}

function renderSharedMobilesWidget() {
  const container = document.getElementById('shared-mobiles-list');
  if (!container) return;

  const mobileGroups = {};
  appData.beneficiaries.forEach(b => {
    const mob = b.mobile ? b.mobile.strip ? b.mobile.strip() : b.mobile.trim() : '';
    if (mob) {
      if (!mobileGroups[mob]) mobileGroups[mob] = [];
      mobileGroups[mob].push(b);
    }
  });

  const sharedMobiles = Object.keys(mobileGroups)
    .filter(m => mobileGroups[m].length > 1)
    .sort((a, b) => mobileGroups[b].length - mobileGroups[a].length);

  const kpiSharedMob = document.getElementById('kpi-shared-mobiles');
  if (kpiSharedMob) kpiSharedMob.textContent = sharedMobiles.length;

  let html = "";
  sharedMobiles.forEach((mob) => {
    const members = mobileGroups[mob];
    let memberRows = "";
    members.forEach(m => {
      const statusClass = m.onboarded === "Yes" ? "yes" : "no";
      const statusText = m.onboarded === "Yes" ? "✓ ઓનબોર્ડ" : "⏳ પેન્ડિંગ";
      memberRows += `
        <div class="shared-member-row">
          <span>${m.name} (રેશન કાર્ડ: ${m.ration_card})</span>
          <span class="onboarded-tag ${statusClass}">${statusText}</span>
        </div>
      `;
    });

    html += `
      <div class="shared-mobile-item">
        <div class="shared-mobile-header" onclick="this.nextElementSibling.classList.toggle('open')">
          <span class="shared-mobile-num">📱 ${mob}</span>
          <span class="shared-count-tag">${members.length} સભ્યો સાથે જોડાયેલ ▼</span>
        </div>
        <div class="shared-members-body">
          ${memberRows}
        </div>
      </div>
    `;
  });

  container.innerHTML = html || `<p style="font-size:12px; color:var(--text-light);">કોઈ શેરિંગ મોબાઈલ નંબર મળેલ નથી.</p>`;
}

function renderFamilyBreakdownWidget() {
  const container = document.getElementById('family-breakdown-grid');
  if (!container) return;

  const sizeCounts = {};
  appData.households.forEach(h => {
    const size = h.members.length;
    sizeCounts[size] = (sizeCounts[size] || 0) + 1;
  });

  const multiMemberCards = appData.households.filter(h => h.members.length >= 2).length;
  const kpiSharedCards = document.getElementById('kpi-shared-cards');
  if (kpiSharedCards) kpiSharedCards.textContent = multiMemberCards;

  let html = "";
  Object.keys(sizeCounts).sort((a, b) => a - b).forEach(size => {
    html += `
      <div class="breakdown-card">
        <div class="breakdown-num">${sizeCounts[size]}</div>
        <div class="breakdown-label">${size} સભ્ય(ઓ) ધરાવતા કુટુંબ</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderCardTypesWidget() {
  const container = document.getElementById('card-types-grid');
  if (!container) return;

  const typeCounts = {};
  appData.beneficiaries.forEach(b => {
    const t = b.card_type ? b.card_type.toUpperCase() : 'અન્ય';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  let html = "";
  Object.keys(typeCounts).forEach(type => {
    html += `
      <div class="breakdown-card">
        <div class="breakdown-num">${typeCounts[type]}</div>
        <div class="breakdown-label">કેટેગરી: ${type}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderAdminTable() {
  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;

  let list = appData.beneficiaries;

  if (adminState.filterStatus === "PENDING") {
    list = list.filter(b => b.onboarded !== "Yes");
  } else if (adminState.filterStatus === "ONBOARDED") {
    list = list.filter(b => b.onboarded === "Yes");
  }

  if (adminState.searchQuery) {
    const q = adminState.searchQuery.toUpperCase();
    const cleanQ = q.replace(/\s+/g, '');
    list = list.filter(b => 
      b.name.toUpperCase().includes(q) ||
      b.ration_card.includes(q) ||
      b.clean_ration_card.includes(cleanQ) ||
      (b.mobile && b.mobile.includes(q))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-light);">કોઈ પરિણામ મળ્યું નથી.</td></tr>`;
    return;
  }

  let html = "";
  list.forEach(b => {
    const isChecked = b.onboarded === "Yes" ? "checked" : "";
    const statusTag = b.onboarded === "Yes" 
      ? `<span class="onboarded-tag yes">✓ ઓનબોર્ડેડ</span>` 
      : `<span class="onboarded-tag no">⏳ પેન્ડિંગ</span>`;

    html += `
      <tr>
        <td><strong>#${b.sr_no}</strong></td>
        <td><strong>${b.name}</strong></td>
        <td><span class="card-num-val">${b.ration_card}</span></td>
        <td><span class="card-type-badge">${b.card_type || '-'}</span></td>
        <td><span class="shared-mobile-num">${b.mobile || '-'}</span></td>
        <td>${statusTag}</td>
        <td>
          <div class="status-toggle-wrapper">
            <label class="toggle-switch">
              <input type="checkbox" ${isChecked} onchange="toggleBeneficiaryStatus(${b.sr_no})">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function toggleBeneficiaryStatus(srNo) {
  const beneficiary = appData.beneficiaries.find(b => b.sr_no === srNo);
  if (!beneficiary) return;

  const newStatus = beneficiary.onboarded === "Yes" ? "No" : "Yes";
  beneficiary.onboarded = newStatus;
  adminState.onboardingOverrides[srNo] = newStatus;

  try {
    localStorage.setItem('cbdc_onboarding_overrides', JSON.stringify(adminState.onboardingOverrides));
  } catch (e) {
    console.error("Error saving overrides:", e);
  }

  showToast(newStatus === "Yes" 
    ? `✅ ${beneficiary.name} — ઓનબોર્ડ સફળતાપૂર્વક અપડેટ થયું!` 
    : `⏳ ${beneficiary.name} — પેન્ડિંગ સેટ થયું!`);

  groupHouseholds();
  renderStats();
  renderList();
  renderAdminDashboard();
}

function exportUpdatedJSON() {
  const exportData = {
    metadata: {
      ...appData.metadata,
      exported_at: new Date().toISOString()
    },
    beneficiaries: appData.beneficiaries
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `CBDC_Updated_Data_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  showToast("📥 અપડેટેડ ડેટા JSON ફાઈલ ડાઉનલોડ થઈ!");
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.innerHTML = msg;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/* ==========================================================================
   6. Image Lightbox Handler & Quick Search
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

if (quickSearchBtn) quickSearchBtn.addEventListener('click', executeQuickSearch);
if (quickSearchInput) quickSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeQuickSearch(); });

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
  initAdminAuth();
  initLightbox();
});
