# Template Partials System - Reusable Components

## ✅ Header & Common Elements Templatized

All common page elements (navbar, head, scripts) have been extracted into reusable partials for consistency and easy maintenance!

---

## 📁 Partial Files Created

### 1. **`/views/partials/head.ejs`**
Common `<head>` elements for all dashboard pages:
- Meta tags (charset, viewport)
- Bootstrap CSS
- Bootstrap Icons
- Toast notification CSS
- Common styles (navbar, tabs, buttons, modals, etc.)

### 2. **`/views/partials/navbar.ejs`**
Main navigation bar with:
- dsScreen logo/brand
- User dropdown menu
- Company name & role display
- Logout button
- Responsive mobile menu

### 3. **`/views/partials/dashboard-tabs.ejs`**
Tab navigation component:
- Video Library tab
- Schedules tab
- Active state highlighting

### 4. **`/views/partials/scripts.ejs`**
Common JavaScript includes:
- Bootstrap bundle
- Toast notification system

---

## 🎯 How to Use

### Including Partials in Pages

#### Basic Page Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <%- include('partials/head') %>
    <title>Your Page Title - dsScreen</title>
    
    <!-- Page-specific CSS (optional) -->
    <style>
        /* Your page-specific styles */
    </style>
</head>
<body>
    <!-- Include navbar with user data -->
    <%- include('partials/navbar', { user, company, userCompany }) %>
    
    <!-- Toast container -->
    <div class="toast-container" id="toastContainer"></div>
    
    <div class="content-wrapper">
        <div class="container">
            <!-- Include tabs -->
            <%- include('partials/dashboard-tabs', { currentPage: 'videos' }) %>
            
            <!-- Your page content here -->
            
        </div>
    </div>
    
    <!-- Include common scripts -->
    <%- include('partials/scripts') %>
    
    <!-- Page-specific scripts (optional) -->
    <script>
        // Your page-specific JavaScript
    </script>
</body>
</html>
```

---

## 📝 Partial Details

### 1. Head Partial (`partials/head.ejs`)

**Usage:**
```html
<head>
    <%- include('partials/head') %>
    <title>Page Title</title>
</head>
```

**Includes:**
- Bootstrap 5.3.2 CSS
- Bootstrap Icons 1.11.2
- Toast notification CSS
- Common dashboard styles

**No parameters needed** - Just include it!

---

### 2. Navbar Partial (`partials/navbar.ejs`)

**Usage:**
```html
<%- include('partials/navbar', { user, company, userCompany }) %>
```

**Required Parameters:**
- `user` - User object with `firstName`, `lastName`
- `company` - Company object with `name`
- `userCompany` - UserCompany object with `role`

**Features:**
- Logo links to `/dashboard/videos`
- User dropdown with name
- Company name & role display
- Logout form

**Example:**
```javascript
// In your route
res.render('mypage', {
    user: req.user,
    company: req.company,
    userCompany: req.userCompany
});
```

---

### 3. Dashboard Tabs Partial (`partials/dashboard-tabs.ejs`)

**Usage:**
```html
<%- include('partials/dashboard-tabs', { currentPage: 'videos' }) %>
```

**Required Parameters:**
- `currentPage` - String indicating active tab ('videos' or 'schedules')

**Features:**
- Video Library tab
- Schedules tab
- Active tab gets purple underline
- Hover effects

**Examples:**
```html
<!-- On videos page -->
<%- include('partials/dashboard-tabs', { currentPage: 'videos' }) %>

<!-- On schedules page -->
<%- include('partials/dashboard-tabs', { currentPage: 'schedules' }) %>
```

---

### 4. Scripts Partial (`partials/scripts.ejs`)

**Usage:**
```html
<%- include('partials/scripts') %>
```

**Includes:**
- Bootstrap 5.3.2 bundle (with Popper.js)
- Toast notification JavaScript

**No parameters needed** - Just include before closing `</body>`!

---

## ✨ Benefits

### Single Source of Truth
✅ **One place to update** - Change navbar? Update one file!  
✅ **Consistency** - All pages look the same  
✅ **No duplication** - DRY principle  

### Easy Maintenance
✅ **Change logo** - Update navbar.ejs once  
✅ **Update Bootstrap** - Update head.ejs once  
✅ **Add new tab** - Update dashboard-tabs.ejs once  

### Cleaner Code
✅ **Less code per page** - Pages are shorter  
✅ **Focus on content** - Page files focus on unique content  
✅ **Better organization** - Partials folder for reusables  

---

## 🔄 Example: Adding a New Dashboard Page

Let's add an "Analytics" page:

### Step 1: Create the View (`views/analytics.ejs`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <%- include('partials/head') %>
    <title>Analytics - dsScreen</title>
</head>
<body>
    <%- include('partials/navbar', { user, company, userCompany }) %>
    
    <div class="toast-container" id="toastContainer"></div>
    
    <div class="content-wrapper">
        <div class="container">
            <%- include('partials/dashboard-tabs', { currentPage: 'analytics' }) %>
            
            <!-- Your analytics content here -->
            <div class="card table-card">
                <div class="card-body">
                    <h2>Analytics Dashboard</h2>
                    <!-- Your content -->
                </div>
            </div>
        </div>
    </div>
    
    <%- include('partials/scripts') %>
</body>
</html>
```

