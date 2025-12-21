/**
 * Video Upload Management
 * Handles video upload, listing, editing, and deletion
 */

let videos = [];
let selectedVideos = new Set();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  loadVideos();
  setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Upload button
  const uploadBtn = document.getElementById('uploadBtn');
  const videoFileInput = document.getElementById('videoFileInput');
  
  if (uploadBtn && videoFileInput) {
    uploadBtn.addEventListener('click', () => videoFileInput.click());
    videoFileInput.addEventListener('change', handleFileUpload);
  }

  // Bulk delete button
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', handleBulkDelete);
  }

  // Select all checkbox
  const selectAllCheckbox = document.getElementById('selectAllVideos');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', handleSelectAll);
  }
}

/**
 * Load videos from API
 */
async function loadVideos() {
  try {
    showLoading(true);
    
    const response = await fetch('/api/videos', {
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to load videos');
    }

    videos = data.data?.videos || [];
    selectedVideos.clear();
    renderVideoList();
    updateBulkDeleteButton();
  } catch (error) {
    console.error('Error loading videos:', error);
    showError('Failed to load videos: ' + error.message);
  } finally {
    showLoading(false);
  }
}

/**
 * Render video list
 */
function renderVideoList() {
  const videoListContainer = document.getElementById('videoList');
  const emptyState = document.getElementById('emptyState');
  const selectAllCheckbox = document.getElementById('selectAllVideos');

  if (!videoListContainer) return;

  if (videos.length === 0) {
    videoListContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    return;
  }

  videoListContainer.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  const tbody = videoListContainer.querySelector('tbody');
  tbody.innerHTML = videos.map(video => `
    <tr data-video-id="${video.id}">
      <td>
        <input 
          type="checkbox" 
          class="video-checkbox" 
          data-video-id="${video.id}"
          ${selectedVideos.has(video.id) ? 'checked' : ''}
          onchange="handleVideoSelect('${video.id}', this.checked)"
        >
      </td>
      <td>
        <div class="video-name-cell">
          <span class="video-name" id="name-${video.id}">${escapeHtml(video.fileName)}</span>
          <input 
            type="text" 
            class="video-name-input" 
            id="input-${video.id}" 
            value="${escapeHtml(video.fileName)}"
            style="display: none;"
          >
        </div>
      </td>
      <td>${formatFileSize(video.fileSize)}</td>
      <td>${formatDuration(video.duration)}</td>
      <td>${new Date(video.uploadedAt).toLocaleDateString()}</td>
      <td>
        <div class="action-buttons">
          <button 
            class="btn-icon btn-edit" 
            id="edit-btn-${video.id}"
            onclick="startEditVideo('${video.id}')"
            title="Edit name"
          >
            ✏️
          </button>
          <button 
            class="btn-icon btn-save" 
            id="save-btn-${video.id}"
            onclick="saveVideoName('${video.id}')"
            style="display: none;"
            title="Save"
          >
            ✓
          </button>
          <button 
            class="btn-icon btn-cancel" 
            id="cancel-btn-${video.id}"
            onclick="cancelEditVideo('${video.id}')"
            style="display: none;"
            title="Cancel"
          >
            ✕
          </button>
          <button 
            class="btn-icon btn-delete" 
            onclick="deleteVideo('${video.id}')"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Update select all checkbox state
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = videos.length > 0 && selectedVideos.size === videos.length;
  }
}

/**
 * Handle file upload
 */
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
  if (!validTypes.includes(file.type)) {
    showError('Please select a valid video file (MP4, WebM, OGG, MOV, AVI)');
    event.target.value = '';
    return;
  }

  // Validate file size (e.g., 500MB max)
  const maxSize = 500 * 1024 * 1024; // 500MB
  if (file.size > maxSize) {
    showError('File size exceeds 500MB limit');
    event.target.value = '';
    return;
  }

  try {
    showLoading(true, 'Uploading video...');

    const formData = new FormData();
    formData.append('video', file);

    const response = await fetch('/api/videos/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Upload failed');
    }

    showSuccess('Video uploaded successfully!');
    event.target.value = '';
    await loadVideos();
  } catch (error) {
    console.error('Upload error:', error);
    showError('Upload failed: ' + error.message);
  } finally {
    showLoading(false);
  }
}

/**
 * Start editing video name
 */
function startEditVideo(videoId) {
  const nameSpan = document.getElementById(`name-${videoId}`);
  const nameInput = document.getElementById(`input-${videoId}`);
  const editBtn = document.getElementById(`edit-btn-${videoId}`);
  const saveBtn = document.getElementById(`save-btn-${videoId}`);
  const cancelBtn = document.getElementById(`cancel-btn-${videoId}`);

  if (nameSpan && nameInput && editBtn && saveBtn && cancelBtn) {
    nameSpan.style.display = 'none';
    nameInput.style.display = 'block';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';
    nameInput.focus();
    nameInput.select();
  }
}

/**
 * Cancel editing video name
 */
function cancelEditVideo(videoId) {
  const video = videos.find(v => v.id === videoId);
  if (!video) return;

  const nameSpan = document.getElementById(`name-${videoId}`);
  const nameInput = document.getElementById(`input-${videoId}`);
  const editBtn = document.getElementById(`edit-btn-${videoId}`);
  const saveBtn = document.getElementById(`save-btn-${videoId}`);
  const cancelBtn = document.getElementById(`cancel-btn-${videoId}`);

  if (nameSpan && nameInput && editBtn && saveBtn && cancelBtn) {
    nameInput.value = video.fileName; // Reset to original
    nameSpan.style.display = 'block';
    nameInput.style.display = 'none';
    editBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
  }
}

/**
 * Save video name
 */
async function saveVideoName(videoId) {
  const nameInput = document.getElementById(`input-${videoId}`);
  if (!nameInput) return;

  const newName = nameInput.value.trim();
  if (!newName) {
    showError('Video name cannot be empty');
    return;
  }

  try {
    showLoading(true, 'Updating video name...');

    const response = await fetch(`/api/videos/${videoId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: newName }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Update failed');
    }

    showSuccess('Video name updated successfully!');
    await loadVideos();
  } catch (error) {
    console.error('Update error:', error);
    showError('Update failed: ' + error.message);
    cancelEditVideo(videoId);
  } finally {
    showLoading(false);
  }
}

