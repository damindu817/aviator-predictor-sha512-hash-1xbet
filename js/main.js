
// Global variables
let activeSignals = [];
let currentCountdown = null;
let serverTimeOffset = 0;
let lastHash = '';
let selectedOdd = null;
let activeSignalPopup = null;
let signalQueue = [];
let currentSignalIndex = 0;
let signalEndInterval = null;
let signalCountdownInterval = null;
let riskSignalCountdownInterval = null;
let disclaimerShown = false;
let tipsPopupShown = false;
let firstSignalGenerated = false;
let signalResultReceived = false;
let notificationCheckInterval = null;
let lastNotificationETag = '';
let lastNotificationModified = '';
let unseenNotifications = 0;

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
  // Set initial placeholder values
  document.getElementById("current-date").textContent = "Loading...";
  document.getElementById("current-time").textContent = "--:--:--";
  
  // Then initialize the rest of the app
  initializeApp();
});

function initializeApp() {
  // Immediately update date/time to avoid delay
  updateDateTime();
  
  loadHistory();
  updateStats();
  
  // Check connection status immediately
  checkConnection();
  
  // Set up connection monitoring
  window.addEventListener('online', checkConnection);
  window.addEventListener('offline', checkConnection);
  
  // Auto-focus input field
  document.getElementById("hashInput").focus();
  
  // Auto-predict if hash is pasted
  document.getElementById("hashInput").addEventListener('input', function(e) {
    const hash = e.target.value.trim();
    if (hash.length === 128 && /^[a-f0-9]+$/.test(hash)) {
      lastHash = hash;
      updateConfidenceBars(hash);
      // Don't enable copy button here - wait for odd selection
    } else {
      document.getElementById("copyResultBtn").disabled = true;
    }
  });
  
  // Initialize signal popup events
  document.getElementById("signalPopup").addEventListener('click', function(e) {
    if (e.target === this) {
      closeSignalPopup();
    }
  });
  
  // Initialize risk signal popup events
  document.getElementById("riskSignalPopup").addEventListener('click', function(e) {
    if (e.target === this) {
      closeRiskSignalPopup();
    }
  });
  
  // Initialize tips badge
  const tipsBadge = document.getElementById("tipsBadge");
  const tipsPopup = document.getElementById("tipsPopup");
  
  tipsBadge.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    tipsPopup.classList.toggle("show");
    
    // Hide disclaimer popup if showing
    document.getElementById("disclaimerPopup").classList.remove("show");
  });
  
  // Close popups when clicking elsewhere
  document.addEventListener('click', function(e) {
    if (!tipsBadge.contains(e.target) && !tipsPopup.contains(e.target)) {
      tipsPopup.classList.remove("show");
    }
    
    if (!disclaimerBadge.contains(e.target) && !disclaimerPopup.contains(e.target)) {
      document.getElementById("disclaimerPopup").classList.remove("show");
    }
  });
  
  // Show disclaimer popup after 5 seconds if not shown before
  if (!sessionStorage.getItem('disclaimerShown')) {
    setTimeout(() => {
      showDisclaimer();
      setTimeout(hideDisclaimer, 8000);
      sessionStorage.setItem('disclaimerShown', 'true');
    }, 5000);
  }
  
  // Create floating animation elements for offline page
  const animationContainer = document.getElementById('connectionAnimation');
  for (let i = 0; i < 15; i++) {
    const dot = document.createElement('div');
    dot.style.left = `${Math.random() * 100}%`;
    dot.style.top = `${Math.random() * 100}%`;
    dot.style.animationDelay = `${Math.random() * 15}s`;
    dot.style.animationDuration = `${10 + Math.random() * 20}s`;
    animationContainer.appendChild(dot);
  }
  
  // Retry button functionality
  const retryBtn = document.getElementById('retryBtn');
  retryBtn.addEventListener('click', function() {
    const btn = this;
    const icon = btn.querySelector('i');
    
    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CONNECTING...';
    
    // Simulate connection check
    setTimeout(() => {
      if (navigator.onLine) {
        // Success state
        btn.innerHTML = '<i class="fas fa-check"></i> CONNECTION RESTORED!';
        btn.style.background = `linear-gradient(90deg, var(--success), var(--primary))`;
        
        // Hide offline overlay
        document.getElementById('offlineOverlay').classList.remove('active');
        
        // Sync server time
        syncServerTime();
        
        // Start notification checking
        startNotificationChecking();
        
        // Redirect back to app
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        // Error state
        btn.innerHTML = '<i class="fas fa-times"></i> CONNECTION FAILED';
        btn.style.background = `linear-gradient(90deg, var(--danger), var(--warning))`;
        
        // Reset button after delay
        setTimeout(() => {
          btn.innerHTML = '<i class="fas fa-sync-alt"></i> RETRY CONNECTION';
          btn.style.background = `linear-gradient(90deg, var(--primary), var(--secondary))`;
          btn.disabled = false;
        }, 1500);
      }
    }, 2000);
  });
  
  // Start checking for notifications
  startNotificationChecking();
  
  // Load initial notifications
  loadNotifications();
}

