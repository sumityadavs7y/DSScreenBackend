# Video.js Demo Page - Documentation

## 🎥 Overview

A simple HTML page demonstrating Video.js library for automatic video playback and switching. This page plays Video 1 on loop for 45 seconds, then automatically switches to Video 2 while maintaining fullscreen state.

---

## 🌐 Access the Demo

**URL**: `http://localhost:3000/demo/video`

Or directly via static file: `http://localhost:3000/video-demo.html`

---

## ✨ Features

### 1. **Automatic Video Switching**
- Starts with **Video 1** (file_example_MP4_480_1_5MG.mp4)
- Video 1 plays on **loop** until 45 seconds elapsed
- After **45 seconds**, automatically switches to **Video 2** (3195394-uhd_3840_2160_25fps.mp4)

### 2. **Fullscreen State Preservation**
- If video is in fullscreen when switching → **stays in fullscreen**
- If video is NOT in fullscreen when switching → **stays in normal view**
- No unwanted fullscreen changes

### 3. **Real-Time Info Overlay**
Shows live information:
- **Status**: Current playback status
- **Current Video**: Which video is playing (Video 1 or 2)
- **Time Elapsed**: Total seconds since page load
- **Next Switch**: Countdown to video switch (for Video 1)
- **Fullscreen Status**: Yes/No

### 4. **Video.js Features**
- Standard video controls (play, pause, volume, fullscreen)
- Responsive player (adapts to screen size)
- Auto-play on page load
- Error handling
- Smooth video transitions

---

## 🛠️ Technical Implementation

### Video.js CDN
```html
<!-- CSS -->
<link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />

<!-- JavaScript -->
<script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
```

### Key Configuration
```javascript
const VIDEO_1 = '/videos/file_example_MP4_480_1_5MG.mp4';
const VIDEO_2 = '/videos/3195394-uhd_3840_2160_25fps.mp4';
const SWITCH_TIME = 45000; // 45 seconds in milliseconds
```

### Video Player Initialization
```javascript
player = videojs('videoPlayer', {
  fluid: true,
  aspectRatio: '16:9',
  autoplay: true,
  controls: true,
  preload: 'auto',
  loop: false, // Manual loop handling
});
```

### Video Switching Logic
```javascript
function loadVideo(src, videoIndex) {
  const wasFullscreen = player.isFullscreen();
  
  player.src({ type: 'video/mp4', src: src });
  player.load();
  player.play();
  
  // Restore fullscreen if it was active
  if (wasFullscreen && !player.isFullscreen()) {
    player.requestFullscreen();
  }
}
```

### Timer-Based Switch
```javascript
setTimeout(() => {
  if (currentVideoIndex === 1) {
    loadVideo(VIDEO_2, 2);
  }
}, 45000); // 45 seconds
```

---

## 📋 How It Works

### Step-by-Step Flow

1. **Page Load**
   - Video.js player initializes
   - Video 1 loads and starts playing automatically
   - Info overlay displays current status
   - 45-second timer starts

2. **Video 1 Playback (0-45 seconds)**
   - Video 1 plays on loop
   - When video ends, it automatically restarts from beginning
   - Info overlay shows countdown: "Next Switch: 45s, 44s, 43s..."
   - User can toggle fullscreen anytime

3. **Video Switch (At 45 seconds)**
   - System captures current fullscreen state
   - Video 2 loads and starts playing
   - If fullscreen was active → re-enables fullscreen
   - If not fullscreen → stays in normal view
   - Info overlay updates to "Current Video: Video 2"
   - Countdown changes to "N/A"

4. **Video 2 Playback (After 45 seconds)**
   - Video 2 plays
   - When video ends, it replays from beginning
   - Fullscreen state remains as is

---

## 🎯 Use Cases

### Digital Signage
- Display short promotional video (Video 1) on repeat
- Switch to main content (Video 2) after attention is grabbed

### Advertisement Rotation
- Show quick ad (Video 1) for 45 seconds
- Switch to featured content (Video 2)

### Content Scheduling
- Play intro video (Video 1) on loop
- Transition to main content (Video 2) automatically

---

## 🔧 Customization

### Change Video Sources
Edit the constants in the HTML file:
```javascript
const VIDEO_1 = '/videos/your-video-1.mp4';
const VIDEO_2 = '/videos/your-video-2.mp4';
```

### Adjust Switch Time
Change the timeout value (in milliseconds):
```javascript
const SWITCH_TIME = 30000; // 30 seconds
const SWITCH_TIME = 60000; // 60 seconds
const SWITCH_TIME = 120000; // 2 minutes
```

### Disable Info Overlay
Add CSS to hide it:
```css
.info-overlay {
  display: none;
}
```

### Change Player Aspect Ratio
```javascript
player = videojs('videoPlayer', {
  aspectRatio: '16:9',  // Wide
  aspectRatio: '4:3',   // Standard
  aspectRatio: '21:9',  // Ultra-wide
});
```

### Auto-Fullscreen on Load
Add after player initialization:
```javascript
player.ready(function() {
  player.requestFullscreen();
});
```

