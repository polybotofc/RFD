// QUANTA - Roblox 2021 Revival Style Application

// State Management
const QuantaApp = {
    currentPage: 'home',
    user: null,
    isLoggedIn: false,
    games: [
        { id: 1, title: 'Adventure Island', genre: 'Adventure', players: 12453, thumbnail: 'https://picsum.photos/seed/game1/400/225' },
        { id: 2, title: 'Speed Racing Pro', genre: 'Racing', players: 8921, thumbnail: 'https://picsum.photos/seed/game2/400/225' },
        { id: 3, title: 'Block City Wars', genre: 'Action', players: 15678, thumbnail: 'https://picsum.photos/seed/game3/400/225' },
        { id: 4, title: 'Super Ninja Academy', genre: 'RPG', players: 22341, thumbnail: 'https://picsum.photos/seed/game4/400/225' },
        { id: 5, title: 'Build & Survive', genre: 'Survival', players: 18456, thumbnail: 'https://picsum.photos/seed/game5/400/225' },
        { id: 6, title: 'Space Explorer', genre: 'Simulation', players: 7654, thumbnail: 'https://picsum.photos/seed/game6/400/225' },
        { id: 7, title: 'Haunted Hospital', genre: 'Horror', players: 11234, thumbnail: 'https://picsum.photos/seed/game7/400/225' },
        { id: 8, title: 'Cooking Master', genre: 'Simulation', players: 9876, thumbnail: 'https://picsum.photos/seed/game8/400/225' },
        { id: 9, title: 'Football Manager', genre: 'Sports', players: 14567, thumbnail: 'https://picsum.photos/seed/game9/400/225' },
        { id: 10, title: 'Pirate Kingdom', genre: 'Adventure', players: 16789, thumbnail: 'https://picsum.photos/seed/game10/400/225' },
        { id: 11, title: 'Medieval Battles', genre: 'RPG', players: 13456, thumbnail: 'https://picsum.photos/seed/game11/400/225' },
        { id: 12, title: 'Dance Party Online', genre: 'Social', players: 19876, thumbnail: 'https://picsum.photos/seed/game12/400/225' }
    ],
    catalog: [
        { id: 1, title: 'Neon Wings', category: 'Back Accessories', price: 800, thumbnail: 'https://picsum.photos/seed/item1/300/300' },
        { id: 2, title: 'Cyber Samurai', category: 'Face', price: 1500, thumbnail: 'https://picsum.photos/seed/item2/300/300' },
        { id: 3, title: 'Royal Crown', category: 'Hat', price: 2500, thumbnail: 'https://picsum.photos/seed/item3/300/300' },
        { id: 4, title: 'Dragon Hoodie', category: 'Torso', price: 1200, thumbnail: 'https://picsum.photos/seed/item4/300/300' },
        { id: 5, title: 'Sparkle Shirt', category: 'Torso', price: 650, thumbnail: 'https://picsum.photos/seed/item5/300/300' },
        { id: 6, title: 'Shadow Mask', category: 'Face', price: 900, thumbnail: 'https://picsum.photos/seed/item6/300/300' },
        { id: 7, title: 'Golden Wings', category: 'Back Accessories', price: 3000, thumbnail: 'https://picsum.photos/seed/item7/300/300' },
        { id: 8, title: 'Space Helmet', category: 'Head', price: 1800, thumbnail: 'https://picsum.photos/seed/item8/300/300' },
        { id: 9, title: 'Ninja Outfit', category: 'Complete Outfit', price: 5000, thumbnail: 'https://picsum.photos/seed/item9/300/300' },
        { id: 10, title: 'Rainbow Trail', category: 'Accessories', price: 750, thumbnail: 'https://picsum.photos/seed/item10/300/300' }
    ]
};

// Initialize App
function initApp() {
    checkAuth();
    loadPage(getCurrentPageFromURL());
    setupEventListeners();
    renderNavigation();
}

