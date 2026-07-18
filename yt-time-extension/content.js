let isBlocked = false;
let blockOverlay = null;

// Initialize state on load
function init() {
  chrome.runtime.sendMessage({ action: "getTime" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.isBlocked) {
      blockYouTube();
    }
  });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "block") {
      blockYouTube();
    } else if (request.action === "unblock") {
      unblockYouTube();
    }
  });

  // Start polling to detect video play and send heartbeat
  setInterval(checkVideoStatus, 1000);

  // Prevention mechanism: constantly pause video if blocked
  setInterval(enforceBlock, 500);
}

function checkVideoStatus() {
  if (isBlocked) return;

  const video = document.querySelector('video');
  // Check if video exists, is playing, and not ended
  if (video && !video.paused && !video.ended && video.readyState >= 2) {
    chrome.runtime.sendMessage({ action: "heartbeat" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.isBlocked) {
        blockYouTube();
      }
    });
  }
}

function enforceBlock() {
  if (!isBlocked) return;

  const videos = document.querySelectorAll('video');
  videos.forEach((video) => {
    if (!video.paused) {
      video.pause();
    }
    // Prevent showing the video frame by hiding it
    video.style.display = 'none';
  });
}

function blockYouTube() {
  if (isBlocked) return;
  isBlocked = true;

  // Pause any currently playing videos immediately
  const videos = document.querySelectorAll('video');
  videos.forEach((video) => {
    video.pause();
    video.style.display = 'none';
  });

  // Create block overlay if it doesn't exist
  if (!document.getElementById('yt-time-blocker-overlay')) {
    blockOverlay = document.createElement('div');
    blockOverlay.id = 'yt-time-blocker-overlay';
    
    const container = document.createElement('div');
    container.className = 'yt-block-container';
    
    // Icon
    const icon = document.createElement('div');
    icon.className = 'yt-block-icon';
    icon.textContent = '⏱️';
    
    // Title
    const title = document.createElement('h1');
    title.className = 'yt-block-title';
    title.textContent = '今日の制限時間に達しました';
    
    // Description
    const desc = document.createElement('p');
    desc.className = 'yt-block-desc';
    desc.textContent = '本日のYouTube視聴時間（2時間）を超えました。デジタルデトックスをして、また明日動画を楽しみましょう！';
    
    container.appendChild(icon);
    container.appendChild(title);
    container.appendChild(desc);
    blockOverlay.appendChild(container);
    
    document.body.appendChild(blockOverlay);
  }
  
  // Add body class to disable scroll
  document.body.classList.add('yt-time-blocked-body');
}

function unblockYouTube() {
  if (!isBlocked) return;
  isBlocked = false;

  // Remove overlay
  const overlay = document.getElementById('yt-time-blocker-overlay');
  if (overlay) {
    overlay.remove();
  }
  blockOverlay = null;

  // Restore videos
  const videos = document.querySelectorAll('video');
  videos.forEach((video) => {
    video.style.display = '';
  });

  // Remove body class
  document.body.classList.remove('yt-time-blocked-body');
}

// Start the content script logic
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
