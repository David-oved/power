import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { showPremiumToast } from "../utils/helpers.js";
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Display "עדכן 🚀" button inside settings check update row
export function showUpdateStateInSettings(waitingWorker) {
  const updateStatus = document.getElementById('settings-update-status');
  const checkUpdateRow = document.getElementById('row-settings-check-update');
  if (updateStatus && checkUpdateRow) {
    updateStatus.innerHTML = '<button id="settings-update-now-btn" class="ios-update-badge-btn">עדכן 🚀</button>';
    checkUpdateRow.classList.remove('checking');
    
    const updateNowBtn = document.getElementById('settings-update-now-btn');
    if (updateNowBtn) {
      updateNowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateNowBtn.disabled = true;
        updateNowBtn.innerHTML = 'מוריד... ⏳';
        waitingWorker.postMessage({ action: 'downloadAndActivate' });
      });
    }
  }
}

// Initializer for the settings tab preferences
export function initPremiumSettings() {
  console.log("Initializing premium iOS Settings View...");

  const allTabs = document.querySelectorAll('.tab-content-container .tab-pane');
  const toggleDarkMode = document.getElementById('toggle-settings-dark-mode');
  const toggleNotifications = document.getElementById('toggle-settings-notifications');
  const settingsVer = document.getElementById('settings-system-version');
  const checkUpdateRow = document.getElementById('row-settings-check-update');
  const updateStatus = document.getElementById('settings-update-status');
  
  const isDarkMode = SafeStorage.getItem('settings_dark_mode') === 'true';
  const isNotificationsEnabled = SafeStorage.getItem('settings_notifications_enabled') !== 'false';

  allTabs.forEach(tab => {
    if (isDarkMode) {
      tab.classList.add('dark-theme');
    } else {
      tab.classList.remove('dark-theme');
    }
  });

  if (toggleDarkMode) {
    toggleDarkMode.checked = isDarkMode;
    toggleDarkMode.addEventListener('change', (e) => {
      SafeStorage.setItem('settings_dark_mode', e.target.checked);
      console.log('Saved settings dark mode preference:', e.target.checked);
      allTabs.forEach(tab => {
        if (e.target.checked) {
          tab.classList.add('dark-theme');
        } else {
          tab.classList.remove('dark-theme');
        }
      });
    });
  }

  if (toggleNotifications) {
    toggleNotifications.checked = isNotificationsEnabled;
    toggleNotifications.addEventListener('change', (e) => {
      SafeStorage.setItem('settings_notifications_enabled', e.target.checked);
      console.log('Saved notifications preference:', e.target.checked);
    });
  }

  if (settingsVer) {
    const mainBadge = document.getElementById('app-version-display');
    if (mainBadge && mainBadge.textContent) {
      settingsVer.textContent = mainBadge.textContent;
    } else {
      settingsVer.textContent = 'v1.2';
    }
  }

  if (checkUpdateRow && updateStatus) {
    checkUpdateRow.addEventListener('click', async (e) => {
      if (e.target.id === 'settings-update-now-btn') return;
      if (checkUpdateRow.classList.contains('checking')) return;

      checkUpdateRow.classList.add('checking');
      updateStatus.innerHTML = 'בודק... <span class="ios-spinner"></span>';
      
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const newWorker = reg.waiting || reg.installing;
            if (newWorker) {
              showUpdateStateInSettings(newWorker);
            } else {
              updateStatus.textContent = 'מעודכן ✓';
              updateStatus.style.color = '#34c759'; // iOS Green
              setTimeout(() => {
                updateStatus.textContent = 'בדוק';
                updateStatus.style.color = '';
                checkUpdateRow.classList.remove('checking');
              }, 3000);
            }
          } else {
            updateStatus.textContent = 'לא נתמך';
            checkUpdateRow.classList.remove('checking');
          }
        } catch (err) {
          console.error('Manual PWA update check failed:', err);
          updateStatus.textContent = 'שגיאה ⚠️';
          setTimeout(() => {
            updateStatus.textContent = 'בדוק';
            checkUpdateRow.classList.remove('checking');
          }, 3000);
        }
      } else {
        updateStatus.textContent = 'לא נתמך';
        checkUpdateRow.classList.remove('checking');
      }
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        showUpdateStateInSettings(reg.waiting);
      }
    });
  }

  // Initialize the admin panel elements
  initAdminPanel();
}

