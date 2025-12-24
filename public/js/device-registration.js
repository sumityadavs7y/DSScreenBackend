// Device Registration JavaScript

// Check if device is already registered
const existingRegistration = localStorage.getItem('devicePlaylistRegistration');
if (existingRegistration) {
    try {
        const data = JSON.parse(existingRegistration);
        // Verify the data is valid
        if (data.device && data.playlist) {
            console.log('Device already registered, redirecting to player...');
            window.location.href = '/device-player.html';
        }
    } catch (e) {
        // Invalid data, clear it
        localStorage.removeItem('devicePlaylistRegistration');
    }
}

// Get all code inputs
const codeInputs = document.querySelectorAll('.code-input');
const deviceForm = document.getElementById('deviceForm');
const alert = document.getElementById('alert');

// Auto-focus and navigation between inputs
codeInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        const value = e.target.value;
        
        // Move to next input if value entered
        if (value && index < codeInputs.length - 1) {
            codeInputs[index + 1].focus();
        }
    });
    
    input.addEventListener('keydown', (e) => {
        // Move to previous input on backspace if empty
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            codeInputs[index - 1].focus();
        }
        
        // Move to next input on arrow right
        if (e.key === 'ArrowRight' && index < codeInputs.length - 1) {
            codeInputs[index + 1].focus();
        }
        
        // Move to previous input on arrow left
        if (e.key === 'ArrowLeft' && index > 0) {
            codeInputs[index - 1].focus();
        }
    });
    
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 5);
        pastedData.split('').forEach((char, i) => {
            if (codeInputs[i]) {
                codeInputs[i].value = char;
            }
        });
        // Focus last input or next empty
        const lastIndex = Math.min(pastedData.length, codeInputs.length - 1);
        codeInputs[lastIndex].focus();
    });
});

// Auto-focus first input
codeInputs[0].focus();

// Handle form submission
deviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get playlist code from inputs
    const playlistCode = Array.from(codeInputs).map(input => input.value).join('');
    
    // Validate code
    if (playlistCode.length !== 5) {
        showAlert('Please enter a complete 5-character playlist code', 'error');
        return;
    }
    
    // Generate a unique device ID (in production, this would be MAC address, serial number, etc.)
    const uid = generateDeviceUID();
    
    // Get device info
    const deviceInfo = getDeviceInfo();
    
    // Show loading
    const submitBtn = deviceForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registering...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/playlists/device/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playlistCode,
                uid,
                deviceInfo
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAlert(`Device registered successfully! Redirecting...`, 'success');
            
            // Store device info with full data
            localStorage.setItem('devicePlaylistRegistration', JSON.stringify({
                playlistCode,
                uid,
                device: data.data.device,
                playlist: data.data.playlist,
                deviceInfo: deviceInfo,
                registeredAt: new Date().toISOString()
            }));
            
            // Redirect to player page
            setTimeout(() => {
                window.location.href = '/device-player.html';
            }, 1000);
        } else {
            showAlert(data.message || 'Registration failed. Please check your code.', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('Network error. Please check your connection and try again.', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// Helper Functions

function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);
}

function generateDeviceUID() {
    // In production, use actual device identifiers
    // For demo purposes, generate a unique ID and store it
    let uid = localStorage.getItem('deviceUID');
    if (!uid) {
        uid = 'DEVICE-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('deviceUID', uid);
    }
    return uid;
}

function getDeviceInfo() {
    return {
        resolution: `${window.screen.width}x${window.screen.height}`,
        browser: navigator.userAgent,
        platform: navigator.platform,
        timestamp: new Date().toISOString(),
        location: 'Web Browser' // Could be set by user in production
    };
}

