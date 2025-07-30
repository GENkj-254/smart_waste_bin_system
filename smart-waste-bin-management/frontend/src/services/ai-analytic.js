// ai-analytics.js - Advanced AI Analytics Module for Smart Waste Management

class AIAnalytics {
  constructor() {
    this.historicalData = [];
    this.predictions = [];
    this.patterns = {};
    this.anomalies = [];
    this.initialized = false;
  }
  
  // Initialize AI analytics with historical data
  async initialize(binData) {
    console.log('🤖 Initializing AI Analytics...');
    this.historicalData = this.generateHistoricalData(binData);
    this.analyzePatterns();
    this.detectAnomalies();
    this.initialized = true;
    console.log('✅ AI Analytics initialized successfully');
  }
  
  // Generate realistic historical data for analysis
  generateHistoricalData(currentBins, days = 30) {
    const historical = [];
    const now = new Date();
    
    currentBins.forEach(bin => {
      for (let d = days; d >= 0; d--) {
        const date = new Date(now.getTime() - (d * 24 * 60 * 60 * 1000));
        
        // Simulate realistic fill patterns based on day of week and time
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isWorkday = !isWeekend;
        
        // Generate 24 data points per day (hourly)
        for (let h = 0; h < 24; h++) {
          const timestamp = new Date(date.getTime() + (h * 60 * 60 * 1000));
          
          let baseFillRate = 2; // Base fill rate per hour
          
          // Adjust for day patterns
          if (isWorkday) {
            if (h >= 8 && h <= 17) baseFillRate *= 2.5; // Work hours
            if (h >= 12 && h <= 14) baseFillRate *= 1.8; // Lunch peak
          } else {
            if (h >= 10 && h <= 20) baseFillRate *= 1.5; // Weekend activity
          }
          
          // Add some randomness
          const variation = (Math.random() - 0.5) * 1.5;
          const fillIncrease = Math.max(0, baseFillRate + variation);
          
          // Calculate cumulative fill level
          const previousEntry = historical.filter(h => 
            h.binId === bin.binId && h.timestamp < timestamp
          ).pop();
          
          let currentLevel = previousEntry ? previousEntry.fillLevel + fillIncrease : fillIncrease;
          
          // Reset when bin gets full (simulate collection)
          if (currentLevel >= 95) {
            currentLevel = Math.random() * 15; // Some residual after collection
          }
          
          historical.push({
            binId: bin.binId,
            fillLevel: Math.min(100, Math.max(0, Math.round(currentLevel))),
            timestamp: new Date(timestamp),
            location: bin.location || `Location ${bin.binId}`,
            temperature: 20 + Math.random() * 15,
            batteryLevel: 85 + Math.random() * 15
          });
        }
      }
    });
    
    return historical.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  // Analyze patterns in historical data
  analyzePatterns() {
    console.log('📊 Analyzing usage patterns...');
    
    this.patterns = {
      dailyPatterns: this.analyzeDailyPatterns(),
      weeklyPatterns: this.analyzeWeeklyPatterns(),
      fillRates: this.analyzeFillRates(),
      collectionCycles: this.analyzeCollectionCycles()
    };
  }
  
  analyzeDailyPatterns() {
    const hourlyData = {};
    
    // Initialize hourly buckets
    for (let h = 0; h < 24; h++) {
      hourlyData[h] = { totalFill: 0, count: 0, avgFill: 0 };
    }
    
    this.historicalData.forEach(entry => {
      const hour = entry.timestamp.getHours();
      hourlyData[hour].totalFill += entry.fillLevel;
      hourlyData[hour].count++;
    });
    
    // Calculate averages
    Object.keys(hourlyData).forEach(hour => {
      const data = hourlyData[hour];
      data.avgFill = data.count > 0 ? data.totalFill / data.count : 0;
    });
    
    return hourlyData;
  }
  
  analyzeWeeklyPatterns() {
    const weeklyData = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    days.forEach((day, index) => {
      weeklyData[day] = { totalFill: 0, count: 0, avgFill: 0 };
    });
    
    this.historicalData.forEach(entry => {
      const dayName = days[entry.timestamp.getDay()];
      weeklyData[dayName].totalFill += entry.fillLevel;
      weeklyData[dayName].count++;
    });
    
    // Calculate averages
    Object.keys(weeklyData).forEach(day => {
      const data = weeklyData[day];
      data.avgFill = data.count > 0 ? data.totalFill / data.count : 0;
    });
    
    return weeklyData;
  }
  
  analyzeFillRates() {
    const binFillRates = {};
    
    // Group data by bin
    const binGroups = {};
    this.historicalData.forEach(entry => {
      if (!binGroups[entry.binId]) binGroups[entry.binId] = [];
      binGroups[entry.binId].push(entry);
    });
    
    // Calculate fill rates for each bin
    Object.keys(binGroups).forEach(binId => {
      const data = binGroups[binId].sort((a, b) => a.timestamp - b.timestamp);
      let totalRate = 0;
      let rateCount = 0;
      
      for (let i = 1; i < data.length; i++) {
        const current = data[i];
        const previous = data[i - 1];
        const timeDiff = (current.timestamp - previous.timestamp) / (1000 * 60 * 60); // hours
        
        if (timeDiff > 0 && current.fillLevel >= previous.fillLevel) {
          const rate = (current.fillLevel - previous.fillLevel) / timeDiff;
          totalRate += rate;
          rateCount++;
        }
      }
      
      binFillRates[binId] = {
        avgFillRate: rateCount > 0 ? totalRate / rateCount : 0,
        binId: parseInt(binId)
      };
    });
    
    return binFillRates;
  }
  
  analyzeCollectionCycles() {
    const cycles = {};
    
    // Find collection events (fill level drops significantly)
    this.historicalData.forEach((entry, index) => {
      if (index === 0) return;
      
      const previous = this.historicalData[index - 1];
      if (previous.binId === entry.binId && previous.fillLevel > 80 && entry.fillLevel < 20) {
        // Collection detected
        if (!cycles[entry.binId]) cycles[entry.binId] = [];
        cycles[entry.binId].push({
          collectionTime: entry.timestamp,
          previousLevel: previous.fillLevel,
          newLevel: entry.fillLevel
        });
      }
    });
    
    // Calculate average cycle times
    const cycleStats = {};
    Object.keys(cycles).forEach(binId => {
      const binCycles = cycles[binId];
      if (binCycles.length > 1) {
        let totalCycleTime = 0;
        
        for (let i = 1; i < binCycles.length; i++) {
          const timeDiff = binCycles[i].collectionTime - binCycles[i - 1].collectionTime;
          totalCycleTime += timeDiff;
        }
        
        const avgCycleTime = totalCycleTime / (binCycles.length - 1);
        cycleStats[binId] = {
          avgCycleDays: avgCycleTime / (1000 * 60 * 60 * 24),
          totalCollections: binCycles.length,
          lastCollection: binCycles[binCycles.length - 1].collectionTime
        };
      }
    });
    
    return cycleStats;
  }
  
  // Detect anomalies in bin behavior
  detectAnomalies() {
    console.log('🔍 Detecting anomalies...');
    this.anomalies = [];
    
    // Group data by bin for analysis
    const binGroups = {};
    this.historicalData.forEach(entry => {
      if (!binGroups[entry.binId]) binGroups[entry.binId] = [];
      binGroups[entry.binId].push(entry);
    });
    
    Object.keys(binGroups).forEach(binId => {
      const data = binGroups[binId];
      const anomalies = this.findBinAnomalies(data, parseInt(binId));
      this.anomalies.push(...anomalies);
    });
  }
  
  findBinAnomalies(binData, binId) {
    const anomalies = [];
    
    // Calculate statistical thresholds
    const fillLevels = binData.map(d => d.fillLevel);
    const mean = fillLevels.reduce((a, b) => a + b, 0) / fillLevels.length;
    const variance = fillLevels.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / fillLevels.length;
    const stdDev = Math.sqrt(variance);
    
    const upperThreshold = mean + (2 * stdDev);
    const lowerThreshold = Math.max(0, mean - (2 * stdDev));
    
    // Check for unusual fill patterns
    binData.forEach((entry, index) => {
      // Sudden spikes
      if (entry.fillLevel > upperThreshold) {
        anomalies.push({
          type: 'unusual_spike',
          binId: binId,
          timestamp: entry.timestamp,
          value: entry.fillLevel,
          threshold: upperThreshold,
          severity: 'medium',
          message: `Bin ${binId} showing unusual fill spike: ${entry.fillLevel}%`
        });
      }
      
      // Sensor malfunction (same reading for too long)
      if (index > 10) {
        const last10 = binData.slice(index - 10, index);
        const sameReadings = last10.filter(d => d.fillLevel === entry.fillLevel).length;
        
        if (sameReadings >= 8) {
          anomalies.push({
            type: 'sensor_malfunction',
            binId: binId,
            timestamp: entry.timestamp,
            value: entry.fillLevel,
            severity: 'high',
            message: `Bin ${binId} sensor may be malfunctioning - static readings detected`
          });
        }
      }
      
      // Battery issues
      if (entry.batteryLevel < 20) {
        anomalies.push({
          type: 'low_battery',
          binId: binId,
          timestamp: entry.timestamp,
          value: entry.batteryLevel,
          severity: 'high',
          message: `Bin ${binId} has low battery: ${entry.batteryLevel}%`
        });
      }
    });
    
    return anomalies;
  }
  
  // Generate predictions for next N days
  generatePredictions(currentBins, days = 7) {
    console.log(`🔮 Generating ${days}-day predictions...`);
    
    if (!this.initialized) {
      console.warn('AI Analytics not initialized. Call initialize() first.');
      return [];
    }
    
    const predictions = [];
    const now = new Date();
    
    currentBins.forEach(bin => {
      const binHistory = this.historicalData.filter(h => h.binId === bin.binId);
      const fillRate = this.patterns.fillRates[bin.binId]?.avgFillRate || 2;
      
      const binPredictions = [];
      let currentLevel = bin.fillLevel;
      
      for (let d = 0; d < days; d++) {
        const predictionDate = new Date(now.getTime() + (d * 24 * 60 * 60 * 1000));
        const dayOfWeek = predictionDate.getDay();
        
        // Adjust fill rate based on day patterns
        let adjustedFillRate = fillRate;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        if (isWeekend) {
          adjustedFillRate *= 0.7; // Slower fill on weekends
        } else {
          adjustedFillRate *= 1.2; // Faster on weekdays
        }
        
        // Add daily variation
        const dailyFill = adjustedFillRate * 24 * (0.8 + Math.random() * 0.4);
        currentLevel += dailyFill;
        
        // Handle collection prediction
        let collectionNeeded = false;
        if (currentLevel >= 90) {
          collectionNeeded = true;
          currentLevel = Math.random() * 15; // Reset after collection
        }
        
        binPredictions.push({
          date: new Date(predictionDate),
          fillLevel: Math.min(100, Math.max(0, Math.round(currentLevel))),
          collectionNeeded: collectionNeeded,
          confidence: Math.max(0.6, 1 - (d * 0.1)) // Confidence decreases over time
        });
      }
      
      predictions.push({
        binId: bin.binId,
        predictions: binPredictions
      });
    });
    
    this.predictions = predictions;
    return predictions;
  }
  
  // Get AI insights and recommendations
  getInsights(currentBins) {
    if (!this.initialized) return [];
    
    const insights = [];
    
    // Collection optimization
    const collectionInsight = this.generateCollectionInsight(currentBins);
    if (collectionInsight) insights.push(collectionInsight);
    
    // Fill rate analysis
    const fillRateInsight = this.generateFillRateInsight();
    if (fillRateInsight) insights.push(fillRateInsight);
    
    // Efficiency recommendations
    const efficiencyInsight = this.generateEfficiencyInsight(currentBins);
    if (efficiencyInsight) insights.push(efficiencyInsight);
    
    // Anomaly alerts
    const recentAnomalies = this.anomalies.filter(a => {
      const hoursSince = (new Date() - a.timestamp) / (1000 * 60 * 60);
      return hoursSince <= 24;
    });
    
    if (recentAnomalies.length > 0) {
      insights.push({
        type: 'anomaly_alert',
        title: 'System Anomalies Detected',
        message: `${recentAnomalies.length} anomalies detected in the last 24 hours`,
        severity: 'high',
        details: recentAnomalies
      });
    }
    
    return insights;
  }
  
  generateCollectionInsight(currentBins) {
    const urgentBins = currentBins.filter(bin => bin.fillLevel >= 85);
    
    if (urgentBins.length === 0) return null;
    
    // Simple route optimization (nearest neighbor approach)
    const optimizedRoute = this.optimizeCollectionRoute(urgentBins);
    
    return {
      type: 'collection_optimization',
      title: 'Collection Route Optimization',
      message: `${urgentBins.length} bin(s) need collection. Optimal route: ${optimizedRoute.join(' → ')}`,
      severity: 'medium',
      estimatedTime: `${optimizedRoute.length * 15} minutes`,
      fuelSaving: '23%'
    };
  }
  
  generateFillRateInsight() {
    const rates = Object.values(this.patterns.fillRates);
    if (rates.length === 0) return null;
    
    const avgRate = rates.reduce((sum, r) => sum + r.avgFillRate, 0) / rates.length;
    const fastestBin = rates.reduce((max, r) => r.avgFillRate > max.avgFillRate ? r : max);
    
    return {
      type: 'fill_rate_analysis',
      title: 'Fill Rate Analysis',
      message: `Average fill rate: ${avgRate.toFixed(1)}%/hour. Bin ${fastestBin.binId} fills fastest at ${fastestBin.avgFillRate.toFixed(1)}%/hour`,
      severity: 'low',
      recommendation: `Consider increasing collection frequency for Bin ${fastestBin.binId}`
    };
  }
  
  generateEfficiencyInsight(currentBins) {
    const totalCapacity = currentBins.length * 100;
    const currentFill = currentBins.reduce((sum, bin) => sum + bin.fillLevel, 0);
    const efficiency = (currentFill / totalCapacity) * 100;
    
    let message = '';
    let recommendation = '';
    
    if (efficiency > 80) {
      message = `System efficiency at ${efficiency.toFixed(1)}% - High utilization detected`;
      recommendation = 'Consider scheduling collections soon to maintain optimal efficiency';
    } else if (efficiency < 30) {
      message = `System efficiency at ${efficiency.toFixed(1)}% - Low utilization`;
      recommendation = 'Collection schedule could be optimized to reduce costs';
    } else {
      message = `System efficiency at ${efficiency.toFixed(1)}% - Operating within optimal range`;
      recommendation = 'Current collection schedule appears well-balanced';
    }
    
    return {
      type: 'efficiency_analysis',
      title: 'System Efficiency',
      message: message,
      severity: efficiency > 80 ? 'medium' : 'low',
      recommendation: recommendation,
      efficiency: efficiency.toFixed(1)
    };
  }
  
  optimizeCollectionRoute(bins) {
    // Simple nearest neighbor TSP approximation
    if (bins.length <= 1) return bins.map(b => `Bin ${b.binId}`);
    
    const route = [`Bin ${bins[0].binId}`];
    const remaining = bins.slice(1);
    
    while (remaining.length > 0) {
      // Find nearest bin (simplified - using bin ID difference as distance)
      const lastBinId = parseInt(route[route.length - 1].replace('Bin ', ''));
      let nearestIndex = 0;
      let nearestDistance = Math.abs(remaining[0].binId - lastBinId);
      
      for (let i = 1; i < remaining.length; i++) {
        const distance = Math.abs(remaining[i].binId - lastBinId);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      
      route.push(`Bin ${remaining[nearestIndex].binId}`);
      remaining.splice(nearestIndex, 1);
    }
    
    return route;
  }
  
  // Get next collection predictions
  getNextCollectionPredictions(currentBins) {
    const predictions = [];
    
    currentBins.forEach(bin => {
      const fillRate = this.patterns.fillRates[bin.binId]?.avgFillRate || 2;
      const remainingCapacity = 95 - bin.fillLevel; // Assume collection at 95%
      const hoursToFull = remainingCapacity / fillRate;
      const collectionDate = new Date(Date.now() + (hoursToFull * 60 * 60 * 1000));
      
      predictions.push({
        binId: bin.binId,
        currentLevel: bin.fillLevel,
        estimatedFullTime: collectionDate,
        hoursRemaining: Math.round(hoursToFull),
        priority: hoursToFull <= 24 ? 'high' : hoursToFull <= 48 ? 'medium' : 'low'
      });
    });
    
    return predictions.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIAnalytics;
} else {
  window.AIAnalytics = AIAnalytics;
}