// Binds global configurations
export function initSettingsModule() {
  window.initPremiumSettings = initPremiumSettings;
  window.showUpdateStateInSettings = showUpdateStateInSettings;
  window.checkAdminViewAccessibility = checkAdminViewAccessibility;
  window.initAdminPanel = initAdminPanel;
}

// Check if current user is an admin and show/hide the Admin settings row group
export function checkAdminViewAccessibility() {
  const adminRowGroup = document.getElementById('row-settings-admin-group');
  if (adminRowGroup) {
    if (state.currentUserRole === 'admin') {
      adminRowGroup.classList.remove('hide');
    } else {
      adminRowGroup.classList.add('hide');
    }
  }
}

// Binds event listeners for Admin Panel navigation and searches
export function initAdminPanel() {
  const goToAdminBtn = document.getElementById('go-to-admin-btn');
  const backBtn = document.getElementById('back-to-settings-from-admin-btn');
  const mainView = document.getElementById('settings-main-view');
  const adminView = document.getElementById('settings-admin-view');
  const searchInput = document.getElementById('admin-search-users-input');

  if (goToAdminBtn && mainView && adminView) {
    goToAdminBtn.addEventListener('click', () => {
      mainView.classList.add('hide');
      adminView.classList.remove('hide');
      fetchAndRenderUsers();
    });
  }

  if (backBtn && mainView && adminView) {
    backBtn.addEventListener('click', () => {
      adminView.classList.add('hide');
      mainView.classList.remove('hide');
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      renderUsersList(query);
    });
  }
}

// Fetch all user accounts from the secure Firestore database
async function fetchAndRenderUsers() {
  const loader = document.getElementById('admin-users-loader');
  const container = document.getElementById('admin-users-list-container');
  if (!state.db) {
    if (container) container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff3b30; font-weight: bold;">שגיאה: מסד הנתונים מנותק</div>';
    return;
  }

  if (loader) loader.classList.remove('hide');

  try {
    const querySnapshot = await getDocs(collection(state.db, "users"));
    const users = [];
    querySnapshot.forEach((docSnap) => {
      users.push(docSnap.data());
    });
    
    // Sort users: admins first, then alphabetically by display name
    users.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

    state.allUsersList = users;
    
    // Update KPI dashboard stats
    updateAdminStats(users);

    renderUsersList();
  } catch (error) {
    console.error("Failed to fetch users for admin panel:", error);
    showPremiumToast("שגיאה בטעינת משתמשים. אנא ודא שיש לך הרשאת מנהל.", "error");
    if (container) container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff3b30; font-size: 0.9rem;">אין הרשאה מתאימה או שישנה בעיית רשת.</div>';
  } finally {
    if (loader) loader.classList.add('hide');
  }
}

// Update KPI Stats elements
function updateAdminStats(users) {
  const totalEl = document.getElementById('admin-stat-total-users');
  const activeTodayEl = document.getElementById('admin-stat-active-today');
  const adminsEl = document.getElementById('admin-stat-admins');
  
  if (totalEl) totalEl.textContent = users.length;
  
  // Calculate active today (lastLogin is within the last 24 hours)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const activeTodayCount = users.filter(u => {
    if (!u.lastLogin) return false;
    const loginTime = u.lastLogin.seconds ? u.lastLogin.seconds * 1000 : new Date(u.lastLogin).getTime();
    return loginTime > oneDayAgo;
  }).length;
  if (activeTodayEl) activeTodayEl.textContent = activeTodayCount;
  
  const adminsCount = users.filter(u => u.role === 'admin').length;
  if (adminsEl) adminsEl.textContent = adminsCount;
}