// Start checking for notifications
function startNotificationChecking() {
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
  }
  
  // Check every 15 seconds
  notificationCheckInterval = setInterval(checkForNewNotifications, 15000);
}

// Check for new notifications
async function checkForNewNotifications() {
  try {
    const response = await fetch('notifications.json', {
      method: 'HEAD'
    });
    
    const currentETag = response.headers.get('ETag');
    const currentModified = response.headers.get('Last-Modified');
    
    if (currentETag !== lastNotificationETag || currentModified !== lastNotificationModified) {
      // There are changes, load the new notifications
      loadNotifications();
      lastNotificationETag = currentETag;
      lastNotificationModified = currentModified;
    }
  } catch (e) {
    console.error("Failed to check for notifications:", e);
  }
}

// Load notifications from JSON file
async function loadNotifications() {
  try {
    const response = await fetch('notifications.json');
    const notifications = await response.json();
    
    // Store the ETag and Last-Modified headers for future checks
    lastNotificationETag = response.headers.get('ETag');
    lastNotificationModified = response.headers.get('Last-Modified');
    
    // Get the last seen notification time from localStorage
    const lastSeen = localStorage.getItem('lastSeenNotification') || '0';
    
    // Count unseen notifications
    unseenNotifications = notifications.filter(n => {
      const notifTime = new Date(n.timestamp).getTime();
      return notifTime > parseInt(lastSeen);
    }).length;
    
    // Update badge
    updateNotificationBadge();
    
    // Render notifications
    renderNotifications(notifications);
  } catch (e) {
    console.error("Failed to load notifications:", e);
    
    // If the file doesn't exist, use default notifications
    const defaultNotifications = [
      {
        "title": "Algorithm Updated",
        "message": "100x prediction සඳහා නව ඇල්ගොරිතමය යාවත්කාලීන කරන ලදි.",
        "type": "algorithm_update",
        "timestamp": new Date().toISOString()
      },
      {
        "title": "Bug Fixed",
        "message": "Timer ක්‍රියාවලියේ සිදුවූ දෝෂයක් නිවැරදි කරන ලදි.",
        "type": "bug_fix",
        "timestamp": new Date(Date.now() - 3600000).toISOString()
      },
      {
        "title": "Welcome Message",
        "message": "නව තොරතුරු සහ උපදෙස් සඳහා Telegram channel එක සෙවීම නිවැරදියි.",
        "type": "general",
        "timestamp": new Date(Date.now() - 86400000).toISOString()
      }
    ];
    
    renderNotifications(defaultNotifications);
  }
}

// Update notification badge
function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  
  if (unseenNotifications > 0) {
    badge.style.display = 'flex';
    badge.textContent = unseenNotifications > 9 ? '9+' : unseenNotifications;
  } else {
    badge.style.display = 'none';
  }
}

// Render notifications in the UI
function renderNotifications(notifications) {
  const container = document.getElementById('notificationTabContent');
  container.innerHTML = '';
  
  // Sort by timestamp (newest first)
  notifications.sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  notifications.forEach(notification => {
    const item = document.createElement('div');
    item.className = `notification-item notification-${notification.type}`;
    
    // Get icon based on type
    let icon, iconClass;
    switch(notification.type) {
      case 'algorithm_update':
        icon = '⚙️';
        iconClass = 'fas fa-cogs';
        break;
      case 'bug_fix':
        icon = '🐞';
        iconClass = 'fas fa-bug';
        break;
      default:
        icon = '🔔';
        iconClass = 'fas fa-bell';
    }
    
    // Format time
    const timeStr = formatRelativeTime(new Date(notification.timestamp));
    
    item.innerHTML = `
      <div class="notification-title">
        <i class="${iconClass}"></i> ${notification.title}
      </div>
      <div class="notification-time">
        <i class="far fa-clock"></i> ${timeStr}
      </div>
      <div class="notification-message">
        ${notification.message}
      </div>
    `;
    
    container.appendChild(item);
  });
}

// Format time as "X time ago"
function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;
  
  if (diff < minute) {
    return "Just now";
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diff < month) {
    const days = Math.floor(diff / day);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (diff < year) {
    const months = Math.floor(diff / month);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diff / year);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
}

// Tab switching function - UPDATED to handle notification badge
function switchTab(tabId, clickedElement) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show selected tab content
  document.getElementById(tabId).classList.add('active');
  
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  clickedElement.classList.add('active');
  
  // If switching to notification tab, mark notifications as seen
  if (tabId === 'notificationTab') {
    markNotificationsAsSeen();
  }
  
  // Scroll to top
  document.querySelector('.scroll-container').scrollTo(0, 0);
}