// Check Authentication
function checkAuth() {
    const savedUser = localStorage.getItem('quanta_user');
    if (savedUser) {
        QuantaApp.user = JSON.parse(savedUser);
        QuantaApp.isLoggedIn = true;
    }
}

// Get Current Page from URL
function getCurrentPageFromURL() {
    const hash = window.location.hash.slice(1) || 'home';
    return hash;
}

// Load Page
function loadPage(pageName) {
    QuantaApp.currentPage = pageName;
    const container = document.getElementById('app-content');
    
    if (!container) return;
    
    switch(pageName) {
        case 'home':
            renderHomePage(container);
            break;
        case 'games':
            renderGamesPage(container);
            break;
        case 'catalog':
            renderCatalogPage(container);
            break;
        case 'create':
            renderCreatePage(container);
            break;
        case 'login':
            renderLoginPage(container);
            break;
        case 'signup':
            renderSignupPage(container);
            break;
        case 'profile':
            renderProfilePage(container);
            break;
        default:
            renderHomePage(container);
    }
    
    updateActiveNav();
}

// Render Navigation
function renderNavigation() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;
    
    nav.innerHTML = `
        <li><a href="#home" class="${QuantaApp.currentPage === 'home' ? 'active' : ''}">Discover</a></li>
        <li><a href="#games" class="${QuantaApp.currentPage === 'games' ? 'active' : ''}">Games</a></li>
        <li><a href="#catalog" class="${QuantaApp.currentPage === 'catalog' ? 'active' : ''}">Avatar Shop</a></li>
        <li><a href="#create" class="${QuantaApp.currentPage === 'create' ? 'active' : ''}">Create</a></li>
    `;
    
    const navbarRight = document.getElementById('navbar-right');
    if (navbarRight) {
        if (QuantaApp.isLoggedIn) {
            navbarRight.innerHTML = `
                <div class="robux-display" onclick="toggleUserMenu()">
                    <span class="robux-icon">Q</span>
                    <span class="robux-amount">${QuantaApp.user.robux || 1000}</span>
                </div>
                <div class="user-avatar-dropdown" style="position: relative;">
                    <div class="user-avatar" onclick="toggleUserMenu()">
                        ${QuantaApp.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="dropdown-menu" id="user-dropdown">
                        <a href="#profile" class="dropdown-item">👤 My Profile</a>
                        <a href="#settings" class="dropdown-item">⚙️ Settings</a>
                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item" onclick="logout()">🚪 Log Out</a>
                    </div>
                </div>
            `;
        } else {
            navbarRight.innerHTML = `
                <div class="navbar-search">
                    <div class="input-group">
                        <input type="text" placeholder="Search games, people, or items...">
                        <button class="input-addon-btn">
                            <span>🔍</span>
                        </button>
                    </div>
                </div>
                <a href="#login" class="signup-button">Sign Up</a>
                <a href="#login" style="color: var(--text-secondary); text-decoration: none; font-weight: 600;">Log In</a>
            `;
        }
    }
}