// Build and render HTML list of users
function renderUsersList(searchQuery = '') {
  const container = document.getElementById('admin-users-list-container');
  if (!container) return;

  const filtered = state.allUsersList.filter(u => {
    const name = (u.displayName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(searchQuery) || email.includes(searchQuery);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding: 30px 20px; text-align: center; color: var(--text-muted); font-size: 0.95rem;">לא נמצאו משתמשים מתאימים</div>';
    return;
  }

  container.innerHTML = filtered.map(u => {
    const joinDate = u.createdAt 
      ? new Date(u.createdAt.seconds ? u.createdAt.seconds * 1000 : u.createdAt).toLocaleDateString('he-IL') 
      : '--';
    const lastActive = u.lastLogin 
      ? new Date(u.lastLogin.seconds ? u.lastLogin.seconds * 1000 : u.lastLogin).toLocaleDateString('he-IL') 
      : '--';
    const photo = u.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

    const isAdminRole = u.role === 'admin';
    const wrapperClass = isAdminRole ? 'ios-role-select-wrapper admin-role' : 'ios-role-select-wrapper';
    const selectClass = isAdminRole ? 'ios-role-select role-admin' : 'ios-role-select';

    return `
      <div class="admin-users-list-item" data-uid="${u.uid}">
        <div class="admin-user-info-group">
          <img class="admin-user-avatar" src="${photo}" onerror="this.src='https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'" alt="${u.displayName}">
          <div class="admin-user-details">
            <span class="admin-user-name">${u.displayName}</span>
            <span class="admin-user-email">${u.email}</span>
            <span class="admin-user-meta-sub">הצטרף: ${joinDate} | פעיל: ${lastActive}</span>
          </div>
        </div>
        <div class="${wrapperClass}">
          <select class="${selectClass}" data-uid="${u.uid}">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>משתמש</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>מנהל</option>
          </select>
        </div>
      </div>
    `;
  }).join('');

  // Bind change events to role dropdown selectors
  container.querySelectorAll('.ios-role-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const uid = e.target.dataset.uid;
      const newRole = e.target.value;
      await updateUserRole(uid, newRole, e.target);
    });
  });
}

// Update a user's role in the secure Firestore database
async function updateUserRole(uid, newRole, selectElement) {
  if (!state.db) return;
  
  // Protect current admin from accidentally removing their own admin privilege
  if (uid === state.currentUser.uid && newRole !== 'admin') {
    showPremiumToast("אינך יכול לבטל את הרשאות הניהול של עצמך!", "error");
    selectElement.value = 'admin';
    return;
  }

  try {
    const userDocRef = doc(state.db, "users", uid);
    await updateDoc(userDocRef, {
      role: newRole
    });

    showPremiumToast("תפקיד המשתמש עודכן בהצלחה! ✨", "success");
    
    // Update local state list
    const userInState = state.allUsersList.find(u => u.uid === uid);
    if (userInState) userInState.role = newRole;

    // Refresh display style classes
    const wrapper = selectElement.parentElement;
    if (newRole === 'admin') {
      wrapper.className = 'ios-role-select-wrapper admin-role';
      selectElement.className = 'ios-role-select role-admin';
    } else {
      wrapper.className = 'ios-role-select-wrapper';
      selectElement.className = 'ios-role-select';
    }

    // Refresh KPI Stats
    updateAdminStats(state.allUsersList);
  } catch (error) {
    console.error("Failed to update user role:", error);
    showPremiumToast("עדכון התפקיד נכשל. הרשאת מנהל נדרשת.", "error");
    // Revert select picker value
    selectElement.value = newRole === 'admin' ? 'user' : 'admin';
  }
}