/**
 * Delete single video
 */
async function deleteVideo(videoId) {
  try {
    // First check if video is used in schedules
    const usageResponse = await fetch(`/api/videos/${videoId}/schedule-usage`, {
      credentials: 'include',
    });

    const usageData = await usageResponse.json();

    if (!usageResponse.ok) {
      throw new Error(usageData.message || 'Failed to check video usage');
    }

    let confirmDelete = false;
    let forceDelete = false;

    if (usageData.data.isUsed) {
      const scheduleNames = usageData.data.schedules.map(s => s.scheduleName).join(', ');
      const message = `This video is currently used in ${usageData.data.usageCount} schedule(s): ${scheduleNames}\n\nDeleting this video will also remove it from these schedules. Do you want to proceed?`;
      confirmDelete = confirm(message);
      forceDelete = true;
    } else {
      confirmDelete = confirm('Are you sure you want to delete this video?');
    }

    if (!confirmDelete) return;

    showLoading(true, 'Deleting video...');

    const deleteUrl = forceDelete 
      ? `/api/videos/${videoId}?forceDelete=true`
      : `/api/videos/${videoId}`;

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Delete failed');
    }

    showSuccess('Video deleted successfully!');
    await loadVideos();
  } catch (error) {
    console.error('Delete error:', error);
    showError('Delete failed: ' + error.message);
  } finally {
    showLoading(false);
  }
}

/**
 * Handle video selection
 */
function handleVideoSelect(videoId, checked) {
  if (checked) {
    selectedVideos.add(videoId);
  } else {
    selectedVideos.delete(videoId);
  }
  updateBulkDeleteButton();
  updateSelectAllCheckbox();
}

/**
 * Handle select all
 */
