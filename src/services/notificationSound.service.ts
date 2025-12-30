// Notification Sound Service
// Uses Web Audio API to generate notification sounds without external files

class NotificationSoundService {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    if (typeof window !== 'undefined') {
      this.isEnabled = localStorage.getItem('notification_sounds_enabled') !== 'false';
      this.volume = parseFloat(localStorage.getItem('notification_volume') || '0.5');
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    localStorage.setItem('notification_sounds_enabled', String(enabled));
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('notification_volume', String(this.volume));
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  getVolume(): number {
    return this.volume;
  }

  // Play a pleasant notification chime
  playNotification() {
    if (!this.isEnabled) return;
    
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      
      // Create oscillator for the chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = 'sine';
      osc2.type = 'sine';
      
      // Pleasant two-tone chime
      osc1.frequency.setValueAtTime(880, now); // A5
      osc2.frequency.setValueAtTime(1108.73, now); // C#6
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now + 0.1);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.6);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }

  // Play achievement unlock fanfare
  playAchievement() {
    if (!this.isEnabled) return;
    
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const duration = 0.15;
      
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        gain.gain.setValueAtTime(0, now + index * duration);
        gain.gain.linearRampToValueAtTime(this.volume * 0.25, now + index * duration + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * duration + duration + 0.2);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + index * duration);
        osc.stop(now + index * duration + duration + 0.3);
      });
    } catch (error) {
      console.warn('Could not play achievement sound:', error);
    }
  }

  // Play coin/reward sound
  playReward() {
    if (!this.isEnabled) return;
    
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.1);
      
      gain.gain.setValueAtTime(this.volume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (error) {
      console.warn('Could not play reward sound:', error);
    }
  }

  // Play subtle tap sound
  playTap() {
    if (!this.isEnabled) return;
    
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      
      gain.gain.setValueAtTime(this.volume * 0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (error) {
      console.warn('Could not play tap sound:', error);
    }
  }

  // Play attention warning sound (low tone)
  playAttentionWarning() {
    if (!this.isEnabled) return;
    
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.3);
      
      gain.gain.setValueAtTime(this.volume * 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (error) {
      console.warn('Could not play attention warning sound:', error);
    }
  }
}

export const notificationSoundService = new NotificationSoundService();
