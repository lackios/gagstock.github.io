let countdownInterval = null;
let refreshTimeout = null;

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}
function parseCountdownString(str) {
  if (!str) return 0;
  let total = 0;
  const parts = str.split(' ');
  parts.forEach(part => {
    if (part.endsWith('m')) {
      total += parseInt(part) * 60;
    } else if (part.endsWith('s')) {
      total += parseInt(part);
    }
  });
  return total;
}

async function fetchData() {
  if (firstLoad) {
    loadingScreen.classList.remove('hidden');
  }

  const corsProxy = "https://corsproxy.io/?";
  const apiUrl = corsProxy + encodeURIComponent('https://gagstock.gleeze.com/grow-a-garden');

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error("API error: " + res.status);
  const json = await res.json();
  return json.data;
}

function updateStock(data) {
  let hasItems = false;
  let totalItemsCount = 0;
  let totalStockCount = 0;
  let lowStockCount = 0;
  const LOW_STOCK_THRESHOLD = 5;

  Object.entries(categories).forEach(([displayName, key]) => {
    const categoryData = data[key];
    if (!categoryData) return;

    const ul = document.querySelector(`#${displayName} ul`);
    if (!ul) return;

    ul.innerHTML = '';

    categoryData.items.forEach(item => {
      totalItemsCount++;
      totalStockCount += item.quantity;
      if (item.quantity > 0) hasItems = true;
      if (item.quantity > 0 && item.quantity <= LOW_STOCK_THRESHOLD) lowStockCount++;

      const li = document.createElement('li');
      li.textContent = `${item.emoji ?? ''} ${item.name} (${item.quantity}x)`;
      li.className = item.quantity > 0 ? 'in-stock' : 'out-stock';
      ul.appendChild(li);
    });

    // Show countdown from API
    const countdownStr = categoryData.countdown;
    const timerP = document.querySelector(`#${displayName}-timer`);
    if (timerP) {
      timerP.textContent = countdownStr ? `Restock in: ${countdownStr}` : '';
    }
  });

  status.totalItemsEl.textContent = totalItemsCount;
  status.totalStockEl.textContent = totalStockCount;
  status.lowStockEl.textContent = lowStockCount;

  return hasItems;
}

// Format seconds into "Xm Ys" or "Xs"
function formatSeconds(seconds) {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}

function updateStatusTexts(secondsLeft) {
  const now = new Date();
  status.lastUpdatedEl.textContent = `🕐 Last Updated: ${formatTime(now)}`;

  if (countdownInterval) clearInterval(countdownInterval);

  status.nextUpdateEl.textContent = `🔄 Next update: ${formatSeconds(secondsLeft)}`;

  countdownInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft < 0) secondsLeft = 0;
    status.nextUpdateEl.textContent = `🔄 Next update: ${formatSeconds(secondsLeft)}`;
  }, 1000);
}

async function refresh() {
  try {
    const data = await fetchData();
    const hasItems = updateStock(data);

    if (hasItems) {
      loadingScreen.classList.add('hidden');
      loadingScreen.querySelector('.loader').textContent = "Loading Grow a Garden Stock...";
    } else {
      loadingScreen.classList.remove('hidden');
      loadingScreen.querySelector('.loader').textContent = "No stock available right now.";
    }

    // Find shortest countdown in seconds from all categories
    const countdownSecondsArray = Object.values(categories).map(key => {
      const cat = data[key];
      if (!cat || !cat.countdown) return null;
      return parseCountdownString(cat.countdown);
    }).filter(v => v !== null && v > 0);

    // Use shortest countdown + 1 second delay, or fallback to 5-minute mark logic
    let nextUpdateSeconds;
    if (countdownSecondsArray.length > 0) {
      nextUpdateSeconds = Math.min(...countdownSecondsArray) + 1;
    } else {
      // fallback
      nextUpdateSeconds = Math.ceil(msUntilNext5MinuteMark() / 1000);
    }

    updateStatusTexts(nextUpdateSeconds * 1);

    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(refresh, nextUpdateSeconds * 1000);

  } catch (error) {
    console.error(error);
    loadingScreen.classList.remove('hidden');
    loadingScreen.querySelector('.loader').textContent = "Error loading data.";

    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(refresh, 5000);
  } finally {
    firstLoad = false;
  }
}

window.onload = () => {
  refresh();

  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    darkModeToggle.textContent = '☀️';
  }

  darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
      darkModeToggle.textContent = '☀️';
      localStorage.setItem('darkMode', 'enabled');
    } else {
      darkModeToggle.textContent = '🌙';
      localStorage.setItem('darkMode', 'disabled');
    }
  });

  const refreshButton = document.getElementById('refresh-button');
  refreshButton.addEventListener('click', () => {
    loadingScreen.classList.remove('hidden');
    refresh();
  });
};