// Mark notifications as seen
function markNotificationsAsSeen() {
  unseenNotifications = 0;
  updateNotificationBadge();
  
  // Store the current time as last seen
  localStorage.setItem('lastSeenNotification', Date.now().toString());
}

// Check connection status
function checkConnection() {
  if (navigator.onLine) {
    document.getElementById('offlineOverlay').classList.remove('active');
    syncServerTime(); // Sync time when connection is restored
  } else {
    document.getElementById('offlineOverlay').classList.add('active');
  }
}

// Show disclaimer popup
function showDisclaimer() {
  const popup = document.getElementById("disclaimerPopup");
  popup.classList.add("show");
}

// Hide disclaimer popup
function hideDisclaimer() {
  const popup = document.getElementById("disclaimerPopup");
  popup.classList.remove("show");
}

// Show tips popup after signal generation and result
function showTipsPopup() {
  if (!tipsPopupShown && signalResultReceived) {
    const tipsPopup = document.getElementById("tipsPopup");
    tipsPopup.classList.add("show");
    tipsPopupShown = true;
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
      tipsPopup.classList.remove("show");
    }, 8000);
  }
}

// Show premium dialog
function showPremiumDialog() {
  document.getElementById("premiumDialog").classList.add("active");
}

// Hide premium dialog
function hidePremiumDialog() {
  document.getElementById("premiumDialog").classList.remove("active");
}

// Show premium features
function showPremiumFeatures() {
  showPremiumDialog();
}

// Update current date and time with server sync
function updateDateTime() {
  const now = new Date(Date.now() + serverTimeOffset);
  document.getElementById("current-date").textContent = now.toLocaleDateString('en-US', { 
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
  });
  document.getElementById("current-time").textContent = now.toLocaleTimeString();
}

setInterval(updateDateTime, 1000);

// Sync with server time for maximum accuracy (runs in background)
async function syncServerTime() {
  try {
    const start = Date.now();
    const response = await fetch('https://worldtimeapi.org/api/ip');
    const data = await response.json();
    const serverTime = new Date(data.utc_datetime).getTime();
    const end = Date.now();
    const rtt = end - start;
    
    // Calculate offset accounting for network latency
    serverTimeOffset = serverTime - end + (rtt / 2);
    
    console.log(`Time synced successfully (${rtt}ms latency)`);
    
    // Recheck any active signals with corrected time
    checkNextSignal();
  } catch (e) {
    console.error("Time sync failed, using local time:", e);
  }
}

// Paste hash from clipboard
document.getElementById("pasteHashInput").addEventListener('click', async function() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById("hashInput").value = text;
    lastHash = text.trim();
    if (lastHash.length === 128 && /^[a-f0-9]+$/.test(lastHash)) {
      updateConfidenceBars(lastHash);
      // Don't enable copy button here - wait for odd selection
    } else {
      document.getElementById("copyResultBtn").disabled = true;
    }
  } catch (err) {
    showErrorDialog("Failed to read from clipboard. Please paste manually.");
    console.error("Failed to read clipboard contents: ", err);
  }
});

// Clear hash input
document.getElementById("clearHashInput").addEventListener('click', function() {
  document.getElementById("hashInput").value = '';
  lastHash = '';
  document.getElementById("copyResultBtn").disabled = true;
  selectedOdd = null;
  
  // Reset confidence bars
  [2, 3, 4, 7, 10, 100].forEach(odd => {
    document.getElementById(`confidence-${odd}`).style.width = '0%';
  });
  
  // Reset results display
  document.getElementById("result-odd").textContent = "-";
  document.getElementById("result-entropy").textContent = "-";
  document.getElementById("result-score").textContent = "-";
  document.getElementById("result-confidence").textContent = "-";
  document.getElementById("result-delay").textContent = "-";
  document.getElementById("result-time").textContent = "-";
});

// Audio functions
function playSignalSound() {
  const audio = document.getElementById("signalSound");
  audio.currentTime = 0;
  audio.play().catch(e => console.log("Audio play failed:", e));
}

function playSuccessSound() {
  const audio = document.getElementById("successSound");
  audio.currentTime = 0;
  audio.play().catch(e => console.log("Audio play failed:", e));
}

function playBeepSound() {
  const audio = document.getElementById("beepSound");
  audio.currentTime = 0;
  audio.play().catch(e => console.log("Beep sound play failed:", e));
}

function playWarningSound() {
  const audio = document.getElementById("warningSound");
  audio.currentTime = 0;
  audio.play().catch(e => console.log("Warning sound play failed:", e));
}