// Update Active Navigation
function updateActiveNav() {
    const navLinks = document.querySelectorAll('.rbx-navbar li a');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${QuantaApp.currentPage}`) {
            link.classList.add('active');
        }
    });
}

// Toggle User Menu
function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Render Home Page
function renderHomePage(container) {
    container.innerHTML = `
        <div class="hero-section">
            <div class="hero-content">
                <h1>Welcome to QUANTA</h1>
                <p>Play millions of games, create your own adventures, and connect with friends in our virtual universe.</p>
                <div class="hero-btns">
                    <a href="#games" class="btn-primary">🎮 Play Now</a>
                    <a href="#signup" class="btn-secondary">✨ Sign Up Free</a>
                </div>
            </div>
        </div>
        
        <section class="featured-section">
            <h2 class="section-title">Featured Games <a href="#games">See All →</a></h2>
            <div class="game-grid" id="featured-games">
                ${QuantaApp.games.slice(0, 8).map(game => renderGameCard(game)).join('')}
            </div>
        </section>
        
        <section class="create-section">
            <h2 class="section-title">Start Creating</h2>
            <div class="create-card">
                <div class="create-icon">🎮</div>
                <h3>Create a Game</h3>
                <p>Build your own experience with our powerful studio tools</p>
            </div>
            <div class="create-card">
                <div class="create-icon">👕</div>
                <h3>Design Items</h3>
                <p>Create unique accessories for the avatar shop</p>
            </div>
            <div class="create-card">
                <div class="create-icon">🌍</div>
                <h3>Build Worlds</h3>
                <p>Design immersive environments and experiences</p>
            </div>
            <div class="create-card">
                <div class="create-icon">💰</div>
                <h3>Earn QUANTA</h3>
                <p>Monetize your creations and earn real rewards</p>
            </div>
        </section>
    `;
}

// Render Games Page
function renderGamesPage(container) {
    container.innerHTML = `
        <div class="page-header">
            <h1>Games</h1>
            <p>Discover and play millions of experiences</p>
        </div>
        
        <div class="filter-bar">
            <select class="filter-select" id="genre-filter">
                <option value="">All Genres</option>
                <option value="Adventure">Adventure</option>
                <option value="Racing">Racing</option>
                <option value="Action">Action</option>
                <option value="RPG">RPG</option>
                <option value="Simulation">Simulation</option>
                <option value="Horror">Horror</option>
                <option value="Sports">Sports</option>
            </select>
            <select class="filter-select" id="sort-filter">
                <option value="popular">Most Popular</option>
                <option value="newest">Newest</option>
                <option value="players">Most Players</option>
            </select>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="filterGames('all')">All</button>
            <button class="tab" onclick="filterGames('popular')">Popular</button>
            <button class="tab" onclick="filterGames('new')">New</button>
            <button class="tab" onclick="filterGames('recommended')">Recommended</button>
        </div>
        
        <div class="game-grid" id="games-grid">
            ${QuantaApp.games.map(game => renderGameCard(game)).join('')}
        </div>
    `;
}

// Render Catalog Page
function renderCatalogPage(container) {
    container.innerHTML = `
        <div class="page-header">
            <h1>Avatar Shop</h1>
            <p>Dress up your avatar with unique items</p>
        </div>
        
        <div class="category-tabs">
            <button class="tab-btn active">All Items</button>
            <button class="tab-btn">Featured</button>
            <button class="tab-btn">Hats</button>
            <button class="tab-btn">Faces</button>
            <button class="tab-btn">Accessories</button>
            <button class="tab-btn">Clothing</button>
        </div>
        
        <div class="filter-bar">
            <select class="filter-select">
                <option value="">All Categories</option>
                <option value="hats">Hats</option>
                <option value="faces">Faces</option>
                <option value="accessories">Accessories</option>
                <option value="clothing">Clothing</option>
            </select>
            <select class="filter-select">
                <option value="">Price: Low to High</option>
                <option value="high">Price: High to Low</option>
                <option value="newest">Newest</option>
            </select>
        </div>
        
        <div class="game-grid" id="catalog-grid">
            ${QuantaApp.catalog.map(item => renderItemCard(item)).join('')}
        </div>
    `;
}

// Render Create Page
function renderCreatePage(container) {
    container.innerHTML = `
        <div class="page-header">
            <h1>Create</h1>
            <p>Build experiences and items for QUANTA</p>
        </div>
        
        <div class="create-section" style="background: var(--bg-secondary); margin-top: 0;">
            <div class="create-card" style="background: var(--bg-primary);">
                <div class="create-icon">🎮</div>
                <h3>QUANTA Studio</h3>
                <p>Design and publish your own games</p>
                <button class="btn-primary" style="margin-top: 16px; width: 100%;">Open Studio</button>
            </div>
            <div class="create-card" style="background: var(--bg-primary);">
                <div class="create-icon">🎨</div>
                <h3>Item Builder</h3>
                <p>Create clothing and accessories</p>
                <button class="btn-primary" style="margin-top: 16px; width: 100%;">Start Creating</button>
            </div>
            <div class="create-card" style="background: var(--bg-primary);">
                <div class="create-icon">📊</div>
                <h3>Creator Dashboard</h3>
                <p>Track your earnings and stats</p>
                <button class="btn-primary" style="margin-top: 16px; width: 100%;">View Dashboard</button>
            </div>
        </div>
        
        <section style="margin-top: 40px;">
            <h2 class="section-title">Popular Creators</h2>
            <div class="game-grid">
                ${renderCreatorCard('StarGamer', '2.5M', '123 games')},
                ${renderCreatorCard('CoolBuilder', '1.8M', '89 games')},
                ${renderCreatorCard('ProCoder', '3.2M', '56 games')},
                ${renderCreatorCard('GameMaster', '1.2M', '234 games')}
            </div>
        </section>
    `;
}

// Render Creator Card
function renderCreatorCard(name, followers, games) {
    return `
        <div class="game-card" style="padding: 20px; text-align: center;">
            <div class="user-avatar" style="width: 80px; height: 80px; font-size: 32px; margin: 0 auto 16px;">${name.charAt(0)}</div>
            <h3 class="game-title">${name}</h3>
            <p style="color: var(--text-secondary); font-size: 14px;">${followers} followers</p>
            <p style="color: var(--text-secondary); font-size: 13px;">${games}</p>
        </div>
    `;
}

// Render Login Page - Roblox 2021 Style
function renderLoginPage(container) {
    container.innerHTML = `
        <div id="login-container" class="login-container">
            <div id="login-base">
                <div class="section-content login-section">
                    <h2 class="login-header">Login to QUANTA</h2>
                    
                    <div class="login-form-container">
                        <div class="sg-system-feedback">
                            <div class="alert-system-feedback">
                                <div class="alert"></div>
                            </div>
                        </div>
                        
                        <form class="login-form" id="login-form" onsubmit="handleLogin(event)">
                            <div class="form-group username-form-group">
                                <input type="text" id="login-username" class="form-control input-field" placeholder="Username/Email/Phone" required autocomplete="username">
                            </div>
                            <div class="form-group password-form-group">
                                <input type="password" id="login-password" class="form-control input-field" placeholder="Password" required autocomplete="current-password">
                                <p class="form-control-label xsmall text-error login-error" id="login-error"></p>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="login-button" id="login-button">
                                    <span>Log In</span>
                                </button>
                            </div>
                            <div class="spinner spinner-sm spinner-no-margin" id="login-spinner" style="display: none;"></div>
                            
                            <div class="forgot-credentials-link">
                                <a href="#" class="text-link">Forgot Password or Username?</a>
                            </div>
                        </form>
                        
                        <div class="fb-divider-container">
                            <div class="rbx-divider fb-divider"></div>
                            <div class="divider-text-container">
                                <span class="divider-text xsmall">login with your</span>
                            </div>
                        </div>
                        
                        <button class="cross-device-login-button" onclick="showToast('Quick Log In feature coming soon!')">
                            <span>Quick Log In</span>
                        </button>
                        
                        <button class="fb-button social-login" onclick="showToast('Facebook login coming soon!')">
                            <span class="fb-icon"></span>
                            <span>Facebook</span>
                        </button>
                    </div>
                    
                    <div class="signup-link" style="margin-top: 20px; text-align: center; font-size: 13px; color: #6c6c6c;">
                        Don't have an account? <a href="#signup">Sign up</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Render Signup Page
function renderSignupPage(container) {
    container.innerHTML = `
        <div class="login-page">
            <div class="login-container">
                <div class="login-header">
                    <div class="icon-logo" style="width: 60px; height: 60px; font-size: 30px; margin: 0 auto 20px;">Q</div>
                    <h2>Join QUANTA</h2>
                    <p>Create your free account</p>
                </div>
                
                <form class="login-form" id="signup-form" onsubmit="handleSignup(event)">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="signup-username" placeholder="Create a username" required minlength="3">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="signup-password" placeholder="Create a password" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label>Confirm Password</label>
                        <input type="password" id="signup-confirm" placeholder="Confirm your password" required>
                    </div>
                    <div class="form-group">
                        <label>Birthday</label>
                        <input type="date" id="signup-birthday" required>
                    </div>
                    <button type="submit" class="btn-login">Sign Up</button>
                </form>
                
                <div class="signup-link">
                    Already have an account? <a href="#login">Log in</a>
                </div>
            </div>
        </div>
    `;
}

// Render Profile Page
function renderProfilePage(container) {
    if (!QuantaApp.isLoggedIn) {
        loadPage('login');
        return;
    }
    
    container.innerHTML = `
        <div class="page-header">
            <div style="display: flex; align-items: center; gap: 30px;">
                <div class="user-avatar" style="width: 120px; height: 120px; font-size: 48px;">
                    ${QuantaApp.user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h1 style="font-size: 36px;">${QuantaApp.user.username}</h1>
                    <p style="color: var(--text-secondary);">Member since ${new Date().getFullYear()}</p>
                    <div style="display: flex; gap: 20px; margin-top: 10px;">
                        <span><strong>1.2K</strong> Friends</span>
                        <span><strong>5</strong> Games Created</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="tabs">
            <button class="tab active">My Games</button>
            <button class="tab">My Items</button>
            <button class="tab">Friends</button>
            <button class="tab">Inventory</button>
        </div>
        
        <div class="game-grid">
            ${QuantaApp.games.slice(0, 4).map(game => renderGameCard(game)).join('')}
        </div>
    `;
}

// Render Game Card
function renderGameCard(game) {
    return `
        <div class="game-card" onclick="playGame(${game.id})">
            <div class="game-thumbnail">
                <img src="${game.thumbnail}" alt="${game.title}" loading="lazy">
                <div class="game-overlay">
                    <button class="play-btn">▶ Play</button>
                </div>
            </div>
            <div class="game-info">
                <h3 class="game-title">${game.title}</h3>
                <div class="game-meta">
                    <span class="game-players">👥 ${formatNumber(game.players)}</span>
                    <span class="game-genre">${game.genre}</span>
                </div>
            </div>
        </div>
    `;
}

// Render Item Card
function renderItemCard(item) {
    return `
        <div class="item-card" onclick="viewItem(${item.id})">
            <div class="item-thumbnail">
                <img src="${item.thumbnail}" alt="${item.title}" loading="lazy">
                <div class="item-price">
                    <span class="robux-icon" style="width: 16px; height: 16px; font-size: 10px;">Q</span>
                    ${formatNumber(item.price)}
                </div>
            </div>
            <div class="item-info">
                <h3 class="item-title">${item.title}</h3>
                <p class="item-category">${item.category}</p>
            </div>
        </div>
    `;
}

// Format Number
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Play Game
function playGame(gameId) {
    const game = QuantaApp.games.find(g => g.id === gameId);
    if (game) {
        showToast(`Launching ${game.title}...`);
        setTimeout(() => {
            showToast('Game would launch in QUANTA Player!');
        }, 1500);
    }
}

// View Item
function viewItem(itemId) {
    const item = QuantaApp.catalog.find(i => i.id === itemId);
    if (item) {
        showModal(item.title, `
            <div style="text-align: center;">
                <img src="${item.thumbnail}" alt="${item.title}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 20px;">
                <h2 style="margin-bottom: 10px;">${item.title}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">${item.category}</p>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 24px;">
                    <span class="robux-icon" style="width: 28px; height: 28px; font-size: 14px;">Q</span>
                    <span style="font-size: 28px; font-weight: 900; color: var(--accent);">${formatNumber(item.price)}</span>
                </div>
                <button class="btn-login" onclick="purchaseItem(${item.id})">Purchase</button>
            </div>
        `);
    }
}

// Purchase Item
function purchaseItem(itemId) {
    const item = QuantaApp.catalog.find(i => i.id === itemId);
    if (item) {
        closeModal();
        showToast(`Purchased ${item.title}!`);
    }
}

// Show Modal
function showModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal';
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Close Modal
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.remove();
    }
}

