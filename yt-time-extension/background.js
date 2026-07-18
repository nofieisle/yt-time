const DEFAULT_LIMIT = 7200; // 2 hours in seconds
let lastTickTime = 0;

// Helper to get local date string (YYYY-MM-DD)
function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Check date and reset if a new day has started
async function checkDateAndReset() {
  const today = getLocalDateString();
  const data = await chrome.storage.local.get(['date', 'limit']);
  
  if (data.date !== today) {
    await chrome.storage.local.set({
      date: today,
      timeSpent: 0,
      limit: data.limit || DEFAULT_LIMIT
    });
    return { date: today, timeSpent: 0, limit: data.limit || DEFAULT_LIMIT };
  }
  
  const currentData = await chrome.storage.local.get(['timeSpent', 'limit']);
  return {
    date: today,
    timeSpent: currentData.timeSpent || 0,
    limit: currentData.limit || DEFAULT_LIMIT
  };
}

// Broadcast message to all YouTube tabs
async function broadcastToYouTubeTabs(message) {
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs that aren't fully loaded or don't have content scripts active
        });
      }
    }
  } catch (err) {
    console.error("Failed to broadcast message:", err);
  }
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "heartbeat") {
    handleHeartbeat().then(sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (request.action === "getTime") {
    checkDateAndReset().then((data) => {
      sendResponse({
        timeSpent: data.timeSpent,
        limit: data.limit,
        isBlocked: data.timeSpent >= data.limit
      });
    });
    return true;
  }
  
  if (request.action === "resetTime") {
    resetTime().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === "setLimit") {
    setLimit(request.limit).then((res) => {
      sendResponse(res);
    });
    return true;
  }
});

async function handleHeartbeat() {
  const now = Date.now();
  // Ensure we only increment at most once per second
  if (now - lastTickTime < 950) {
    const data = await chrome.storage.local.get(['timeSpent', 'limit']);
    return { isBlocked: (data.timeSpent || 0) >= (data.limit || DEFAULT_LIMIT) };
  }
  
  lastTickTime = now;
  const data = await checkDateAndReset();
  
  if (data.timeSpent < data.limit) {
    const newTimeSpent = data.timeSpent + 1;
    await chrome.storage.local.set({ timeSpent: newTimeSpent });
    
    if (newTimeSpent >= data.limit) {
      // Trigger block immediately on all tabs
      await broadcastToYouTubeTabs({ action: "block" });
      return { isBlocked: true };
    }
    return { isBlocked: false };
  }
  
  return { isBlocked: true };
}

async function resetTime() {
  const today = getLocalDateString();
  const data = await chrome.storage.local.get('limit');
  const limit = data.limit || DEFAULT_LIMIT;
  
  await chrome.storage.local.set({
    date: today,
    timeSpent: 0,
    limit: limit
  });
  
  await broadcastToYouTubeTabs({ action: "unblock" });
}

async function setLimit(newLimit) {
  const today = getLocalDateString();
  const data = await chrome.storage.local.get('timeSpent');
  const timeSpent = data.timeSpent || 0;
  
  await chrome.storage.local.set({
    date: today,
    limit: newLimit
  });
  
  if (timeSpent >= newLimit) {
    await broadcastToYouTubeTabs({ action: "block" });
  } else {
    await broadcastToYouTubeTabs({ action: "unblock" });
  }
  
  return { success: true, isBlocked: timeSpent >= newLimit };
}

// Initial setup on install
chrome.runtime.onInstalled.addListener(async () => {
  const today = getLocalDateString();
  const data = await chrome.storage.local.get(['date', 'timeSpent', 'limit']);
  
  await chrome.storage.local.set({
    date: data.date || today,
    timeSpent: data.timeSpent || 0,
    limit: data.limit || DEFAULT_LIMIT
  });
});
