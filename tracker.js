const categories = {
  Seeds: "seed",
  Gear: "gear",
  Eggs: "egg",
  Cosmetics: "cosmetic"
};

const loadingScreen = document.getElementById('loading-screen');
let firstLoad = true;

const status = {
  lastUpdatedEl: document.getElementById('last-updated'),
  nextUpdateEl: document.getElementById('next-update'),
  totalItemsEl: document.getElementById('total-items'),
  totalStockEl: document.getElementById('total-stock'),
  lowStockEl: document.getElementById('low-stock'),
};

let countdownInterval = null;
let refreshTimeout = null;

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function msUntilNext5MinuteMark() {
  const now = new Date();
  const ms = now.getTime();
  const next = new Date(now);

  const minutes = now.getMinutes();
  const nextMultiple = Math.ceil(minutes / 5) * 5;
  next.setMinutes(nextMultiple);
  next.setSeconds(0);
  next.setMilliseconds(0);

  if (next <= now) {
    next.setMinutes(next.getMinutes() + 5);
  }

  return next.getTime() - ms;
}

async function fetchData() {
  if (firstLoad) {
    loadingScreen.classList.remove('hidden');
  }

  // Use your preferred CORS proxy or a working one
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

function updateStatusTexts(msUntilNextUpdate) {
  const now = new Date();
  status.lastUpdatedEl.textContent = `🕐 Last Updated: ${formatTime(now)}`;

  if (countdownInterval) clearInterval(countdownInterval);

  let secondsLeft = Math.round(msUntilNextUpdate / 1000);
  status.nextUpdateEl.textContent = `🔄 Next update: ${secondsLeft}s`;

  countdownInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft < 0) secondsLeft = 0;
    status.nextUpdateEl.textContent = `🔄 Next update: ${secondsLeft}s`;
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

    const msToNextUpdate = msUntilNext5MinuteMark();

    updateStatusTexts(msToNextUpdate);

    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(refresh, msToNextUpdate);

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

  // Dark mode toggle button logic
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

  // Refresh button logic
  const refreshButton = document.getElementById('refresh-button');
  refreshButton.addEventListener('click', () => {
    loadingScreen.classList.remove('hidden');
    refresh();
  });
};