// Countdown and active signal tracking
function updateCountdown(targetTime, odd) {
  // Clear any existing countdown
  if (currentCountdown) {
    clearInterval(currentCountdown);
  }
  
  const signalId = Date.now();
  activeSignals.push({ id: signalId, time: targetTime, odd });
  
  // Schedule popup to show 20 seconds before signal time
  const popupTime = new Date(targetTime.getTime() - 20000);
  const now = new Date(Date.now() + serverTimeOffset);
  const popupDelay = popupTime - now;
  
  if (popupDelay > 0) {
    setTimeout(() => {
      // Only show popup if the signal time hasn't passed yet
      if (new Date(Date.now() + serverTimeOffset) < targetTime) {
        // Check if we should show RISK SIGNAL or PREMIUM SIGNAL
        if (['7', '10', '100'].includes(odd)) {
          showRiskSignalPopup(targetTime, odd, signalId);
        } else {
          showSignalPopup(targetTime, odd, signalId);
        }
      }
    }, popupDelay);
  }
  
  currentCountdown = setInterval(() => {
    const now = new Date(Date.now() + serverTimeOffset);
    const diff = Math.floor((targetTime - now) / 1000);
    
    if (diff <= 0) {
      clearInterval(currentCountdown);
      document.getElementById("countdown").textContent = `Signal for ${odd}x reached! Place your bet now!`;
      document.getElementById("countdown").className = odd === "100" ? "countdown extreme" : "countdown";
      playSignalSound();
      playBeepSound(); // Play beep sound when signal is reached
      highlightActiveSignal(signalId);
      removeSignal(signalId);
      
      // Check for next signal after this one completes
      setTimeout(checkNextSignal, 1000);
    } else {
      const min = Math.floor(diff / 60);
      const sec = diff % 60;
      document.getElementById("countdown").textContent = `Next ${odd}x signal in: ${min}m ${sec}s`;
      
      // Change color based on urgency
      if (odd === "100") {
        document.getElementById("countdown").className = "countdown extreme";
      } else if (diff < 30) {
        document.getElementById("countdown").className = "countdown danger";
      } else if (diff < 60) {
        document.getElementById("countdown").className = "countdown warning";
      } else {
        document.getElementById("countdown").className = "countdown";
      }
    }
  }, 1000);
}

// Enhanced function to show signal popup
function showSignalPopup(targetTime, odd, signalId) {
  const popup = document.getElementById("signalPopup");
  const timeStr = targetTime.toLocaleTimeString();
  
  // Update popup content
  document.getElementById("signal-time").textContent = timeStr;
  document.getElementById("signal-odd").textContent = `${odd}x`;
  
  // Generate strategy steps
  const strategyContent = `
    <div class="strategy-step">
      <div class="step-number">1</div>
      <div>Enter at <span class="highlight">${timeStr}</span> in the next available round</div>
    </div>
    <div class="strategy-step">
      <div class="step-number">2</div>
      <div>Maintain bet until reaching <span class="highlight">${odd}x</span> target</div>
    </div>
    <div class="strategy-step">
      <div class="step-number">3</div>
      <div>Limit to maximum <span class="highlight">3 rounds</span> only</div>
    </div>
    <div class="strategy-step">
      <div class="step-number">4</div>
      <div>Use <span class="highlight">Auto Cashout</span> for consistent results</div>
    </div>
    <div class="strategy-step">
      <div class="step-number">5</div>
      <div>Cash out immediately after passing <span class="highlight">${odd}x</span></div>
    </div>
  `;
  
  document.getElementById("strategy-steps").innerHTML = strategyContent;
  
  // Start 20-second countdown
  let countdown = 20;
  document.getElementById("countdown-timer").textContent = countdown;
  
  if (signalCountdownInterval) {
    clearInterval(signalCountdownInterval);
  }
  
  signalCountdownInterval = setInterval(() => {
    countdown--;
    document.getElementById("countdown-timer").textContent = countdown;
    
    if (countdown <= 0) {
      clearInterval(signalCountdownInterval);
      closeSignalPopup();
    }
  }, 1000);
  
  // Show popup
  popup.classList.add("active");
  
  // Auto-close when signal time arrives
  const now = new Date(Date.now() + serverTimeOffset);
  const timeUntilSignal = targetTime - now;
  
  if (timeUntilSignal > 0) {
    setTimeout(() => {
      closeSignalPopup();
    }, timeUntilSignal);
  }
}