// Show Toast
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Handle Login
function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const loginButton = document.getElementById('login-button');
    const spinner = document.getElementById('login-spinner');
    const errorEl = document.getElementById('login-error');
    
    // Clear previous error
    if (errorEl) errorEl.textContent = '';
    
    // Show loading state
    if (loginButton) {
        loginButton.disabled = true;
        loginButton.innerHTML = '<span>Logging in...</span>';
    }
    if (spinner) spinner.style.display = 'block';
    
    // Simulate login with delay
    setTimeout(() => {
        // Basic validation
        if (!username || !password) {
            if (errorEl) errorEl.textContent = 'Please enter your username and password.';
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.innerHTML = '<span>Log In</span>';
            }
            if (spinner) spinner.style.display = 'none';
            return;
        }
        
        if (password.length < 6) {
            if (errorEl) errorEl.textContent = 'Password must be at least 6 characters.';
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.innerHTML = '<span>Log In</span>';
            }
            if (spinner) spinner.style.display = 'none';
            return;
        }
        
        // Simulate successful login
        QuantaApp.user = {
            username: username,
            robux: 1500,
            email: `${username}@quanta.com`
        };
        QuantaApp.isLoggedIn = true;
        
        localStorage.setItem('quanta_user', JSON.stringify(QuantaApp.user));
        
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.innerHTML = '<span>Log In</span>';
        }
        if (spinner) spinner.style.display = 'none';
        
        showToast('Login successful!');
        renderNavigation();
        loadPage('home');
    }, 1500);
}

