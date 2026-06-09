// RFD Frontend Application
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3001' 
  : '';

// State
let currentUser = null;
let token = localStorage.getItem('rfd_token');
let servers = [];
let serversRefreshInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 1000);
  
  if (token) {
    validateToken();
  } else {
    showAuthModal();
  }
  
  // Setup file input handler
  const placeFileInput = document.getElementById('placeFile');
  if (placeFileInput) {
    placeFileInput.addEventListener('change', (e) => {
      const fileName = e.target.files[0]?.name || 'No file selected';
      document.getElementById('selectedFileName').textContent = fileName;
    });
  }
});

// API Helpers
async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        handleLogout();
        throw new Error('Session expired');
      }
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    showToast(error.message, 'error');
    throw error;
  }
}

// Auth Functions
function showAuthModal() {
  document.getElementById('authModal').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('authModal').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('authError').classList.add('hidden');
}

function showRegister() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
  document.getElementById('authError').classList.add('hidden');
}

async function validateToken() {
  try {
    const data = await api('/api/auth/profile');
    currentUser = data.user;
    updateUserUI();
    showApp();
    loadDashboard();
    
    if (currentUser.role === 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
      loadAdminData();
    }
  } catch (error) {
    localStorage.removeItem('rfd_token');
    token = null;
    showAuthModal();
  }
}

async function handleLogin() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  
  if (!username || !password) {
    showAuthError('Please fill in all fields');
    return;
  }
  
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('rfd_token', token);
    
    updateUserUI();
    showApp();
    loadDashboard();
    
    if (currentUser.role === 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
      loadAdminData();
    }
    
    showToast('Welcome back, ' + currentUser.username + '!');
  } catch (error) {
    showAuthError(error.message);
  }
}

async function handleRegister() {
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  
  if (!username || !password || !confirmPassword) {
    showAuthError('Please fill in all fields');
    return;
  }
  
  if (password !== confirmPassword) {
    showAuthError('Passwords do not match');
    return;
  }
  
  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }
  
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    showToast(`Registration successful! Your User Code: ${data.userCode}`);
    showLogin();
  } catch (error) {
    showAuthError(error.message);
  }
}

function handleLogout() {
  if (token) {
    api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }
  
  localStorage.removeItem('rfd_token');
  token = null;
  currentUser = null;
  
  if (serversRefreshInterval) {
    clearInterval(serversRefreshInterval);
  }
  
  showAuthModal();
}

function showAuthError(message) {
  const errorEl = document.getElementById('authError');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

// UI Update Functions
function updateUserUI() {
  if (!currentUser) return;
  
  document.getElementById('userName').textContent = currentUser.username;
  document.getElementById('userCode').textContent = currentUser.userCode;
  document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
}

function updateTime() {
  const now = new Date();
  document.getElementById('currentTime').textContent = now.toLocaleTimeString();
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  
  toastMessage.textContent = message;
  toast.className = `fixed bottom-4 right-4 rounded-lg p-4 shadow-xl transition-all z-50 ${
    type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-700'
  }`;
  toast.classList.remove('translate-y-full', 'opacity-0');
  
  setTimeout(() => {
    toast.classList.add('translate-y-full', 'opacity-0');
  }, 3000);
}

// Navigation
function showPage(page) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.page === page) {
      btn.classList.add('active');
    }
  });
  
  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    servers: 'Servers',
    profile: 'My Profile',
    config: 'Configuration',
    clients: 'Roblox Clients',
    admin: 'Admin Panel'
  };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
  
  // Show/hide pages
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(`page-${page}`)?.classList.remove('hidden');
  
  // Load page data
  switch (page) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'servers':
      loadServers();
      startServersRefresh();
      break;
    case 'profile':
      loadProfile();
      break;
    case 'config':
      loadConfig();
      break;
    case 'clients':
      loadClients();
      break;
    case 'admin':
      loadAdminData();
      break;
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('-translate-x-full');
}

