document.addEventListener('DOMContentLoaded', () => {
  const timeSpentEl = document.getElementById('time-spent');
  const progressBarEl = document.getElementById('progress-bar');
  const timeLimitTextEl = document.getElementById('time-limit-text');
  const statusBadgeEl = document.getElementById('status-badge');
  const debugToggleEl = document.getElementById('debug-limit-toggle');
  const resetButtonEl = document.getElementById('reset-button');

  // Format seconds to HH:MM:SS
  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  // Format limit to user-friendly string
  function formatLimit(seconds) {
    if (seconds === 10) return '10秒';
    const hours = seconds / 3600;
    return `${hours}時間`;
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
    });
  }

  // Toggle debug limit (10s)
  debugToggleEl.addEventListener('change', (e) => {
    const newLimit = e.target.checked ? 10 : 7200;
    chrome.runtime.sendMessage({ action: "setLimit", limit: newLimit }, () => {
      updateUI();
    });
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
