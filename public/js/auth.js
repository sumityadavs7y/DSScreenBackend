// Authentication JavaScript (Session-based)

const alert = document.getElementById('alert');

// Check which page we're on
const isLoginPage = document.getElementById('loginForm') !== null;
const isRegisterPage = document.getElementById('registerForm') !== null;

// Login Form Handler
if (isLoginPage) {
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        // Basic validation
        if (!email || !password) {
            showAlert('Please fill in all fields', 'error');
            return;
        }
        
        // Show loading
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const originalText = btnText.textContent;
        btnText.innerHTML = '<span class="spinner"></span> Logging in...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Important: Include cookies
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Store user info in localStorage for display purposes only
                localStorage.setItem('userData', JSON.stringify(data.data.user));
                localStorage.setItem('userCompanies', JSON.stringify(data.data.companies));
                
                showAlert('Login successful! Redirecting...', 'success');
                
                // Redirect to company selection
                setTimeout(() => {
                    window.location.href = '/company-selection';
                }, 1000);
            } else {
                showAlert(data.message || 'Login failed. Please check your credentials.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('Network error. Please try again.', 'error');
        } finally {
            btnText.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Register Form Handler
if (isRegisterPage) {
    const registerForm = document.getElementById('registerForm');
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const companyName = document.getElementById('companyName').value.trim();
        const companyDescription = document.getElementById('companyDescription').value.trim();
        
        // Validation
        if (!firstName || !lastName || !email || !password || !companyName) {
            showAlert('Please fill in all required fields', 'error');
            return;
        }
        
        if (password.length < 8) {
            showAlert('Password must be at least 8 characters', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showAlert('Passwords do not match', 'error');
            return;
        }
        
        // Show loading
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const originalText = btnText.textContent;
        btnText.innerHTML = '<span class="spinner"></span> Creating account...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Important: Include cookies
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    phoneNumber: phoneNumber || undefined,
                    password,
                    companyName,
                    companyDescription: companyDescription || undefined
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Store user info in localStorage for display purposes only
                localStorage.setItem('userData', JSON.stringify(data.data.user));
                
                // Create companies array with the newly created company
                const companies = [{
                    id: data.data.company.id,
                    name: data.data.company.name,
                    slug: data.data.company.slug,
                    role: 'owner'
                }];
                localStorage.setItem('userCompanies', JSON.stringify(companies));
                
                showAlert('Account created successfully! Redirecting...', 'success');
                
                // Redirect to company selection
                setTimeout(() => {
                    window.location.href = '/company-selection';
                }, 1000);
            } else {
                showAlert(data.message || 'Registration failed. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showAlert('Network error. Please try again.', 'error');
        } finally {
            btnText.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Helper Functions

function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);
}