// Enhanced function to show RISK signal popup
function showRiskSignalPopup(targetTime, odd, signalId) {
  const popup = document.getElementById("riskSignalPopup");
  const timeStr = targetTime.toLocaleTimeString();
  
  // Update popup content
  document.getElementById("risk-signal-time").textContent = timeStr;
  document.getElementById("risk-signal-odd").textContent = `${odd}x`;
  
  // Generate risk management strategy steps
  let strategyContent = '';
  
  if (odd === '100') {
    strategyContent = `
      <div class="risk-strategy-step">
        <div class="risk-step-number">1</div>
        <div><span class="risk-highlight">EXTREME RISK WARNING:</span> This is a rare 100× opportunity</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">2</div>
        <div>Enter at <span class="risk-highlight">${timeStr}</span> with minimum bet amount</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">3</div>
        <div>Use <span class="risk-highlight">Auto Cashout at 100×</span> only</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">4</div>
        <div>Limit to <span class="risk-highlight">1 attempt only</span> per signal</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">5</div>
        <div>Do not chase losses if the signal fails</div>
      </div>
    `;
  } else if (odd === '10') {
    strategyContent = `
      <div class="risk-strategy-step">
        <div class="risk-step-number">1</div>
        <div><span class="risk-highlight">HIGH RISK WARNING:</span> This is a 10× signal</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">2</div>
        <div>Enter at <span class="risk-highlight">${timeStr}</span> with small bet amount</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">3</div>
        <div>Use <span class="risk-highlight">Auto Cashout at 10×</span></div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">4</div>
        <div>Limit to <span class="risk-highlight">2 attempts</span> per signal</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">5</div>
        <div>Cash out immediately if multiplier reaches 10×</div>
      </div>
    `;
  } else { // 7x
    strategyContent = `
      <div class="risk-strategy-step">
        <div class="risk-step-number">1</div>
        <div><span class="risk-highlight">RISK WARNING:</span> This is a 7× signal</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">2</div>
        <div>Enter at <span class="risk-highlight">${timeStr}</span> with moderate bet amount</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">3</div>
        <div>Use <span class="risk-highlight">Auto Cashout at 7×</span></div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">4</div>
        <div>Limit to <span class="risk-highlight">3 attempts</span> per signal</div>
      </div>
      <div class="risk-strategy-step">
        <div class="risk-step-number">5</div>
        <div>Cash out immediately if multiplier reaches 7×</div>
      </div>
    `;
  }
  
  document.getElementById("risk-strategy-steps").innerHTML = strategyContent;
  
  // Start 20-second countdown
  let countdown = 20;
  document.getElementById("risk-countdown-timer").textContent = countdown;
  
  if (riskSignalCountdownInterval) {
    clearInterval(riskSignalCountdownInterval);
  }
  
  riskSignalCountdownInterval = setInterval(() => {
    countdown--;
    document.getElementById("risk-countdown-timer").textContent = countdown;
    
    if (countdown <= 0) {
      clearInterval(riskSignalCountdownInterval);
      closeRiskSignalPopup();
    }
  }, 1000);
  
  // Show popup and play warning sound
  popup.classList.add("active");
  playWarningSound();
  
  // Auto-close when signal time arrives
  const now = new Date(Date.now() + serverTimeOffset);
  const timeUntilSignal = targetTime - now;
  
  if (timeUntilSignal > 0) {
    setTimeout(() => {
      closeRiskSignalPopup();
    }, timeUntilSignal);
  }
}

// Enhanced function to close signal popup
function closeSignalPopup() {
  const popup = document.getElementById("signalPopup");
  popup.classList.remove("active");
  activeSignalPopup = null;
  
  // Clear countdown interval
  if (signalCountdownInterval) {
    clearInterval(signalCountdownInterval);
    signalCountdownInterval = null;
  }
}

// Function to close RISK signal popup
function closeRiskSignalPopup() {
  const popup = document.getElementById("riskSignalPopup");
  popup.classList.remove("active");
  activeSignalPopup = null;
  
  // Clear countdown interval
  if (riskSignalCountdownInterval) {
    clearInterval(riskSignalCountdownInterval);
    riskSignalCountdownInterval = null;
  }
}

function checkNextSignal() {
  const now = new Date(Date.now() + serverTimeOffset);
  const history = JSON.parse(localStorage.getItem('aviatorHistory')) || [];
  
  // Find the next upcoming signal that hasn't passed yet
  const upcomingSignals = history.filter(item => {
    const signalTime = new Date(parseInt(item.timestamp));
    return signalTime > now;
  }).sort((a, b) => a.timestamp - b.timestamp);
  
  if (upcomingSignals.length > 0) {
    const nextSignal = upcomingSignals[0];
    const signalTime = new Date(parseInt(nextSignal.timestamp));
    updateCountdown(signalTime, nextSignal.odd);
  } else {
    document.getElementById("countdown").textContent = "No active signals. Create a new prediction.";
    document.getElementById("countdown").className = "countdown warning";
  }
}

function highlightActiveSignal(id) {
  const historyItems = document.querySelectorAll('.history-item');
  historyItems.forEach(item => {
    if (item.dataset.id == id) {
      item.classList.add('active', 'active-signal');
      setTimeout(() => {
        item.classList.remove('active-signal');
      }, 10000);
    }
  });
}

function removeSignal(id) {
  activeSignals = activeSignals.filter(signal => signal.id !== id);
}

