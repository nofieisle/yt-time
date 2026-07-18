document.addEventListener('DOMContentLoaded', () => {
  const timeSpentEl = document.getElementById('time-spent');
  const progressBarEl = document.getElementById('progress-bar');
  const timeLimitTextEl = document.getElementById('time-limit-text');
  const statusBadgeEl = document.getElementById('status-badge');
  const debugToggleEl = document.getElementById('debug-limit-toggle');
  const resetButtonEl = document.getElementById('reset-button');
  const customLimitInput = document.getElementById('custom-limit-input');
  const saveLimitButton = document.getElementById('save-limit-button');

  // Format seconds to HH:MM:SS
  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  // Format limit to user-friendly string
  function formatLimit(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    const totalMinutes = Math.floor(seconds / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}分`;
    if (m === 0) return `${h}時間`;
    return `${h}時間${m}分`;
  }

  // Update UI with the data from background
  function updateUI() {
    chrome.runtime.sendMessage({ action: "getTime" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (!response) return;

      const { timeSpent, limit, isBlocked } = response;

      // Update timer
      timeSpentEl.textContent = formatTime(timeSpent);
      timeLimitTextEl.textContent = formatLimit(limit);

      // Update progress bar
      const percentage = Math.min((timeSpent / limit) * 100, 100);
      progressBarEl.style.width = `${percentage}%`;

      // Update status badge
      if (isBlocked) {
        statusBadgeEl.textContent = '視聴制限中';
        statusBadgeEl.className = 'status-badge status-blocked';
      } else {
        statusBadgeEl.textContent = '動画視聴可能';
        statusBadgeEl.className = 'status-badge status-ok';
      }

      // Sync debug toggle checkbox status
      debugToggleEl.checked = (limit === 10);

      // Sync custom limit input only when not focused and not in debug mode
      if (limit !== 10 && document.activeElement !== customLimitInput) {
        customLimitInput.value = Math.floor(limit / 60);
      }
    });
  }

  // Toggle debug limit (10s)
  debugToggleEl.addEventListener('change', (e) => {
    const newLimit = e.target.checked ? 10 : (parseInt(customLimitInput.value, 10) || 120) * 60;
    chrome.runtime.sendMessage({ action: "setLimit", limit: newLimit }, () => {
      updateUI();
    });
  });

  // Save custom limit button
  saveLimitButton.addEventListener('click', () => {
    const minutes = parseInt(customLimitInput.value, 10);
    if (!minutes || minutes < 1 || minutes > 1440) {
      customLimitInput.style.borderColor = '#e74c3c';
      setTimeout(() => { customLimitInput.style.borderColor = ''; }, 1500);
      return;
    }
    // Disable debug mode when setting custom limit
    debugToggleEl.checked = false;
    const newLimit = minutes * 60;
    chrome.runtime.sendMessage({ action: "setLimit", limit: newLimit }, () => {
      updateUI();
    });
  });

  // Also apply on Enter key
  customLimitInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveLimitButton.click();
  });

  // Reset button action
  resetButtonEl.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "resetTime" }, () => {
      updateUI();
    });
  });

  // Initial update
  updateUI();

  // Polling update every 1 second while popup is open
  const intervalId = setInterval(updateUI, 1000);

  // Clean up interval on close
  window.addEventListener('unload', () => {
    clearInterval(intervalId);
  });
});