// Dashboard
async function loadDashboard() {
  try {
    const [statsData, profileData] = await Promise.all([
      api('/api/stats'),
      api('/api/auth/profile')
    ]);
    
    document.getElementById('statUsers').textContent = statsData.stats.totalUsers;
    document.getElementById('statOnline').textContent = statsData.stats.onlineUsers;
    document.getElementById('statServers').textContent = statsData.stats.runningServers;
    document.getElementById('statPort').textContent = statsData.stats.activePort || '-';
    
    // Load join history
    const history = profileData.user.joinHistory || [];
    const historyEl = document.getElementById('joinHistory');
    
    if (history.length === 0) {
      historyEl.innerHTML = '<p class="text-gray-400 text-sm">No recent joins</p>';
    } else {
      historyEl.innerHTML = history.map(h => `
        <div class="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
          <div>
            <p class="font-medium">${h.serverName || 'Unknown'}</p>
            <p class="text-xs text-gray-500">${h.host}:${h.port}</p>
          </div>
          <span class="text-xs text-gray-500">${new Date(h.joinedAt).toLocaleString()}</span>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Failed to load dashboard:', error);
  }
}

// Servers
async function loadServers() {
  try {
    const data = await api('/api/servers');
    servers = data.servers || [];
    renderServers();
  } catch (error) {
    console.error('Failed to load servers:', error);
  }
}

function renderServers() {
  const tbody = document.getElementById('serversTable');
  
  if (servers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No servers configured</td></tr>';
    return;
  }
  
  tbody.innerHTML = servers.map(server => `
    <tr class="hover:bg-gray-700/50">
      <td class="px-4 py-3 font-medium">${server.name}</td>
      <td class="px-4 py-3 font-mono text-sm">${server.host}</td>
      <td class="px-4 py-3 font-mono text-sm">${server.port}</td>
      <td class="px-4 py-3">${server.currentPlayers}/${server.maxPlayers}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full ${server.status === 'running' ? 'bg-green-500' : 'bg-gray-500'}"></span>
          ${server.status}
        </span>
      </td>
      <td class="px-4 py-3">
        ${server.status === 'running' ? `
          <button onclick="joinServer(${server.id})" class="bg-rfd-600 hover:bg-rfd-700 px-3 py-1 rounded text-sm transition">Join</button>
        ` : `
          <span class="text-gray-500 text-sm">Offline</span>
        `}
        ${currentUser?.role === 'admin' ? `
          <button onclick="deleteServer(${server.id})" class="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-1 rounded text-sm ml-2 transition">Delete</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function startServersRefresh() {
  if (serversRefreshInterval) {
    clearInterval(serversRefreshInterval);
  }
  serversRefreshInterval = setInterval(loadServers, 10000);
}

async function joinServer(serverId) {
  try {
    const data = await api('/api/join', {
      method: 'POST',
      body: JSON.stringify({ serverId })
    });
    
    const { host, port, userCode, launchCommand, serverName } = data.data;
    
    showToast(`Joining ${serverName}...`);
    
    // Copy command to clipboard
    navigator.clipboard.writeText(launchCommand).then(() => {
      showToast('Launch command copied to clipboard!');
    });
    
    // Open in new tab (if RFD has a web handler)
    const launchUrl = `rfd://join?host=${host}&port=${port}&user=${userCode}`;
    window.location.href = launchUrl;
    
  } catch (error) {
    console.error('Join failed:', error);
  }
}

async function scanPorts() {
  try {
    showToast('Scanning ports...', 'info');
    const data = await api('/api/servers/scan/ports');
    const openPorts = data.results.filter(r => r.status === 'open');
    
    if (openPorts.length > 0) {
      showToast(`Found ${openPorts.length} open port(s): ${openPorts.map(p => p.port).join(', ')}`);
    } else {
      showToast('No open ports found');
    }
  } catch (error) {
    console.error('Scan failed:', error);
  }
}

async function deleteServer(serverId) {
  if (!confirm('Are you sure you want to delete this server?')) return;
  
  try {
    await api(`/api/servers/${serverId}`, { method: 'DELETE' });
    showToast('Server deleted');
    loadServers();
  } catch (error) {
    console.error('Delete failed:', error);
  }
}

// Profile
function loadProfile() {
  if (!currentUser) return;
  
  document.getElementById('profileAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
  document.getElementById('profileName').textContent = currentUser.username;
  document.getElementById('profileUserCode').textContent = currentUser.userCode;
  document.getElementById('editUsername').value = currentUser.username;
}

function copyUserCode() {
  navigator.clipboard.writeText(currentUser.userCode);
  showToast('User Code copied!');
}

async function updateProfile() {
  const newUsername = document.getElementById('editUsername').value;
  
  if (!newUsername || newUsername === currentUser.username) {
    showToast('No changes to save');
    return;
  }
  
  try {
    const data = await api('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ username: newUsername })
    });
    
    currentUser = data.user;
    updateUserUI();
    showToast('Profile updated');
  } catch (error) {
    console.error('Update failed:', error);
  }
}

async function changePassword() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }
  
  try {
    await api('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    
    showToast('Password changed successfully');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
  } catch (error) {
    console.error('Password change failed:', error);
  }
}

// Configuration (Admin)
async function loadConfig() {
  try {
    const data = await api('/api/config');
    document.getElementById('cfgServerName').value = data.config.serverName || '';
    document.getElementById('cfgPort').value = data.config.port || '53640';
    document.getElementById('cfgMaxPlayers').value = data.config.maxPlayers || '100';
    document.getElementById('cfgRfdPath').value = data.config.rfdPath || '';
    document.getElementById('cfgPlaceFile').value = data.config.placeFile || '';
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

async function saveConfig() {
  const config = {
    serverName: document.getElementById('cfgServerName').value,
    port: document.getElementById('cfgPort').value,
    maxPlayers: document.getElementById('cfgMaxPlayers').value,
    rfdPath: document.getElementById('cfgRfdPath').value,
    placeFile: document.getElementById('cfgPlaceFile').value
  };
  
  try {
    await api('/api/config/bulk', {
      method: 'POST',
      body: JSON.stringify(config)
    });
    showToast('Configuration saved');
  } catch (error) {
    console.error('Save failed:', error);
  }
}

async function detectRFD() {
  try {
    const data = await api('/api/detect-rfd');
    const { rfdPath, configPath, config } = data.detection;
    
    const el = document.getElementById('detectedConfig');
    
    if (rfdPath) {
      el.innerHTML = `
        <p class="text-green-400">RFD Found: ${rfdPath}</p>
        ${configPath ? `<p class="text-blue-400">Config: ${configPath}</p>` : ''}
        ${config ? `<pre class="bg-gray-900 p-2 rounded mt-2 text-xs">${JSON.stringify(config, null, 2)}</pre>` : ''}
      `;
      el.classList.remove('hidden');
    } else {
      el.innerHTML = '<p class="text-yellow-400">RFD not found in common locations</p>';
      el.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Detection failed:', error);
  }
}

async function generateConfig() {
  const config = {
    name: document.getElementById('cfgServerName').value || 'RFD Server',
    port: parseInt(document.getElementById('cfgPort').value) || 53640,
    maxPlayers: parseInt(document.getElementById('cfgMaxPlayers').value) || 100,
    placeFile: document.getElementById('cfgPlaceFile').value || ''
  };
  
  try {
    const data = await api('/api/generate-config', {
      method: 'POST',
      body: JSON.stringify(config)
    });
    
    // Download the file
    const blob = new Blob([data.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'GameConfig.toml';
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('GameConfig.toml downloaded');
  } catch (error) {
    console.error('Generate failed:', error);
  }
}

// Roblox Clients (Admin)
async function loadClients() {
  try {
    const data = await api('/api/clients');
    renderClients(data.clients || []);
  } catch (error) {
    console.error('Failed to load clients:', error);
  }
}

function renderClients(clients) {
  const tbody = document.getElementById('clientsTable');
  
  if (clients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No clients configured</td></tr>';
    return;
  }
  
  tbody.innerHTML = clients.map(client => `
    <tr class="hover:bg-gray-700/50">
      <td class="px-4 py-3 font-medium">${client.name}</td>
      <td class="px-4 py-3 font-mono text-sm">${client.clientVersion}</td>
      <td class="px-4 py-3 text-sm">${client.launchArguments || '-'}</td>
      <td class="px-4 py-3">${client.isDefault ? '<span class="badge badge-success">Default</span>' : ''}</td>
      <td class="px-4 py-3">
        ${!client.isDefault ? `<button onclick="setDefaultClient(${client.id})" class="text-rfd-400 hover:underline text-sm">Set Default</button>` : ''}
        <button onclick="deleteClient(${client.id})" class="text-red-400 hover:underline text-sm ml-2">Delete</button>
      </td>
    </tr>
  `).join('');
}

function showAddClientModal() {
  document.getElementById('clientModal').classList.remove('hidden');
}

function hideClientModal() {
  document.getElementById('clientModal').classList.add('hidden');
  document.getElementById('clientName').value = '';
  document.getElementById('clientVersion').value = '';
  document.getElementById('clientPath').value = '';
  document.getElementById('clientArgs').value = '';
  document.getElementById('clientDefault').checked = false;
}

async function addClient() {
  const client = {
    name: document.getElementById('clientName').value,
    clientVersion: document.getElementById('clientVersion').value,
    clientPath: document.getElementById('clientPath').value,
    launchArguments: document.getElementById('clientArgs').value,
    isDefault: document.getElementById('clientDefault').checked
  };
  
  if (!client.name || !client.clientVersion) {
    showToast('Name and version are required', 'error');
    return;
  }
  
  try {
    await api('/api/clients', {
      method: 'POST',
      body: JSON.stringify(client)
    });
    
    hideClientModal();
    loadClients();
    showToast('Client added');
  } catch (error) {
    console.error('Add client failed:', error);
  }
}

async function setDefaultClient(clientId) {
  try {
    await api(`/api/clients/${clientId}/default`, { method: 'POST' });
    loadClients();
    showToast('Default client updated');
  } catch (error) {
    console.error('Set default failed:', error);
  }
}

async function deleteClient(clientId) {
  if (!confirm('Delete this client?')) return;
  
  try {
    await api(`/api/clients/${clientId}`, { method: 'DELETE' });
    loadClients();
    showToast('Client deleted');
  } catch (error) {
    console.error('Delete client failed:', error);
  }
}

// Admin Panel
async function loadAdminData() {
  loadServers();
  loadAuditLogs();
  loadUsers();
  loadConsoleLogs();
}

async function loadAuditLogs() {
  try {
    const data = await api('/api/audit-logs?limit=50');
    const logs = data.logs || [];
    
    const el = document.getElementById('auditLogs');
    
    if (logs.length === 0) {
      el.innerHTML = '<p class="text-gray-500">No logs</p>';
      return;
    }
    
    el.innerHTML = logs.slice(0, 20).map(log => `
      <div class="flex gap-4 text-xs">
        <span class="text-gray-500">${new Date(log.createdAt).toLocaleTimeString()}</span>
        <span class="text-rfd-400">${log.username || 'System'}</span>
        <span class="text-gray-400">${log.action}</span>
        <span class="text-gray-600">${log.details || ''}</span>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load audit logs:', error);
  }
}

async function loadUsers() {
  try {
    const data = await api('/api/users');
    renderUsers(data.users || []);
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTable');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-400">No users</td></tr>';
    return;
  }
  
  tbody.innerHTML = users.map(user => `
    <tr class="hover:bg-gray-700/50">
      <td class="px-4 py-2 font-mono">${user.id}</td>
      <td class="px-4 py-2">${user.username}</td>
      <td class="px-4 py-2 font-mono text-rfd-400">${user.userCode}</td>
      <td class="px-4 py-2">
        <span class="badge ${user.role === 'admin' ? 'badge-warning' : 'badge-info'}">${user.role}</span>
      </td>
      <td class="px-4 py-2">
        <span class="inline-flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-500'}"></span>
          ${user.isOnline ? 'Online' : 'Offline'}
        </span>
      </td>
    </tr>
  `).join('');
}

function loadConsoleLogs() {
  addConsoleLog('info', 'Console connected. Waiting for server events...');
}

function addConsoleLog(type, message) {
  const consoleEl = document.getElementById('consoleOutput');
  const line = document.createElement('p');
  line.className = `console-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

async function createServer() {
  const server = {
    name: document.getElementById('newServerName').value,
    host: document.getElementById('newServerHost').value,
    port: parseInt(document.getElementById('newServerPort').value),
    maxPlayers: parseInt(document.getElementById('newServerMaxPlayers').value) || 100
  };
  
  if (!server.name || !server.host || !server.port) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    await api('/api/servers', {
      method: 'POST',
      body: JSON.stringify(server)
    });
    
    showToast('Server created');
    loadServers();
    loadAuditLogs();
    
    // Clear form
    document.getElementById('newServerName').value = '';
  } catch (error) {
    console.error('Create server failed:', error);
  }
}

// File Upload
async function uploadPlaceFile() {
  const fileInput = document.getElementById('placeFile');
  const file = fileInput.files[0];
  
  if (!file) {
    showToast('Please select a file', 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('place', file);
  
  try {
    const response = await fetch(`${API_BASE}/api/upload/place`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('File uploaded: ' + data.file.name);
      document.getElementById('cfgPlaceFile').value = data.file.path;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    showToast('Upload failed: ' + error.message, 'error');
  }
}