// Generate WhatsApp message template
function generateWhatsAppTemplate(odd, timeStr, confidence) {
  let riskText = "";
  if (odd === "100") {
    riskText = " (EXTREME RISK - RARE OPPORTUNITY)";
    return `Xtreme Aviator Predictor - 1xBet\n\nTime: ${timeStr}\nOdd: ${odd}×${riskText}\nConfidence: ${confidence}%\n\nThis signal is generated using the XTREME AVIATOR SHA512 HASH ULTRA PREDICTOR PRO tool with AI-powered accuracy.`;
  } else if (odd === "10") {
    riskText = " (Very High Risk)";
  } else if (odd === "7") {
    riskText = " (High Risk)";
  }
  
  return `Xtreme Aviator Predictor - 1xBet\n\nTime: ${timeStr}\nOdd: ${odd}×${riskText}\n\nThis signal is generated using the XTREME AVIATOR SHA512 HASH ULTRA PREDICTOR PRO tool with AI-powered accuracy.`;
}

// Generate result copy template
function generateResultCopyTemplate() {
  const odd = document.getElementById("result-odd").textContent;
  const time = document.getElementById("result-time").textContent;
  const confidence = document.getElementById("result-confidence").textContent;
  
  if (odd === "100x") {
    return `Xtreme Aviator Predictor - 1xBet\n\nTime: ${time}\nOdd: ${odd} (EXTREME RISK - RARE OPPORTUNITY)\nConfidence: ${confidence}\n\nThis signal is generated using the XTREME AVIATOR SHA512 HASH ULTRA PREDICTOR PRO tool with AI-powered accuracy.`;
  } else if (odd === "10x") {
    return `Xtreme Aviator Predictor - 1xBet\n\nTime: ${time}\nOdd: ${odd} (Very High Risk)\n\nThis signal is generated using the XTREME AVIATOR SHA512 HASH ULTRA PREDICTOR PRO tool with AI-powered accuracy.`;
  } else if (odd === "7x") {
    return `Xtreme Aviator Predictor - 1xBet\n\nTime: ${time}\nOdd: ${odd} (High Risk)\n\nThis signal is generated using the XTREME AVIATOR SHA512 HASH ULTRA PREDICTOR PRO tool with AI-powered accuracy.`;
  } else {
    return `Xtreme Aviator Predictor - 1xBet\n\nTime: ${time}\nOdd: ${odd}\n\nThis signal is generated using the XTREME AVIATOR SHA512 HASH ULTRA PREDICTOR PRO tool with AI-powered accuracy.`;
  }
}

// Copy to clipboard function
function copyToClipboard(text) {
  const textarea = document.getElementById("copyTemplate");
  textarea.value = text;
  textarea.select();
  document.execCommand("copy");
  
  // Show feedback
  const originalText = document.activeElement.innerHTML;
  document.activeElement.innerHTML = '<i class="fas fa-check"></i> Copied!';
  setTimeout(() => {
    document.activeElement.innerHTML = originalText;
  }, 2000);
}

function copyResultToClipboard(e) {
  e.preventDefault();
  const hash = document.getElementById("hashInput").value.trim();
  if (!hash || hash.length !== 128 || !/^[a-f0-9]+$/.test(hash)) {
    showErrorDialog("Please enter a valid SHA512 hash first.");
    return;
  }
  
  if (!selectedOdd) {
    showErrorDialog("Please select an odd first.");
    return;
  }
  
  const template = generateResultCopyTemplate();
  copyToClipboard(template);
}

function copySignalToClipboard(e, odd, timeStr, confidence) {
  e.preventDefault();
  e.stopPropagation();
  const template = generateWhatsAppTemplate(odd, timeStr, confidence);
  copyToClipboard(template);
}

// History functions
function logHistory(odd, timeStr, entropy, score, delay, confidence) {
  const log = document.getElementById("historyLog");
  const entry = document.createElement("div");
  entry.className = `history-item history-multiplier-${odd}`;
  if (odd === "100") entry.classList.add('extreme');
  entry.dataset.id = Date.now();
  entry.dataset.time = new Date(Date.now() + serverTimeOffset + delay * 1000).getTime();
  
  entry.innerHTML = `
    <div class="history-time">
      <i class="far fa-clock"></i> ${new Date(Date.now() + serverTimeOffset).toLocaleTimeString()}
    </div>
    <div class="history-multiplier">
      <span>${odd}x</span>
    </div>
    <div class="history-details">
      <span><i class="fas fa-bolt"></i> ${timeStr}</span>
      <span><i class="fas fa-chart-line"></i> Score: ${score}</span>
      <span><i class="fas fa-random"></i> Entropy: ${entropy.toFixed(2)}</span>
      <span><i class="fas fa-shield-alt"></i> Confidence: ${confidence}%</span>
    </div>
    <button class="copy-btn" onclick="copySignalToClipboard(event, '${odd}', '${timeStr}', '${confidence}')">
      <i class="fas fa-copy"></i> Copy
    </button>
  `;
  
  log.insertBefore(entry, log.firstChild);
  
  // Save to localStorage
  const history = JSON.parse(localStorage.getItem('aviatorHistory')) || [];
  history.unshift({
    id: entry.dataset.id,
    time: new Date(Date.now() + serverTimeOffset).toLocaleTimeString(),
    odd,
    signalTime: timeStr,
    score,
    entropy: entropy.toFixed(2),
    delay,
    confidence,
    timestamp: entry.dataset.time,
    wasSuccessful: null,
    actualMultiplier: null
  });
  localStorage.setItem('aviatorHistory', JSON.stringify(history));
  
  // Update stats
  updateStats();
}

