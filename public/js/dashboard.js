// Dashboard JavaScript (Session-based)

const alert = document.getElementById('alert');
const userNameEl = document.getElementById('userName');
const companyNameEl = document.getElementById('companyName');
const logoutBtn = document.getElementById('logoutBtn');

// Get user and company data from localStorage (for display only)
let userData = JSON.parse(localStorage.getItem('userData') || '{}');
let companyData = JSON.parse(localStorage.getItem('companyData') || '{}');
let userRole = localStorage.getItem('userRole');

// Check authentication status with server
checkAuthStatus();

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            // Not authenticated, redirect to login
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        if (data.success && data.data.user) {
            userData = data.data.user;
            localStorage.setItem('userData', JSON.stringify(userData));
            
            // Check if company is selected
            if (!data.data.company) {
                // No company selected, redirect to company selection
                window.location.href = '/company-selection.html';
                return;
            }
            
            companyData = data.data.company;
            userRole = data.data.role;
            localStorage.setItem('companyData', JSON.stringify(companyData));
            localStorage.setItem('userRole', userRole);
            
            // Display user info
            displayUserInfo();
        } else {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
}

function displayUserInfo() {
    if (userData.firstName) {
        userNameEl.textContent = `${userData.firstName} ${userData.lastName}`;
    }
    
    if (companyData.name) {
        companyNameEl.textContent = `${companyData.name} • ${userRole || 'User'}`;
    }
}

// Tab switching
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Remove active class from all tabs and contents
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        tab.classList.add('active');
        document.getElementById(tabName).classList.add('active');
    });
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
    const originalText = logoutBtn.textContent;
    logoutBtn.innerHTML = '<span class="spinner"></span>';
    logoutBtn.disabled = true;
    
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Clear all stored data
        localStorage.removeItem('userData');
        localStorage.removeItem('companyData');
        localStorage.removeItem('userCompanies');
        localStorage.removeItem('userRole');
        
        // Redirect to login
        window.location.href = '/login.html';
    }
});

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include' // Important: Always include cookies
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(endpoint, mergedOptions);
        const data = await response.json();
        
        // Handle unauthorized
        if (response.status === 401) {
            showAlert('Session expired. Please login again.', 'error');
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/login.html';
            }, 2000);
            return null;
        }
        
        return { response, data };
    } catch (error) {
        console.error('API call error:', error);
        showAlert('Network error. Please try again.', 'error');
        return null;
    }
}

function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    
    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);
}

// Export for use in future modules
window.dashboardAPI = {
    apiCall,
    showAlert
};
