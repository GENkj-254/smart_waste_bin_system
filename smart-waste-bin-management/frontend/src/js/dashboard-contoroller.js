// dashboard-controller.js for smart_waste_dashboard.html

class DashboardController {
  constructor() {
    this.apiBaseUrl = 'https://localhost:5000/api';
    this.wsUrl = 'wss://smart-waste-bin-management-system.onrender.com/ws';
    this.userSession = {
      username: localStorage.getItem('username') || 'User',
      role: localStorage.getItem('role') || 'User',
      token: localStorage.getItem('token') || '',
      lastLogin: localStorage.getItem('lastLogin') || new Date().toISOString(),
    };
    this.binData = [];
    this.init();
  }

  init() {
    this.setUserInfo();
    this.loadBins();
    this.connectWebSocket();
    this.setupControls();
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
  }

  setUserInfo() {
    document.getElementById('username').textContent = this.userSession.username;
    document.getElementById('role').textContent = this.userSession.role;
    document.getElementById('lastLogin').textContent = new Date(this.userSession.lastLogin).toLocaleString();
    if (this.userSession.role === 'Administrator') {
      document.body.classList.add('admin-visible');
    }
  }

  updateClock() {
    const now = new Date();
    document.getElementById('dateNow').textContent = now.toLocaleDateString();
    document.getElementById('timeNow').textContent = now.toLocaleTimeString();
  }

  setupControls() {
    const fontSizeInput = document.getElementById('fontSize');
    fontSizeInput.addEventListener('change', () => {
      document.documentElement.style.setProperty('--font-size', fontSizeInput.value);
    });

    const thresholdInput = document.getElementById('alertThreshold');
    if (thresholdInput) {
      thresholdInput.addEventListener('input', () => {
        document.getElementById('thresholdValue').textContent = thresholdInput.value + '%';
      });
    }
  }

  async loadBins() {
    try {
      const res = await fetch(`${this.apiBaseUrl}/bins`, {
        headers: { Authorization: `Bearer ${this.userSession.token}` }
      });
      if (!res.ok) throw new Error('Failed to load bins');
      this.binData = await res.json();
      this.renderStatus();
      this.renderChart();
    } catch (err) {
      this.notify('⚠️ Failed to load bin data', 'error');
    }
  }

  renderStatus() {
    if (!this.binData.length) return;
    const latest = this.binData[0];
    const icon = latest.fillLevel >= 80 ? '⚠️' : latest.fillLevel >= 50 ? '🔔' : '✅';
    const iconClass = latest.fillLevel >= 80 ? 'status-red' : latest.fillLevel >= 50 ? 'status-yellow' : 'status-green';
    document.getElementById('binStatus').textContent = `Bin ${latest.binId}: ${latest.fillLevel}% full`;
    const iconSpan = document.getElementById('statusIcon');
    iconSpan.textContent = icon;
    iconSpan.className = 'status-icon ' + iconClass;
  }

  renderChart() {
    const ctx = document.getElementById('fillChart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.binData.map(b => `Bin ${b.binId}`),
        datasets: [{
          label: 'Fill Level (%)',
          data: this.binData.map(b => b.fillLevel),
          backgroundColor: this.binData.map(b => b.fillLevel >= 80 ? '#e74c3c' : b.fillLevel >= 50 ? '#f39c12' : '#27ae60')
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });
  }

  connectWebSocket() {
    try {
      const socket = new WebSocket(this.wsUrl);
      socket.onopen = () => this.notify('🔌 WebSocket connected', 'success');
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'bin_update') {
          const updated = data.payload;
          const i = this.binData.findIndex(b => b.binId === updated.binId);
          if (i !== -1) this.binData[i] = updated;
          this.renderStatus();
          this.renderChart();
        }
      };
      socket.onclose = () => this.notify('⚠️ WebSocket disconnected', 'warning');
    } catch (err) {
      this.notify('WebSocket failed', 'error');
    }
  }

  notify(msg, type) {
    const bar = document.createElement('div');
    bar.textContent = msg;
    bar.className = `info-box ${type}`;
    document.getElementById('notifications').appendChild(bar);
    setTimeout(() => bar.remove(), 4000);
  }

  addNewBin() {
    const binId = Math.floor(Math.random() * 9999);
    const location = prompt('Enter new bin location:');
    if (!location) return;

    const newBin = {
      binId,
      location,
      fillLevel: 0,
      batteryLevel: 100,
      temperature: 24
    };

    fetch(`${this.apiBaseUrl}/bins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.userSession.token}`
      },
      body: JSON.stringify(newBin)
    })
    .then(res => res.json())
    .then(data => {
      this.notify('✅ New bin added successfully!', 'success');
      this.loadBins();
    })
    .catch(err => {
      console.error(err);
      this.notify('❌ Failed to add bin.', 'error');
    });
  }
}

// Initialize when page loads
let dashboardController;
document.addEventListener('DOMContentLoaded', () => {
  dashboardController = new DashboardController();
  window.changePassword = () => alert('🔐 Password change feature coming soon');
  window.logout = () => {
    localStorage.clear();
    alert('You have been logged out');
    location.reload();
  };
});
    