function updateStats() {
  const history = JSON.parse(localStorage.getItem('aviatorHistory')) || [];
  const successful = history.filter(x => x.wasSuccessful === true).length;
  const failed = history.filter(x => x.wasSuccessful === false).length;
  const total = successful + failed;
  
  // Success rate
  if (total > 0) {
    const successRate = Math.round((successful / total) * 100);
    document.getElementById("success-rate").textContent = `${successRate}%`;
  } else {
    document.getElementById("success-rate").textContent = "-";
  }
  
  // Average delay
  if (history.length > 0) {
    const avgDelay = Math.round(history.reduce((sum, item) => sum + item.delay, 0) / history.length);
    document.getElementById("avg-delay").textContent = `${avgDelay}s`;
  } else {
    document.getElementById("avg-delay").textContent = "-";
  }
  
  // Total predictions
  document.getElementById("total-predictions").textContent = history.length;
}

// Dialog functions
function showClearDialog() {
  document.getElementById("clearDialog").classList.add("active");
}

function hideClearDialog() {
  document.getElementById("clearDialog").classList.remove("active");
}

function showErrorDialog(message) {
  document.getElementById("errorMessage").textContent = message;
  document.getElementById("errorDialog").classList.add("active");
}

function hideErrorDialog() {
  document.getElementById("errorDialog").classList.remove("active");
}

function showSuccessDialog(message) {
  document.getElementById("successMessage").textContent = message;
  document.getElementById("successDialog").classList.add("active");
  playSuccessSound();
}

function hideSuccessDialog() {
  document.getElementById("successDialog").classList.remove("active");
  
  // After hiding the success dialog, check if we should show tips popup
  if (signalResultReceived) {
    setTimeout(showTipsPopup, 1000);
  }
}

function clearHistory() {
  document.getElementById("historyLog").innerHTML = '';
  localStorage.removeItem('aviatorHistory');
  document.getElementById("countdown").textContent = "No active signals. Create a new prediction.";
  document.getElementById("countdown").className = "countdown warning";
  if (currentCountdown) {
    clearInterval(currentCountdown);
    currentCountdown = null;
  }
  
  // Clear the results display
  document.getElementById("result-odd").textContent = "-";
  document.getElementById("result-entropy").textContent = "-";
  document.getElementById("result-score").textContent = "-";
  document.getElementById("result-confidence").textContent = "-";
  document.getElementById("result-delay").textContent = "-";
  document.getElementById("result-time").textContent = "-";
  
  // Reset stats
  updateStats();
  
  hideClearDialog();
}

function loadHistory() {
  const history = JSON.parse(localStorage.getItem('aviatorHistory')) || [];
  const log = document.getElementById("historyLog");
  log.innerHTML = '';
  
  // Sort by timestamp (newest first)
  history.sort((a, b) => b.timestamp - a.timestamp);
  
  history.forEach(item => {
    const entry = document.createElement("div");
    entry.className = `history-item history-multiplier-${item.odd}`;
    if (item.odd === "100") entry.classList.add('extreme');
    if (item.wasSuccessful === true) entry.classList.add('success');
    if (item.wasSuccessful === false) entry.classList.add('failure');
    entry.dataset.id = item.id;
    entry.dataset.time = item.timestamp;
    
    // Check if this signal is currently active
    const now = new Date(Date.now() + serverTimeOffset);
    const signalTime = new Date(parseInt(item.timestamp));
    if (now >= signalTime && now <= new Date(signalTime.getTime() + 10000)) {
      entry.classList.add('active');
    }
    
    // Determine the color class for the actual multiplier
    let multiplierClass = '';
    if (item.actualMultiplier) {
      if (item.actualMultiplier >= 100) {
        multiplierClass = 'actual-multiplier-100';
      } else if (item.actualMultiplier >= 10) {
        multiplierClass = 'actual-multiplier-10';
      } else if (item.actualMultiplier >= 7) {
        multiplierClass = 'actual-multiplier-7';
      } else if (item.actualMultiplier >= 4) {
        multiplierClass = 'actual-multiplier-4';
      } else if (item.actualMultiplier >= 3) {
        multiplierClass = 'actual-multiplier-3';
      } else {
        multiplierClass = 'actual-multiplier-2';
      }
    }
    
    entry.innerHTML = `
      <div class="history-time">
        <i class="far fa-clock"></i> ${item.time}
        ${item.wasSuccessful !== null ? 
          `<span class="actual-multiplier ${multiplierClass}" style="margin-left: 8px; font-size: 0.8em;">
            <i class="fas ${item.wasSuccessful ? 'fa-check' : 'fa-times'}"></i>
            ${item.actualMultiplier ? `${item.actualMultiplier}x` : ''}
          </span>` : ''}
      </div>
      <div class="history-multiplier">
        <span>${item.odd}x</span>
      </div>
      <div class="history-details">
        <span><i class="fas fa-bolt"></i> ${item.signalTime}</span>
        <span><i class="fas fa-chart-line"></i> Score: ${item.score}</span>
        <span><i class="fas fa-random"></i> Entropy: ${item.entropy}</span>
        <span><i class="fas fa-shield-alt"></i> Confidence: ${item.confidence}%</span>
      </div>
      <button class="copy-btn" onclick="copySignalToClipboard(event, '${item.odd}', '${item.signalTime}', '${item.confidence}')">
        <i class="fas fa-copy"></i> Copy
      </button>
    `;
    
    log.appendChild(entry);
  });
  
  // Check for active signals on load
  checkNextSignal();
}

