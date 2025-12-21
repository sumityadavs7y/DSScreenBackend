# Toast Notification System - Usage Guide

## 📦 Modular & Website-Wide

A fully modular, reusable toast notification system that can be used across your entire website.

---

## 🚀 Quick Start

### Step 1: Include Files in Your HTML

```html
<!DOCTYPE html>
<html>
<head>
    <!-- Other head content -->
    <link rel="stylesheet" href="/css/toast.css">
</head>
<body>
    <!-- Your page content -->
    
    <!-- Toast Container (required) -->
    <div class="toast-container" id="toastContainer"></div>
    
    <!-- Scripts at end of body -->
    <script src="/js/toast.js"></script>
</body>
</html>
```

### Step 2: Show Notifications

```javascript
// Success notification
Toast.success('Operation completed successfully!');

// Error notification
Toast.error('Something went wrong!');

// Info notification
Toast.info('Processing your request...');

// Warning notification
Toast.warning('Please check your input.');
```

That's it! 🎉

---

## 📁 File Structure

```
public/
├── css/
│   └── toast.css          ← Toast styles
└── js/
    └── toast.js           ← Toast functionality
```

---

## 🎯 Complete Integration Examples

### Example 1: EJS Template (Server-Rendered)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Page</title>
    <link rel="stylesheet" href="/css/bootstrap.min.css">
    <link rel="stylesheet" href="/css/toast.css">
</head>
<body>
    <!-- Toast Container -->
    <div class="toast-container" id="toastContainer"></div>
    
    <h1>My Page</h1>
    
    <!-- Scripts -->
    <script src="/js/bootstrap.bundle.min.js"></script>
    <script src="/js/toast.js"></script>
    
    <script>
        // Show notification on page load (optional)
        document.addEventListener('DOMContentLoaded', function() {
            Toast.info('Welcome to the page!');
        });
    </script>
</body>
</html>
```

### Example 2: Static HTML

```html
<!DOCTYPE html>
<html>
<head>
    <title>Static Page</title>
    <link rel="stylesheet" href="/css/toast.css">
</head>
<body>
    <div class="toast-container" id="toastContainer"></div>
    
    <button onclick="Toast.success('Button clicked!')">
        Click Me
    </button>
    
    <script src="/js/toast.js"></script>
</body>
</html>
```

### Example 3: With Form Submission

```html
<form id="myForm">
    <input type="text" name="name" required>
    <button type="submit">Submit</button>
</form>

<script src="/js/toast.js"></script>
<script>
document.getElementById('myForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    Toast.info('Submitting form...');
    
    try {
        const response = await fetch('/api/submit', {
            method: 'POST',
            body: new FormData(this)
        });
        
        if (response.ok) {
            Toast.success('Form submitted successfully!');
        } else {
            Toast.error('Failed to submit form.');
        }
    } catch (error) {
        Toast.error('Network error occurred.');
    }
});
</script>
```

---

## 🎨 API Reference

### Basic Methods

#### `Toast.success(message, duration)`
Shows a success notification (green)

```javascript
Toast.success('Video uploaded successfully!');
Toast.success('Saved!', 3000); // Custom duration
```

#### `Toast.error(message, duration)`
Shows an error notification (red)

```javascript
Toast.error('Failed to delete file.');
Toast.error('Network error!', 8000); // Longer duration for errors
```

#### `Toast.info(message, duration)`
Shows an info notification (blue)

```javascript
Toast.info('Processing your request...');
Toast.info('Loading...', 2000);
```

#### `Toast.warning(message, duration)`
Shows a warning notification (yellow)

```javascript
Toast.warning('File size is too large.');
Toast.warning('Please save your work.', 5000);
```

### Advanced Methods

#### `Toast.show(message, type, duration, title)`
Shows a custom notification with all options

```javascript
Toast.show('Custom message', 'success', 5000, 'Custom Title');
Toast.show('Processing', 'info', 10000, 'Please Wait');
```

#### `Toast.clearAll()`
Closes all active notifications

```javascript
Toast.clearAll();
```

#### `Toast.close(toastElement)`
Closes a specific notification

```javascript
const toast = Toast.success('Processing...');
// Later:
Toast.close(toast);
```

---

## ⚙️ Configuration

### Default Durations

```javascript
Success: 4000ms (4 seconds)
Error:   6000ms (6 seconds)
Info:    4000ms (4 seconds)
Warning: 5000ms (5 seconds)
```

### Custom Durations

```javascript
// Short notification
Toast.success('Done!', 2000);

// Long notification
Toast.error('Check the details...', 10000);

// Permanent (no auto-dismiss)
Toast.info('Connecting...', Infinity);
```

---

## 🔗 Backend Integration

### URL Parameter Support (Automatic)

The toast system **automatically** detects URL parameters and shows notifications:

#### Backend (No changes needed!)

```javascript
// Express/Node.js
res.redirect('/dashboard?success=Video uploaded successfully!');
res.redirect('/dashboard?error=Upload failed');
res.redirect('/dashboard?info=Processing...');
res.redirect('/dashboard?warning=File too large');
```

#### Frontend (Automatic!)

The toast system will:
1. ✅ Detect the URL parameter
2. ✅ Show the appropriate toast
3. ✅ **Clean the URL** (removes the parameter)

**Before:** `/dashboard?success=Video%20uploaded%20successfully!`  
**After:** `/dashboard` (clean URL!)

---

## 🎨 Styling & Customization

### Default Colors

- Success: `#28a745` (Green)
- Error: `#dc3545` (Red)
- Info: `#17a2b8` (Blue)
- Warning: `#ffc107` (Yellow)

