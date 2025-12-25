// Company Selection JavaScript (Session-based)

const alert = document.getElementById('alert');
const companyGrid = document.getElementById('companyGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const userName = document.getElementById('userName');

// Get user data from localStorage (for display only)
const userData = JSON.parse(localStorage.getItem('userData') || '{}');
const userCompanies = JSON.parse(localStorage.getItem('userCompanies') || '[]');

// Check if user data exists (they should have just logged in)
if (!userData.firstName) {
    // No user data, check with server
    checkAuthStatus();
} else {
    // Display user name
    userName.textContent = `${userData.firstName} ${userData.lastName}`;
    loadCompanies();
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            // Not authenticated, redirect to login
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        if (data.success && data.data.user) {
            localStorage.setItem('userData', JSON.stringify(data.data.user));
            userName.textContent = `${data.data.user.firstName} ${data.data.user.lastName}`;
            
            // If user already has company selected, redirect to dashboard
            if (data.data.company) {
                window.location.href = '/dashboard.html';
                return;
            }
            
            // Load companies
            loadCompaniesFromServer();
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
}

async function loadCompaniesFromServer() {
    try {
        const response = await fetch('/api/auth/companies', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            showEmptyState();
            return;
        }
        
        const data = await response.json();
        if (data.success && data.data.companies) {
            localStorage.setItem('userCompanies', JSON.stringify(data.data.companies));
            renderCompanies(data.data.companies);
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error('Load companies error:', error);
        showEmptyState();
    }
}

function loadCompanies() {
    if (!userCompanies || userCompanies.length === 0) {
        loadCompaniesFromServer();
        return;
    }
    
    renderCompanies(userCompanies);
}

function renderCompanies(companies) {
    // Hide loading, show grid
    loadingState.style.display = 'none';
    companyGrid.style.display = 'grid';
    companyGrid.innerHTML = '';
    
    // Render companies
    companies.forEach(company => {
        const card = createCompanyCard(company);
        companyGrid.appendChild(card);
    });
}

function createCompanyCard(company) {
    const card = document.createElement('div');
    card.className = 'company-card';
    card.onclick = () => selectCompany(company.id);
    
    // Get company initials
    const initials = company.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    
    card.innerHTML = `
        <div class="company-logo">${initials}</div>
        <h3 class="company-name">${escapeHtml(company.name)}</h3>
        <p class="company-role">${escapeHtml(company.role)}</p>
    `;
    
    return card;
}

async function selectCompany(companyId) {
    // Show loading overlay on all cards
    const cards = document.querySelectorAll('.company-card');
    cards.forEach(card => card.style.opacity = '0.5');
    
    try {
        const response = await fetch('/api/auth/select-company', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Important: Include cookies
            body: JSON.stringify({ companyId })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Store company info in localStorage for display purposes
            localStorage.setItem('companyData', JSON.stringify(data.data.company));
            localStorage.setItem('userRole', data.data.role);
            
            showAlert('Company selected! Redirecting...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showAlert(data.message || 'Failed to select company. Please try again.', 'error');
            cards.forEach(card => card.style.opacity = '1');
        }
    } catch (error) {
        console.error('Company selection error:', error);
        showAlert('Network error. Please try again.', 'error');
        cards.forEach(card => card.style.opacity = '1');
    }
}

function showEmptyState() {
    loadingState.style.display = 'none';
    companyGrid.style.display = 'none';
    emptyState.style.display = 'block';
}

function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    
    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
