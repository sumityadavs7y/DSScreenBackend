/**
 * Toast Notification System - JavaScript
 * Modular JavaScript for website-wide toast notifications
 * 
 * Usage:
 * 1. Include this script in your HTML:
 *    <script src="/js/toast.js"></script>
 * 
 * 2. Add toast container to your HTML (usually after <body>):
 *    <div class="toast-container" id="toastContainer"></div>
 * 
 * 3. Show notifications:
 *    Toast.success('Operation completed!');
 *    Toast.error('Something went wrong!');
 *    Toast.info('Processing...');
 *    Toast.warning('Please check your input');
 * 
 * 4. Custom options:
 *    Toast.show('Custom message', 'success', 5000);
 */

const Toast = (function() {
    'use strict';

    // Configuration
    const config = {
        duration: {
            success: 4000,
            error: 6000,
            info: 4000,
            warning: 5000
        },
        icons: {
            success: 'bi-check-circle-fill',
            error: 'bi-exclamation-circle-fill',
            info: 'bi-info-circle-fill',
            warning: 'bi-exclamation-triangle-fill'
        },
        titles: {
            success: 'Success',
            error: 'Error',
            info: 'Info',
            warning: 'Warning'
        }
    };

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type of toast: 'success', 'error', 'info', 'warning'
     * @param {number} duration - Duration in milliseconds (optional)
     * @param {string} title - Custom title (optional)
     */
    function show(message, type = 'info', duration = null, title = null) {
        // Get or create container
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Validate type
        if (!['success', 'error', 'info', 'warning'].includes(type)) {
            console.warn(`Invalid toast type: ${type}. Defaulting to 'info'.`);
            type = 'info';
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        
        // Use default duration if not provided
        const toastDuration = duration || config.duration[type];
        
        // Use default title if not provided
        const toastTitle = title || config.titles[type];
        
        // Build toast HTML
        toast.innerHTML = `
            <i class="bi ${config.icons[type]} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${escapeHtml(toastTitle)}</div>
                <p class="toast-message">${escapeHtml(message)}</p>
            </div>
            <button class="toast-close" aria-label="Close notification">&times;</button>
        `;
        
        // Add close event listener
        const closeButton = toast.querySelector('.toast-close');
        closeButton.addEventListener('click', function() {
            close(toast);
        });

        // Add to container
        container.appendChild(toast);
        
        // Auto dismiss after duration
        setTimeout(() => {
            close(toast);
        }, toastDuration);

        return toast;
    }

    /**
     * Close a toast notification
     * @param {HTMLElement} toast - The toast element to close
     */
    function close(toast) {
        if (!toast || !toast.classList) return;
        
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    /**
     * Show success toast
     * @param {string} message - The message to display
     * @param {number} duration - Duration in milliseconds (optional)
     */
    function success(message, duration = null) {
        return show(message, 'success', duration);
    }

    /**
     * Show error toast
     * @param {string} message - The message to display
     * @param {number} duration - Duration in milliseconds (optional)
     */
    function error(message, duration = null) {
        return show(message, 'error', duration);
    }

    /**
     * Show info toast
     * @param {string} message - The message to display
     * @param {number} duration - Duration in milliseconds (optional)
     */
    function info(message, duration = null) {
        return show(message, 'info', duration);
    }

    /**
     * Show warning toast
     * @param {string} message - The message to display
     * @param {number} duration - Duration in milliseconds (optional)
     */
    function warning(message, duration = null) {
        return show(message, 'warning', duration);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Check URL parameters for success/error messages
     * Automatically shows toast and cleans URL
     */
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const successMsg = urlParams.get('success');
        const errorMsg = urlParams.get('error');
        const infoMsg = urlParams.get('info');
        const warningMsg = urlParams.get('warning');
        
        if (successMsg) {
            success(decodeURIComponent(successMsg));
            cleanUrl(urlParams);
        }
        
        if (errorMsg) {
            error(decodeURIComponent(errorMsg));
            cleanUrl(urlParams);
        }
        
        if (infoMsg) {
            info(decodeURIComponent(infoMsg));
            cleanUrl(urlParams);
        }
        
        if (warningMsg) {
            warning(decodeURIComponent(warningMsg));
            cleanUrl(urlParams);
        }
    }

    /**
     * Clean URL by removing toast-related parameters
     * @param {URLSearchParams} urlParams - URL parameters
     */
    function cleanUrl(urlParams) {
        urlParams.delete('success');
        urlParams.delete('error');
        urlParams.delete('info');
        urlParams.delete('warning');
        
        const newUrl = urlParams.toString() 
            ? `${window.location.pathname}?${urlParams.toString()}`
            : window.location.pathname;
        
        window.history.replaceState({}, document.title, newUrl);
    }

    /**
     * Clear all active toasts
     */
    function clearAll() {
        const container = document.getElementById('toastContainer');
        if (container) {
            const toasts = container.querySelectorAll('.toast-notification');
            toasts.forEach(toast => close(toast));
        }
    }

    // Auto-initialize on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkUrlParams);
    } else {
        checkUrlParams();
    }

    // Public API
    return {
        show: show,
        success: success,
        error: error,
        info: info,
        warning: warning,
        close: close,
        clearAll: clearAll,
        checkUrlParams: checkUrlParams
    };
})();

// Make Toast available globally
if (typeof window !== 'undefined') {
    window.Toast = Toast;
}