// Main prediction function
function predict(oddStr) {
  const hash = document.getElementById("hashInput").value.trim().toLowerCase();
  const output = document.getElementById("output");
  
  if (!hash || hash.length !== 128 || !/^[a-f0-9]+$/.test(hash)) {
    showErrorDialog("Invalid SHA512 hash. Must be exactly 128 hexadecimal characters (0-9, a-f).");
    return;
  }
  
  selectedOdd = oddStr;
  const entropy = calcEntropy(hash);
  const score = scoreFromHash(hash);
  const confidence = calculateConfidence(entropy, score, oddStr, hash);
  const delay = calculateDelay(score, entropy, oddStr, hash);
  const future = new Date(Date.now() + serverTimeOffset + delay * 1000);
  const timeStr = future.toLocaleTimeString();
  
  // Update results display
  displayResults(oddStr, entropy, score, delay, confidence);
  
  output.style.display = 'block';
  updateCountdown(future, oddStr);
  logHistory(oddStr, timeStr, entropy, score, delay, confidence);
  showSuccessDialog(`Signal for ${oddStr}x generated with ${confidence}% confidence!`);
  
  // Scroll to results
  output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  // Set flag that first signal has been generated
  firstSignalGenerated = true;
}

// Function to record actual results (call this after a round completes)
function recordResult(signalId, actualMultiplier) {
  const history = JSON.parse(localStorage.getItem('aviatorHistory')) || [];
  const signalIndex = history.findIndex(item => item.id == signalId);
  
  if (signalIndex !== -1) {
    history[signalIndex].actualMultiplier = actualMultiplier;
    history[signalIndex].wasSuccessful = actualMultiplier >= parseInt(history[signalIndex].odd);
    localStorage.setItem('aviatorHistory', JSON.stringify(history));
    loadHistory(); // Refresh the display
    updateStats();
    
    // Set flag that we've received a signal result
    signalResultReceived = true;
    
    // Show result notification
    const resultMessage = `Result recorded! Multiplier: ${actualMultiplier}x - ${
      history[signalIndex].wasSuccessful ? 'SUCCESS!' : 'TRY AGAIN'
    }`;
    
    // Create a temporary element to check if message contains "TRY AGAIN"
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = resultMessage;
    const isFailure = tempDiv.textContent.includes('TRY AGAIN');
    
    // Update the dialog message with appropriate styling
    const messageElement = document.getElementById("successMessage");
    messageElement.innerHTML = isFailure 
      ? `<span class="failed-signal-message">${resultMessage}</span>`
      : resultMessage;
    
    showSuccessDialog(resultMessage);
  }
}

// Auto result tracking simulation (for demo purposes)
function simulateAutoTracking() {
  setInterval(() => {
    const history = JSON.parse(localStorage.getItem('aviatorHistory')) || [];
    if (history.length > 0 && history[0].wasSuccessful === null) {
      // Simulate a random result between 1x and 150x (with very low chance for 100x+)
      let actualMultiplier;
      if (Math.random() < 0.01) { // 1% chance for 100x+
        actualMultiplier = (Math.random() * 50 + 100).toFixed(2);
      } else {
        actualMultiplier = (Math.random() * 14 + 1).toFixed(2);
      }
      recordResult(history[0].id, parseFloat(actualMultiplier));
    }
  }, 10000); // Check every 10 seconds
}

// Start simulation (remove in production)
simulateAutoTracking();