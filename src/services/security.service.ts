// Security Service for Anti-Cheat, Device Fingerprinting & Abuse Detection
import { supabase } from '@/integrations/supabase/client';

export type AbuseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AbuseType = 
  | 'duplicate_device'
  | 'vpn_detected'
  | 'reward_manipulation'
  | 'attention_fraud'
  | 'rate_limit'
  | 'suspicious_pattern'
  | 'geo_mismatch';

interface DeviceInfo {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  colorDepth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  touchSupport: boolean;
  webglVendor?: string;
  webglRenderer?: string;
}

interface ValidationResult {
  valid: boolean;
  score: number;
  flags: string[];
  shouldBlock: boolean;
}

class SecurityService {
  private deviceFingerprint: string | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private rewardRateWindow: number[] = [];
  private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
  private readonly MAX_REWARDS_PER_MINUTE = 5;

  // Generate a simple device fingerprint
  async generateFingerprint(): Promise<string> {
    if (this.deviceFingerprint) return this.deviceFingerprint;

    const info = this.collectDeviceInfo();
    this.deviceInfo = info;

    // Create a hash from device characteristics
    const fingerprintData = [
      info.userAgent,
      info.language,
      info.platform,
      info.screenResolution,
      info.timezone,
      info.colorDepth.toString(),
      info.deviceMemory?.toString() || '',
      info.hardwareConcurrency?.toString() || '',
      info.touchSupport.toString(),
      info.webglVendor || '',
      info.webglRenderer || '',
    ].join('|');

    // Simple hash function
    const hash = await this.simpleHash(fingerprintData);
    this.deviceFingerprint = hash;
    
    return hash;
  }

  private collectDeviceInfo(): DeviceInfo {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    let webglVendor = '';
    let webglRenderer = '';

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
    }

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorDepth: screen.colorDepth,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      touchSupport: 'ontouchstart' in window,
      webglVendor,
      webglRenderer,
    };
  }

  private async simpleHash(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Register device fingerprint with backend
  async registerDevice(userId: string): Promise<{ isNewDevice: boolean; isTrusted: boolean }> {
    try {
      const fingerprint = await this.generateFingerprint();
      
      // Check if device exists
      const { data: existing, error: checkError } = await supabase
        .from('device_fingerprints')
        .select('*')
        .eq('user_id', userId)
        .eq('fingerprint_hash', fingerprint)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // Update last seen
        await supabase
          .from('device_fingerprints')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', existing.id);

        return { isNewDevice: false, isTrusted: existing.is_trusted };
      }

      // Register new device
      const { error: insertError } = await supabase
        .from('device_fingerprints')
        .insert([{
          user_id: userId,
          fingerprint_hash: fingerprint,
          device_info: JSON.parse(JSON.stringify(this.deviceInfo)),
        }]);

      if (insertError) throw insertError;

      return { isNewDevice: true, isTrusted: true };
    } catch (error) {
      console.error('[Security] Device registration error:', error);
      return { isNewDevice: true, isTrusted: true };
    }
  }

  // Check for duplicate device across users
  async checkDuplicateDevice(userId: string): Promise<boolean> {
    try {
      const fingerprint = await this.generateFingerprint();
      
      const { data, error } = await supabase
        .from('device_fingerprints')
        .select('user_id')
        .eq('fingerprint_hash', fingerprint)
        .neq('user_id', userId);

      if (error) throw error;

      if (data && data.length > 0) {
        await this.logAbuse(userId, 'duplicate_device', 'high', {
          otherUsers: data.map(d => d.user_id),
          fingerprint,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Security] Duplicate check error:', error);
      return false;
    }
  }

  // Validate reward attempt with anti-cheat checks
  async validateRewardAttempt(
    userId: string,
    attentionScore: number,
    watchDuration: number,
    requiredDuration: number
  ): Promise<ValidationResult> {
    const flags: string[] = [];
    let score = 100;
    let shouldBlock = false;

    // 1. Rate limiting check
    const now = Date.now();
    this.rewardRateWindow = this.rewardRateWindow.filter(
      t => now - t < this.RATE_LIMIT_WINDOW_MS
    );
    
    if (this.rewardRateWindow.length >= this.MAX_REWARDS_PER_MINUTE) {
      flags.push('rate_limit_exceeded');
      score -= 50;
      shouldBlock = true;
      await this.logAbuse(userId, 'rate_limit', 'medium', {
        attemptsInWindow: this.rewardRateWindow.length,
      });
    }
    this.rewardRateWindow.push(now);

    // 2. Attention score validation
    if (attentionScore < 30) {
      flags.push('low_attention');
      score -= 30;
    }
    if (attentionScore > 99 && watchDuration < requiredDuration * 0.9) {
      // Suspiciously high attention with incomplete watch
      flags.push('attention_manipulation_suspected');
      score -= 40;
      await this.logAbuse(userId, 'attention_fraud', 'medium', {
        attentionScore,
        watchDuration,
        requiredDuration,
      });
    }

    // 3. Watch duration validation
    if (watchDuration < requiredDuration * 0.7) {
      flags.push('insufficient_watch_time');
      score -= 20;
    }

    // 4. Impossible timing check
    if (watchDuration > requiredDuration * 1.5) {
      // Could indicate tab-switching or pausing
      flags.push('extended_watch_time');
      score -= 10;
    }

    // Determine if should block
    if (score < 40) {
      shouldBlock = true;
      await this.logAbuse(userId, 'suspicious_pattern', 'high', {
        score,
        flags,
        attentionScore,
        watchDuration,
      });
    }

    return {
      valid: score >= 60,
      score,
      flags,
      shouldBlock,
    };
  }

  // Log abuse event
  async logAbuse(
    userId: string,
    abuseType: AbuseType,
    severity: AbuseSeverity,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      const fingerprint = this.deviceFingerprint || await this.generateFingerprint();
      
      await supabase.from('abuse_logs').insert([{
        user_id: userId,
        abuse_type: abuseType,
        severity,
        details: JSON.parse(JSON.stringify(details)),
        device_fingerprint: fingerprint,
        ip_address: null,
        user_agent: navigator.userAgent,
      }]);

      console.warn('[Security] Abuse logged:', { userId, abuseType, severity });
    } catch (error) {
      console.error('[Security] Failed to log abuse:', error);
    }
  }

  // Get user's trust score based on abuse history
  async getUserTrustScore(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('abuse_logs')
        .select('severity')
        .eq('user_id', userId)
        .eq('resolved', false);

      if (error) throw error;

      let trustScore = 100;
      (data || []).forEach(log => {
        switch (log.severity) {
          case 'low': trustScore -= 5; break;
          case 'medium': trustScore -= 15; break;
          case 'high': trustScore -= 30; break;
          case 'critical': trustScore -= 50; break;
        }
      });

      return Math.max(0, trustScore);
    } catch (error) {
      console.error('[Security] Trust score error:', error);
      return 100;
    }
  }

  // Check if user's actions should be throttled
  shouldThrottle(trustScore: number): boolean {
    return trustScore < 50;
  }

  // Get reward multiplier based on trust
  getRewardMultiplier(trustScore: number): number {
    if (trustScore >= 90) return 1.0;
    if (trustScore >= 70) return 0.9;
    if (trustScore >= 50) return 0.7;
    return 0.5;
  }
}

export const securityService = new SecurityService();
