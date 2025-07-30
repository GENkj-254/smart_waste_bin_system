// api-service.js - Centralized API service for Smart Waste Management System

class ApiService {
  constructor(baseUrl = ' https://6aa4f3e9c19f.ngrok-free.app/api') {
    this.baseUrl = baseUrl;
    this.token = null;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.timeout = 10000;
    
    // Request interceptors
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    
    this.init();
  }
  
  init() {
    // Add default request interceptor for authentication
    this.addRequestInterceptor((config) => {
      if (this.token) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${this.token}`
        };
      }
      return config;
    });
    
    // Add default response interceptor for error handling
    this.addResponseInterceptor(
      (response) => response,
      (error) => this.handleResponseError(error)
    );
  }
  
  setToken(token) {
    this.token = token;
  }
  
  getToken() {
    return this.token;
  }
  
  clearToken() {
    this.token = null;
  }
  
  addRequestInterceptor(onFulfilled, onRejected) {
    this.requestInterceptors.push({ onFulfilled, onRejected });
  }
  
  addResponseInterceptor(onFulfilled, onRejected) {
    this.responseInterceptors.push({ onFulfilled, onRejected });
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    let config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: this.timeout,
      ...options
    };
    
    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      if (interceptor.onFulfilled) {
        try {
          config = interceptor.onFulfilled(config);
        } catch (error) {
          if (interceptor.onRejected) {
            config = interceptor.onRejected(error);
          } else {
            throw error;
          }
        }
      }
    }
    
    let lastError;
    
    // Retry logic
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Apply response interceptors
        let processedResponse = response;
        for (const interceptor of this.responseInterceptors) {
          if (interceptor.onFulfilled) {
            try {
              processedResponse = await interceptor.onFulfilled(processedResponse);
            } catch (error) {
              if (interceptor.onRejected) {
                processedResponse = await interceptor.onRejected(error);
              } else {
                throw error;
              }
            }
          }
        }
        
        return processedResponse;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except 408, 429
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          if (error.response.status !== 408 && error.response.status !== 429) {
            break;
          }
        }
        
        // Wait before retry
        if (attempt < this.retryAttempts - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError;
  }
  
  async handleResponseError(error) {
    console.error('API Error:', error);
    
    // Handle different types of errors
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    if (error.response) {
      const errorData = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: null
      };
      
      try {
        errorData.data = await error.response.json();
      } catch (parseError) {
        errorData.data = { message: 'Unknown error occurred' };
      }
      
      // Handle specific status codes
      switch (error.response.status) {
        case 401:
          this.clearToken();
          throw new Error('Authentication required');
        case 403:
          throw new Error('Access forbidden');
        case 404:
          throw new Error('Resource not found');
        case 429:
          throw new Error('Too many requests');
        case 500:
          throw new Error('Internal server error');
        default:
          throw new Error(errorData.data.message || 'API request failed');
      }
    }
    
    if (error.message === 'Failed to fetch') {
      throw new Error('Network connection failed');
    }
    
    throw error;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // HTTP method helpers
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url);
  }
  
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  async patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
  
  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
  
  // File upload helper
  async uploadFile(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });
    
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    });
  }
}

// Specific API endpoints for Smart Waste Management System
class SmartWasteApi extends ApiService {
  constructor(baseUrl) {
    super(baseUrl);
  }
  
  // Authentication endpoints
  async login(credentials) {
    try {
      const response = await this.post('/auth/login', credentials);
      const data = await response.json();
      
      if (data.token) {
        this.setToken(data.token);
      }
      
      return data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }
  
  async register(userData) {
    try {
      const response = await this.post('/register', userData);
      return await response.json();
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }
  
  async logout() {
    try {
      await this.post('/auth/logout');
      this.clearToken();
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear token anyway
      this.clearToken();
    }
  }
  
  async refreshToken() {
    try {
      const response = await this.post('/auth/refresh');
      const data = await response.json();
      
      if (data.token) {
        this.setToken(data.token);
      }
      
      return data;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearToken();
      throw error;
    }
  }
  
  // Bin management endpoints
  async getBins(filters = {}) {
    try {
      const response = await this.get('/bins', filters);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch bins:', error);
      throw error;
    }
  }
  
  async getBin(binId) {
    try {
      const response = await this.get(`/bins/${binId}`);
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch bin ${binId}:`, error);
      throw error;
    }
  }
  
