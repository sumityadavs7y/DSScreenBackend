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
    
    // Generate a unique device fingerprint (hardware-based, survives cache clearing)
    console.log('Generating device fingerprint...');
    const uid = await generateDeviceUID();
    console.log('Device UID:', uid);
    
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

/**
 * Generate a TRUE hardware-based device fingerprint
 * 
 * This uses multiple advanced techniques to create a unique identifier:
 * 1. Canvas fingerprinting (GPU/driver specific rendering)
 * 2. WebGL fingerprinting (GPU vendor/model)  
 * 3. Audio context fingerprinting (audio hardware differences)
 * 4. Screen/hardware characteristics
 * 5. Font detection
 * 
 * Result: Same physical device = Same UID (even if cache cleared or VPN used)
 * 
 * Format: FP-{12-char-hash}
 * Example: FP-A7F2E1B9C4D3
 */
async function generateDeviceUID() {
    // Check localStorage first (for performance)
    let uid = localStorage.getItem('deviceUID');
    if (uid && uid.startsWith('FP-')) {
        console.log('Using cached fingerprint UID');
        return uid;
    }
    
    console.log('Generating new hardware fingerprint...');
    
    // Generate comprehensive fingerprint
    const fingerprint = await generateComprehensiveFingerprint();
    uid = 'FP-' + fingerprint;
    
    // Cache it (but fingerprint will be same even if this is cleared)
        localStorage.setItem('deviceUID', uid);
    
    return uid;
}

/**
 * Generate comprehensive device fingerprint combining multiple techniques
 */
async function generateComprehensiveFingerprint() {
    const components = [];
    
    // 1. Basic hardware characteristics
    components.push(navigator.userAgent);
    components.push(navigator.language);
    components.push(navigator.platform);
    components.push(navigator.hardwareConcurrency || 0);
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    components.push(screen.pixelDepth);
    components.push(new Date().getTimezoneOffset());
    components.push(navigator.maxTouchPoints || 0);
    components.push(navigator.deviceMemory || 'unknown');
    
    // 2. Canvas fingerprint (GPU/driver rendering differences)
    const canvasFP = getCanvasFingerprint();
    components.push(canvasFP);
    
    // 3. WebGL fingerprint (GPU vendor/renderer)
    const webglFP = getWebGLFingerprint();
    components.push(webglFP);
    
    // 4. Audio context fingerprint
    const audioFP = await getAudioFingerprint();
    components.push(audioFP);
    
    // 5. Font detection
    const fontsFP = detectInstalledFonts();
    components.push(fontsFP);
    
    // 6. Browser capabilities
    components.push(navigator.plugins.length);
    components.push(navigator.cookieEnabled);
    components.push(typeof window.openDatabase);
    components.push(typeof navigator.serviceWorker);
    
    // Combine and hash
    const combined = components.join('|||');
    const hash = await hashFingerprint(combined);
    
    console.log('Fingerprint components:', components.length);
    return hash;
}

/**
 * Canvas fingerprinting - exploits tiny pixel-level rendering differences
 * between different GPUs/drivers
 */
function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        
        // Draw complex shapes and text
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Device Fingerprint 🔒📱', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Canvas FP', 4, 17);
        
        // Get base64 data
        return canvas.toDataURL().substring(0, 100); // First 100 chars
    } catch (e) {
        return 'canvas-error';
    }
}

/**
 * WebGL fingerprinting - gets GPU vendor and renderer model
 */
function getWebGLFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) return 'no-webgl';
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return 'no-debug-renderer';
        
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        
        return `${vendor}|${renderer}`;
    } catch (e) {
        return 'webgl-error';
    }
}

/**
 * Audio context fingerprinting - audio hardware produces slightly different outputs
 */
function getAudioFingerprint() {
    return new Promise((resolve) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                resolve('no-audio-context');
                return;
            }
            
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const analyser = context.createAnalyser();
            const gainNode = context.createGain();
            const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
            
            gainNode.gain.value = 0; // Mute (don't play sound)
            oscillator.type = 'triangle';
            oscillator.frequency.value = 10000;
            
            oscillator.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(gainNode);
            gainNode.connect(context.destination);
            
            scriptProcessor.onaudioprocess = function(event) {
                const output = event.outputBuffer.getChannelData(0);
                const sum = Array.from(output.slice(0, 30)).reduce((acc, val) => acc + Math.abs(val), 0);
                
                oscillator.disconnect();
                scriptProcessor.disconnect();
                context.close();
                
                resolve(sum.toFixed(6));
            };
            
            oscillator.start(0);
            
            setTimeout(() => {
                try { context.close(); } catch(e) {}
                resolve('audio-timeout');
            }, 500);
        } catch (e) {
            resolve('audio-error');
        }
    });
}

/**
 * Detect installed fonts by measuring text width
 */
function detectInstalledFonts() {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
        'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
        'Palatino', 'Garamond', 'Comic Sans MS', 'Trebuchet MS', 'Impact',
        'Calibri', 'Cambria', 'Consolas', 'Tahoma', 'Monaco'
    ];
    
    const testString = 'mmMwWLliI0O&*%$#@!()';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Measure base font widths
    const baseWidths = {};
    baseFonts.forEach(font => {
        ctx.font = '72px ' + font;
        baseWidths[font] = ctx.measureText(testString).width;
    });
    
    // Detect which fonts are installed
    const installedFonts = [];
    testFonts.forEach(font => {
        let detected = false;
        baseFonts.forEach(baseFont => {
            ctx.font = `72px '${font}', ${baseFont}`;
            const width = ctx.measureText(testString).width;
            if (width !== baseWidths[baseFont]) {
                detected = true;
            }
        });
        if (detected) {
            installedFonts.push(font);
        }
    });
    
    return installedFonts.join(',');
}

/**
 * Hash the fingerprint string using SHA-256
 */
async function hashFingerprint(str) {
    // Try modern Crypto API first
    if (window.crypto && window.crypto.subtle) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex.substring(0, 12).toUpperCase();
        } catch (e) {
            console.warn('Crypto API failed, using fallback hash');
        }
    }
    
    // Fallback: MurmurHash3
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (Math.abs(hash) >>> 0).toString(16).padStart(12, '0').substring(0, 12).toUpperCase();
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

