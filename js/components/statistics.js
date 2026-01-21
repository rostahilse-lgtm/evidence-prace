class NotificationManager {
  constructor() {
    this.checkInterval = null;
    this.enabled = localStorage.getItem('notificationsEnabled') !== 'false';
    this.lastCheck = null;
  }
  
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('notificationsEnabled', enabled);
    
    if (enabled) {
      this.requestPermission();
      this.startChecking();
    } else {
      this.stopChecking();
    }
  }
  
  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
  
  startChecking() {
    if (!this.enabled) return;
    
    this.checkInterval = setInterval(() => {
      this.checkActiveShift();
    }, 30 * 60 * 1000);
    
    this.checkActiveShift();
  }
  
  stopChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  async checkActiveShift() {
    const activeShift = localStorage.getItem('activeShift');
    if (!activeShift) return;
    
    try {
      const shift = JSON.parse(activeShift);
      const now = Date.now();
      const elapsed = now - shift.startTime;
      const hours = elapsed / (1000 * 60 * 60);
      
      if (hours >= 8 && hours < 8.5 && !shift.notified8h) {
        this.showNotification(
          '⏰ Konec směny',
          `Pracujete už ${hours.toFixed(1)} hodin. Nezapomeňte ukončit směnu!`
        );
        shift.notified8h = true;
        localStorage.setItem('activeShift', JSON.stringify(shift));
      }
      
      if (hours >= 10 && !shift.notified10h) {
        this.showNotification(
          '⚠️ Dlouhá směna!',
          `Pracujete již ${hours.toFixed(1)} hodin. Opravdu jste neukončil(a) směnu?`,
          true
        );
        shift.notified10h = true;
        localStorage.setItem('activeShift', JSON.stringify(shift));
      }
    } catch (error) {
      console.error('Chyba při kontrole směny:', error);
    }
  }
  
  showNotification(title, message, urgent = false) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/icon.png',
        badge: '/badge.png',
        tag: 'shift-reminder',
        requireInteraction: urgent
      });
    }
    
    if ('vibrate' in navigator) {
      navigator.vibrate(urgent ? [200, 100, 200] : 200);
    }
  }
  
  startShift(contractName, jobName) {
    const shift = {
      startTime: Date.now(),
      contract: contractName,
      job: jobName,
      notified8h: false,
      notified10h: false
    };
    localStorage.setItem('activeShift', JSON.stringify(shift));
    this.checkActiveShift();
  }
  
  endShift() {
    localStorage.removeItem('activeShift');
  }
  
  getActiveShift() {
    const activeShift = localStorage.getItem('activeShift');
    if (!activeShift) return null;
    
    try {
      const shift = JSON.parse(activeShift);
      const elapsed = Date.now() - shift.startTime;
      return {
        ...shift,
        elapsedHours: elapsed / (1000 * 60 * 60)
      };
    } catch {
      return null;
    }
  }
}

window.notificationManager = new NotificationManager();