  async createBin(binData) {
    try {
      const response = await this.post('/bins', binData);
      return await response.json();
    } catch (error) {
      console.error('Failed to create bin:', error);
      throw error;
    }
  }
  
  async updateBin(binId, updateData) {
    try {
      const response = await this.put(`/bins/${binId}`, updateData);
      return await response.json();
    } catch (error) {
      console.error(`Failed to update bin ${binId}:`, error);
      throw error;
    }
  }
  
  async deleteBin(binId) {
    try {
      const response = await this.delete(`/bins/${binId}`);
      return await response.json();
    } catch (error) {
      console.error(`Failed to delete bin ${binId}:`, error);
      throw error;
    }
  }
  
  // Bin data endpoints
  async getBinData(binId, timeframe = '24h') {
    try {
      const response = await this.get(`/bins/${binId}/data`, { timeframe });
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch bin data for ${binId}:`, error);
      throw error;
    }
  }
  
  async getLatestBinData() {
    try {
      const response = await this.get('/bin-data/latest');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch latest bin data:', error);
      throw error;
    }
  }
  
  async getBinHistory(binId, startDate, endDate) {
    try {
      const params = { binId };
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();
      
      const response = await this.get('/bin-data/history', params);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch bin history:', error);
      throw error;
    }
  }
  
  async updateBinData(binId, sensorData) {
    try {
      const response = await this.post(`/bins/${binId}/data`, sensorData);
      return await response.json();
    } catch (error) {
      console.error(`Failed to update bin data for ${binId}:`, error);
      throw error;
    }
  }
  
  // Collection management endpoints
  async getCollections(filters = {}) {
    try {
      const response = await this.get('/collections', filters);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch collections:', error);
      throw error;
    }
  }
  
  async scheduleCollection(binId, scheduledTime, priority = 'normal') {
    try {
      const response = await this.post('/collections', {
        binId,
        scheduledTime,
        priority,
        status: 'scheduled'
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to schedule collection:', error);
      throw error;
    }
  }
  
  async updateCollectionStatus(collectionId, status, notes = '') {
    try {
      const response = await this.patch(`/collections/${collectionId}`, {
        status,
        notes,
        completedAt: status === 'completed' ? new Date().toISOString() : null
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to update collection status:', error);
      throw error;
    }
  }
  
  async getOptimizedRoute(binIds) {
    try {
      const response = await this.post('/collections/optimize-route', { binIds });
      return await response.json();
    } catch (error) {
      console.error('Failed to get optimized route:', error);
      throw error;
    }
  }
  
  // Analytics endpoints
  async getAnalytics(timeframe = '7d', metrics = []) {
    try {
      const response = await this.get('/analytics', { timeframe, metrics: metrics.join(',') });
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      throw error;
    }
  }
  
  async getPredictions(binIds, days = 7) {
    try {
      const response = await this.post('/analytics/predictions', { binIds, days });
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
      throw error;
    }
  }
  
  async getInsights(timeframe = '30d') {
    try {
      const response = await this.get('/analytics/insights', { timeframe });
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch insights:', error);
      throw error;
    }
  }
  
  async detectAnomalies(binId, timeframe = '24h') {
    try {
      const response = await this.get(`/analytics/anomalies/${binId}`, { timeframe });
      return await response.json();
    } catch (error) {
      console.error('Failed to detect anomalies:', error);
      throw error;
    }
  }
  
  // Notification endpoints
  async getNotifications(filters = {}) {
    try {
      const response = await this.get('/notifications', filters);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      throw error;
    }
  }
  
  async markNotificationRead(notificationId) {
    try {
      const response = await this.patch(`/notifications/${notificationId}`, { read: true });
      return await response.json();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }
  
  async createNotification(notificationData) {
    try {
      const response = await this.post('/notifications', notificationData);
      return await response.json();
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }
  
  // User management endpoints
  async getProfile() {
    try {
      const response = await this.get('/users/profile');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      throw error;
    }
  }
  
  async updateProfile(profileData) {
    try {
      const response = await this.patch('/users/profile', profileData);
      return await response.json();
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }
  
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await this.post('/users/change-password', {
        currentPassword,
        newPassword
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to change password:', error);
      throw error;
    }
  }
  
  async getUsers(filters = {}) {
    try {
      const response = await this.get('/users', filters);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch users:', error);
      throw error;
    }
  }
  
  // Settings endpoints
  async getSettings() {
    try {
      const response = await this.get('/settings');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      throw error;
    }
  }
  
  async updateSettings(settings) {
    try {
      const response = await this.patch('/settings', settings);
      return await response.json();
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }
  
  // System health endpoints
  async getSystemHealth() {
    try {
      const response = await this.get('/system/health');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      throw error;
    }
  }
  
  async getSystemStats() {
    try {
      const response = await this.get('/system/stats');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch system stats:', error);
      throw error;
    }
  }
  
  // Maintenance endpoints
  async getMaintenanceSchedule() {
    try {
      const response = await this.get('/maintenance');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch maintenance schedule:', error);
      throw error;
    }
  }
  
  async scheduleMaintenance(binId, maintenanceType, scheduledDate, notes = '') {
    try {
      const response = await this.post('/maintenance', {
        binId,
        maintenanceType,
        scheduledDate,
        notes,
        status: 'scheduled'
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to schedule maintenance:', error);
      throw error;
    }
  }
  
  async updateMaintenanceStatus(maintenanceId, status, completionNotes = '') {
    try {
      const response = await this.patch(`/maintenance/${maintenanceId}`, {
        status,
        completionNotes,
        completedAt: status === 'completed' ? new Date().toISOString() : null
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to update maintenance status:', error);
      throw error;
    }
  }
  
  // Report endpoints
  async generateReport(reportType, params = {}) {
    try {
      const response = await this.post('/reports/generate', {
        reportType,
        ...params
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw error;
    }
  }
  
  async getReports(filters = {}) {
    try {
      const response = await this.get('/reports', filters);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      throw error;
    }
  }
  
  async downloadReport(reportId) {
    try {
      const response = await this.get(`/reports/${reportId}/download`);
      return response; // Return response for blob handling
    } catch (error) {
      console.error('Failed to download report:', error);
      throw error;
    }
  }
}

// WebSocket manager for real-time updates
class WebSocketManager {
  constructor(url, apiService) {
    this.url = url;
    this.apiService = apiService;
    this.connection = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = 30000;
    this.heartbeatTimer = null;
    this.listeners = new Map();
    this.isConnected = false;
  }
  
  connect() {
    try {
      this.connection = new WebSocket(this.url);
      
      this.connection.onopen = () => {
        console.log('🔌 WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected');
      };
      
      this.connection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.connection.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
      
      this.connection.onerror = (error) => {
        console.error('🔌 WebSocket error:', error);
        this.emit('error', error);
      };
      
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }
  
  disconnect() {
    if (this.connection) {
      this.connection.close(1000, 'Client disconnect');
    }
    this.stopHeartbeat();
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }
    
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`🔌 Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      }
    }, this.heartbeatInterval);
  }
  
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  send(data) {
    if (this.isConnected && this.connection.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }
  
  handleMessage(data) {
    switch (data.type) {
      case 'pong':
        // Heartbeat response
        break;
      case 'bin_update':
        this.emit('binUpdate', data.payload);
        break;
      case 'alert':
        this.emit('alert', data.payload);
        break;
      case 'notification':
        this.emit('notification', data.payload);
        break;
      case 'system_status':
        this.emit('systemStatus', data.payload);
        break;
      default:
        this.emit('message', data);
        break;
    }
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket event callback:', error);
        }
      });
    }
  }
}

// Export classes for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ApiService, SmartWasteApi, WebSocketManager };
} else {
  window.ApiService = ApiService;
  window.SmartWasteApi = SmartWasteApi;
  window.WebSocketManager = WebSocketManager;
}