---

## 🧪 Testing Scenarios

### Test 1: Basic Playback
1. Open `http://localhost:3000/demo/video`
2. Verify Video 1 starts playing automatically
3. Wait for video to end → should loop back to start
4. Verify countdown is working

### Test 2: Video Switching
1. Open page, wait 45 seconds
2. Verify Video 2 starts playing
3. Verify no interruption in playback
4. Check info overlay shows "Current Video: Video 2"

### Test 3: Fullscreen Preservation (Active)
1. Open page
2. Click fullscreen button (or press F)
3. Wait 45 seconds for video switch
4. Verify fullscreen remains active on Video 2

### Test 4: Fullscreen Preservation (Inactive)
1. Open page (don't enable fullscreen)
2. Wait 45 seconds for video switch
3. Verify video stays in normal view (not fullscreen)

### Test 5: Manual Controls
1. Open page
2. Test pause/play buttons
3. Test volume controls
4. Test fullscreen toggle
5. Verify all controls work correctly

---

## 🐛 Troubleshooting

### Video Not Playing
**Issue**: Black screen or loading forever

**Solutions**:
- Check video files exist in `/videos` folder
- Verify video paths are correct
- Check browser console for errors
- Ensure videos are in supported format (MP4)

### Video Switch Not Working
**Issue**: Stays on Video 1 after 45 seconds

**Solutions**:
- Check browser console for JavaScript errors
- Verify `SWITCH_TIME` constant is correct
- Check if timer is being cleared accidentally

### Fullscreen Issues
**Issue**: Fullscreen doesn't work or exits unexpectedly

**Solutions**:
- Some browsers require user gesture for fullscreen
- Check if `player.isFullscreen()` returns correct value
- Try clicking fullscreen button manually first

### Info Overlay Not Visible
**Issue**: Can't see the info box

**Solutions**:
- Check CSS `z-index` is high enough
- Verify overlay div is not hidden
- Check if dark background contrasts with page

---

## 📁 Files

### Created Files
- ✅ `/public/video-demo.html` - Main demo page
- ✅ `VIDEO_DEMO_PAGE.md` - This documentation

### Modified Files
- ✅ `/routes/index.js` - Added `/demo/video` route
- ✅ `/index.js` - Added `/videos` static file serving

---

## 💻 Code Structure

### HTML Structure
```html
<video id="videoPlayer" class="video-js">
  <!-- Video.js player -->
</video>

<div class="info-overlay">
  <!-- Real-time status info -->
</div>
```

### JavaScript Flow
```
1. Initialize Video.js player
2. Load Video 1
3. Start 45-second timer
4. Update info overlay every second
5. Listen for fullscreen changes
6. Handle video end events (loop Video 1)
7. At 45 seconds → Switch to Video 2
8. Continue playback
```

---

## 🎨 Styling

### Responsive Design
- Video player is fluid (adapts to container)
- Max width: 1280px
- Centered on page
- Black background

### Info Overlay
- Fixed position (top-right)
- Semi-transparent black background
- White text
- Always on top (z-index: 9999)
- Visible in both fullscreen and normal mode

---

## 🚀 Next Steps / Enhancements

### Possible Improvements
1. **Dynamic Playlist**: Load videos from API endpoint
2. **Schedule-Based Playback**: Use schedule data to determine what plays when
3. **Multiple Videos**: Support more than 2 videos in rotation
4. **Time-Based Rules**: Different videos at different times of day
5. **Device Registration**: Register device and fetch assigned schedule
6. **Offline Support**: Cache videos for offline playback
7. **Analytics**: Track playback statistics
8. **Remote Control**: Control playback via admin panel

---

## 🔗 Integration with Existing System

### Using with Schedules
You can modify the page to fetch schedules from your API:

```javascript
// Fetch schedule by code
const response = await fetch('/api/schedules/public/Ab3Xy');
const data = await response.json();

// Use schedule items to determine what to play
const items = data.schedule.items;
// Build playlist based on items
```

### Device Registration
```javascript
// Register device on page load
const deviceResponse = await fetch('/api/schedules/device/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scheduleCode: 'Ab3Xy',
    uid: getDeviceUID(), // Get device unique ID
    deviceInfo: {
      resolution: '1920x1080',
      userAgent: navigator.userAgent
    }
  })
});

const { schedule } = await deviceResponse.json();
// Use schedule to build playlist
```

---

## 📊 Browser Support

### Tested Browsers
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)

### Requirements
- HTML5 video support
- JavaScript enabled
- Fullscreen API support (for fullscreen features)

---

## ✅ Summary

**Feature**: Video.js Demo Page  
**Location**: `http://localhost:3000/demo/video`  
**Technology**: Video.js 8.10.0 (CDN)  
**Videos**: 2 MP4 files from `/videos` folder  
**Switch Time**: 45 seconds  
**Fullscreen**: Preserved during switches  
**Framework**: None (vanilla HTML/JavaScript)  
**Integration**: Ready to enhance with schedule API  

**Enjoy your Video.js demo! 🎉**