### Step 2: Update Tab Navigation

Add to `partials/dashboard-tabs.ejs`:

```html
<li class="nav-item" role="presentation">
    <a class="nav-link <%= currentPage === 'analytics' ? 'active' : '' %>" 
       href="/dashboard/analytics">
        <i class="bi bi-graph-up"></i> Analytics
    </a>
</li>
```

### Step 3: Add Route

```javascript
router.get('/analytics', webRequireAuth, webRequireCompany, (req, res) => {
    res.render('analytics', {
        user: req.user,
        company: req.company,
        userCompany: req.userCompany
    });
});
```

**Done!** The new page automatically has:
- ✅ Same navbar
- ✅ Same styling
- ✅ Same tabs (with new one added)
- ✅ Same scripts

---

## 🎨 Customizing Individual Pages

### Adding Page-Specific Styles

```html
<head>
    <%- include('partials/head') %>
    <title>My Page</title>
    
    <!-- Page-specific styles -->
    <style>
        .my-special-class {
            color: red;
        }
    </style>
</head>
```

### Adding Page-Specific Scripts

```html
    <%- include('partials/scripts') %>
    
    <!-- Page-specific scripts -->
    <script src="/js/my-page-script.js"></script>
    <script>
        console.log('Page-specific code');
    </script>
</body>
```

### Adding Page-Specific CSS Files

```html
<head>
    <%- include('partials/head') %>
    <link rel="stylesheet" href="/css/my-page.css">
    <title>My Page</title>
</head>
```

---

## 🔧 Modifying Common Elements

### Changing the Navbar

**File:** `views/partials/navbar.ejs`

**Example:** Add a "Help" link

```html
<ul class="navbar-nav ms-auto">
    <!-- Add new nav item -->
    <li class="nav-item">
        <a class="nav-link" href="/help">
            <i class="bi bi-question-circle"></i> Help
        </a>
    </li>
    
    <!-- Existing user dropdown -->
    <li class="nav-item dropdown">
        <!-- ... -->
    </li>
</ul>
```

**Result:** All pages instantly have the new "Help" link!

### Updating Bootstrap Version

**File:** `views/partials/head.ejs`

Change:
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
```

To:
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.4.0/dist/css/bootstrap.min.css" rel="stylesheet">
```

**Result:** All pages use the new Bootstrap version!

### Adding Global Styles

**File:** `views/partials/head.ejs`

Add to the `<style>` block:
```css
.my-global-class {
    /* Your styles */
}
```

**Result:** Class available on all pages!

---

## 📊 File Structure

```
views/
├── partials/
│   ├── head.ejs              ← Common <head> elements
│   ├── navbar.ejs            ← Navigation bar
│   ├── dashboard-tabs.ejs    ← Tab navigation
│   └── scripts.ejs           ← Common scripts
├── videos.ejs                ← Uses all partials
├── schedules.ejs             ← Uses all partials
├── login.ejs                 ← Different layout (auth)
└── register.ejs              ← Different layout (auth)
```

---

## 🎯 Pages Using Partials

### Currently Updated:
✅ `videos.ejs` - Video Library page  
✅ `schedules.ejs` - Schedules page  

### Authentication Pages (Different Layout):
These use a different layout (centered card design):
- `login.ejs`
- `register.ejs`
- `index.ejs` (device registration)

---

## 💡 Best Practices

### 1. Keep Partials Generic
✅ Partials should work for all pages  
❌ Don't add page-specific code in partials  

### 2. Use Parameters for Variation
✅ `currentPage` parameter for tabs  
✅ Pass user data to navbar  
❌ Don't hard-code values  

### 3. Override When Needed
✅ Add page-specific styles after partial  
✅ Add page-specific scripts after partial  
❌ Don't modify partial for one page  

### 4. Document Changes
✅ If you modify a partial, test all pages  
✅ Document breaking changes  
❌ Don't make surprise changes  

---

## 🔍 Quick Reference

### Include Syntax

```html
<!-- No parameters -->
<%- include('partials/head') %>
<%- include('partials/scripts') %>

<!-- With parameters -->
<%- include('partials/navbar', { user, company, userCompany }) %>
<%- include('partials/dashboard-tabs', { currentPage: 'videos' }) %>
```

### Parameter Format

```javascript
// Single parameter
{ currentPage: 'videos' }

// Multiple parameters
{ user, company, userCompany }

// Equivalent to:
{
    user: user,
    company: company,
    userCompany: userCompany
}
```

---

## ✨ Summary

The template system now provides:

✅ **Reusable navbar** - Consistent across all pages  
✅ **Reusable head** - Common styles & meta tags  
✅ **Reusable tabs** - Dashboard navigation  
✅ **Reusable scripts** - Common JavaScript  
✅ **Easy maintenance** - Update once, apply everywhere  
✅ **Clean code** - No duplication  
✅ **Scalable** - Easy to add new pages  

**Change the navbar once, it updates everywhere!** 🎉