function handleSelectAll(event) {
  const checked = event.target.checked;
  selectedVideos.clear();
  
  if (checked) {
    videos.forEach(video => selectedVideos.add(video.id));
  }

  // Update all checkboxes
  document.querySelectorAll('.video-checkbox').forEach(checkbox => {
    checkbox.checked = checked;
  });

  updateBulkDeleteButton();
}

/**
 * Update select all checkbox state
 */
function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('selectAllVideos');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = videos.length > 0 && selectedVideos.size === videos.length;
  }
}

/**
 * Update bulk delete button state
 */
function updateBulkDeleteButton() {
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.disabled = selectedVideos.size === 0;
    bulkDeleteBtn.textContent = selectedVideos.size > 0 
      ? `Delete Selected (${selectedVideos.size})`
      : 'Delete Selected';
  }
}

/**
 * Handle bulk delete
 */
async function handleBulkDelete() {
  if (selectedVideos.size === 0) return;

  const videoIds = Array.from(selectedVideos);
  
  // Check which videos are used in schedules
  try {
    showLoading(true, 'Checking video usage...');

    const usageChecks = await Promise.all(
      videoIds.map(async (videoId) => {
        const response = await fetch(`/api/videos/${videoId}/schedule-usage`, {
          credentials: 'include',
        });
        const data = await response.json();
        return {
          videoId,
          isUsed: data.data.isUsed,
          usageCount: data.data.usageCount,
          schedules: data.data.schedules,
        };
      })
    );

    const videosInSchedules = usageChecks.filter(v => v.isUsed);
    let confirmDelete = false;
    let forceDelete = false;

    if (videosInSchedules.length > 0) {
      const totalUsage = videosInSchedules.reduce((sum, v) => sum + v.usageCount, 0);
      const message = `${videosInSchedules.length} of the selected videos are used in schedules (${totalUsage} total usage(s)).\n\nDeleting these videos will also remove them from all schedules. Do you want to proceed?`;
      confirmDelete = confirm(message);
      forceDelete = true;
    } else {
      confirmDelete = confirm(`Are you sure you want to delete ${videoIds.length} video(s)?`);
    }

    if (!confirmDelete) {
      showLoading(false);
      return;
    }

    showLoading(true, 'Deleting videos...');

    const response = await fetch('/api/videos/bulk-delete', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoIds,
        forceDelete,
      }),
    });

    const data = await response.json();

    if (!response.ok && response.status !== 207) {
      throw new Error(data.message || 'Bulk delete failed');
    }

    // Show results
    const deleted = data.data.deleted.length;
    const failed = data.data.failed.length;

    if (deleted > 0 && failed === 0) {
      showSuccess(`Successfully deleted ${deleted} video(s)!`);
    } else if (deleted > 0 && failed > 0) {
      showWarning(`Deleted ${deleted} video(s), but ${failed} failed.`);
    } else {
      showError(`Failed to delete videos: ${data.data.failed.map(f => f.reason).join(', ')}`);
    }

    selectedVideos.clear();
    await loadVideos();
  } catch (error) {
    console.error('Bulk delete error:', error);
    showError('Bulk delete failed: ' + error.message);
  } finally {
    showLoading(false);
  }
}

/**
 * Utility functions
 */
function formatFileSize(bytes) {
  if (!bytes) return 'N/A';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading(show, message = 'Loading...') {
  let loader = document.getElementById('uploadLoader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'uploadLoader';
    loader.className = 'loader-overlay';
    loader.innerHTML = `
      <div class="loader-content">
        <div class="spinner"></div>
        <p id="loaderMessage">${message}</p>
      </div>
    `;
    document.body.appendChild(loader);
  }
  
  const loaderMessage = document.getElementById('loaderMessage');
  if (loaderMessage) {
    loaderMessage.textContent = message;
  }
  
  loader.style.display = show ? 'flex' : 'none';
}

function showError(message) {
  showNotification(message, 'error');
}

function showSuccess(message) {
  showNotification(message, 'success');
}

function showWarning(message) {
  showNotification(message, 'warning');
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