### Customizing Colors

Edit `/public/css/toast.css`:

```css
.toast-notification.success {
    border-left-color: #your-color;
}

.toast-notification.success .toast-icon {
    color: #your-color;
}
```

### Dark Theme Support

The toast system includes automatic dark theme support:

```css
@media (prefers-color-scheme: dark) {
    .toast-notification {
        background: #2d2d2d;
        /* ... */
    }
}
```

---

## 📱 Mobile Responsive

The toast system is **fully responsive**:

- **Desktop:** Fixed width (300-400px) in top-right corner
- **Mobile:** Full width with small margins
- **Touch-friendly:** Large close button

---

## 🎓 Best Practices

### 1. Message Length
✅ Keep messages short and clear  
❌ Avoid long paragraphs

```javascript
// Good
Toast.success('Video uploaded!');

// Bad
Toast.success('Your video has been successfully uploaded to the server and will be available in your video library shortly. You can now use it in your schedules.');
```

### 2. Appropriate Duration
✅ Success: 3-4 seconds  
✅ Error: 5-6 seconds (users need more time)  
✅ Info: 2-4 seconds  
✅ Warning: 4-5 seconds

### 3. Error Details
✅ Provide actionable information  
❌ Don't show technical errors to users

```javascript
// Good
Toast.error('Unable to upload video. Please try again.');

// Bad
Toast.error('Error: ECONNREFUSED at 127.0.0.1:3000');
```

### 4. User Actions
✅ Confirm user actions  
✅ Show progress for long operations

```javascript
// After save button
Toast.success('Changes saved successfully!');

// During upload
Toast.info('Uploading... This may take a moment.');
```

---

## 🔧 Advanced Usage

### Chaining Notifications

```javascript
Toast.info('Starting process...');

setTimeout(() => {
    Toast.success('Step 1 complete!');
}, 2000);

setTimeout(() => {
    Toast.success('All done!');
}, 4000);
```

### Progress Notification

```javascript
const progressToast = Toast.info('Uploading... 0%', Infinity);

// Update (you'd need to modify the toast element)
// For now, close and show new one:
updateProgress(50); // Shows: "Uploading... 50%"

function updateProgress(percent) {
    Toast.clearAll();
    if (percent < 100) {
        Toast.info(`Uploading... ${percent}%`, Infinity);
    } else {
        Toast.success('Upload complete!');
    }
}
```

### Notification on Network Events

```javascript
window.addEventListener('online', function() {
    Toast.success('You are back online!');
});

window.addEventListener('offline', function() {
    Toast.warning('No internet connection.', Infinity);
});
```

---

## 🧪 Testing

### Test All Types

```javascript
// Test all notification types
Toast.success('Success test');
Toast.error('Error test');
Toast.info('Info test');
Toast.warning('Warning test');
```

### Test Multiple Toasts

```javascript
// Show multiple at once
Toast.success('First notification');
setTimeout(() => Toast.info('Second notification'), 500);
setTimeout(() => Toast.warning('Third notification'), 1000);
```

### Test URL Parameters

Visit: `/yourpage?success=Test success message`

---

## 📋 Checklist for New Pages

When adding toast notifications to a new page:

- [ ] Include `/css/toast.css` in `<head>`
- [ ] Add `<div class="toast-container" id="toastContainer"></div>` after `<body>`
- [ ] Include `/js/toast.js` before closing `</body>`
- [ ] Use `Toast.success()`, `Toast.error()`, etc. in your code
- [ ] Test all notification types
- [ ] Test mobile responsiveness
- [ ] Test URL parameter support (if using backend redirects)

---

## 🌟 Examples Across Website

### Login Page
```javascript
// After failed login
Toast.error('Invalid email or password.');

// After successful login
Toast.success('Welcome back!');
```

### Registration Page
```javascript
// After successful registration
Toast.success('Account created! Please log in.');

// Validation errors
Toast.error('Password must be at least 8 characters.');
```

### Dashboard
```javascript
// After video upload
Toast.success('Video uploaded successfully!');

// After video deletion
Toast.success('Video deleted.');

// Upload error
Toast.error('Upload failed. File may be too large.');
```

### Settings Page
```javascript
// After saving settings
Toast.success('Settings saved!');

// After updating profile
Toast.success('Profile updated successfully!');
```

---

## 🐛 Troubleshooting

### Toast not showing?

1. **Check CSS is loaded:**
   ```html
   <link rel="stylesheet" href="/css/toast.css">
   ```

2. **Check JS is loaded:**
   ```html
   <script src="/js/toast.js"></script>
   ```

3. **Check container exists:**
   ```html
   <div class="toast-container" id="toastContainer"></div>
   ```

4. **Check browser console for errors**

### Toast shows but disappears immediately?

- Check if duration is set too low
- Use longer duration: `Toast.success('Message', 5000)`

### Multiple toasts overlap?

- This is expected behavior (they stack)
- Use `Toast.clearAll()` before showing new one if you want only one at a time

---

## ✨ Summary

The modular toast system provides:

✅ **Easy integration** - Just 2 files and 1 line of HTML  
✅ **Website-wide** - Use on any page  
✅ **Automatic URL params** - No code needed for backend redirects  
✅ **Beautiful UI** - Smooth animations, responsive design  
✅ **Flexible API** - Simple methods, custom options  
✅ **Zero dependencies** - Just vanilla JavaScript  
✅ **Production ready** - Tested and documented  

**Start using it now on any page in your website!** 🚀