// Handle Signup
function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    
    if (password !== confirm) {
        showToast('Passwords do not match!');
        return;
    }
    
    // Simulate signup
    QuantaApp.user = {
        username: username,
        robux: 100,
        email: `${username}@quanta.com`
    };
    QuantaApp.isLoggedIn = true;
    
    localStorage.setItem('quanta_user', JSON.stringify(QuantaApp.user));
    
    showToast('Account created successfully!');
    renderNavigation();
    loadPage('home');
}

// Logout
function logout() {
    QuantaApp.user = null;
    QuantaApp.isLoggedIn = false;
    localStorage.removeItem('quanta_user');
    showToast('Logged out successfully!');
    renderNavigation();
    loadPage('home');
}

// Filter Games
function filterGames(filter) {
    const tabs = document.querySelectorAll('.tabs .tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    // Simulate filtering
    showToast(`Showing ${filter} games...`);
}

// Setup Event Listeners
function setupEventListeners() {
    // Handle hash changes
    window.addEventListener('hashchange', () => {
        loadPage(getCurrentPageFromURL());
        renderNavigation();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-dropdown');
        const avatar = document.querySelector('.user-avatar');
        if (dropdown && avatar && !avatar.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initApp);

// Render Footer
function renderFooter() {
    const footer = document.getElementById('footer');
    if (footer) {
        footer.innerHTML = `
            <div class="footer-content">
                <div class="footer-links">
                    <a href="#">About Us</a>
                    <a href="#">Jobs</a>
                    <a href="#">Blog</a>
                    <a href="#">Parents</a>
                    <a href="#">Help</a>
                    <a href="#">Terms</a>
                    <a href="#">Privacy</a>
                </div>
                <p class="footer-copyright">©${new Date().getFullYear()} QUANTA Corporation. All rights reserved.</p>
            </div>
        `;
    }
}
