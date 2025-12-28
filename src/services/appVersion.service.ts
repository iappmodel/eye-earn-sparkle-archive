import { supabase } from "@/integrations/supabase/client";

export interface AppVersion {
  id: string;
  version: string;
  release_notes: string | null;
  is_stable: boolean;
  is_deprecated: boolean;
  min_supported_version: string | null;
  released_at: string | null;
  created_at: string;
}

// Current app version - update this with each release
export const CURRENT_APP_VERSION = '1.0.0';

class AppVersionService {
  private latestVersion: AppVersion | null = null;
  private minSupportedVersion: string | null = null;

  /**
   * Parse a semver string into components
   */
  private parseSemver(version: string): { major: number; minor: number; patch: number } {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
    };
  }

  /**
   * Compare two semver versions
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  private compareSemver(a: string, b: string): number {
    const vA = this.parseSemver(a);
    const vB = this.parseSemver(b);

    if (vA.major !== vB.major) return vA.major < vB.major ? -1 : 1;
    if (vA.minor !== vB.minor) return vA.minor < vB.minor ? -1 : 1;
    if (vA.patch !== vB.patch) return vA.patch < vB.patch ? -1 : 1;
    return 0;
  }

  /**
   * Fetch the latest stable version
   */
  async getLatestVersion(): Promise<AppVersion | null> {
    if (this.latestVersion) return this.latestVersion;

    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .eq('is_stable', true)
      .eq('is_deprecated', false)
      .order('released_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Failed to fetch latest version:', error);
      return null;
    }

    this.latestVersion = data as AppVersion;
    return this.latestVersion;
  }

  /**
   * Check if the current version is outdated
   */
  async isOutdated(): Promise<boolean> {
    const latest = await this.getLatestVersion();
    if (!latest) return false;

    return this.compareSemver(CURRENT_APP_VERSION, latest.version) < 0;
  }

  /**
   * Check if the current version is still supported
   */
  async isSupported(): Promise<boolean> {
    const latest = await this.getLatestVersion();
    if (!latest || !latest.min_supported_version) return true;

    this.minSupportedVersion = latest.min_supported_version;
    return this.compareSemver(CURRENT_APP_VERSION, latest.min_supported_version) >= 0;
  }

  /**
   * Check version status and return update info
   */
  async checkVersionStatus(): Promise<{
    currentVersion: string;
    latestVersion: string | null;
    isOutdated: boolean;
    isSupported: boolean;
    releaseNotes: string | null;
  }> {
    const latest = await this.getLatestVersion();
    const isOutdated = await this.isOutdated();
    const isSupported = await this.isSupported();

    return {
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: latest?.version || null,
      isOutdated,
      isSupported,
      releaseNotes: latest?.release_notes || null,
    };
  }

  /**
   * Generate changelog summary from version history
   */
  async getChangelog(limit: number = 10): Promise<AppVersion[]> {
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .order('released_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch changelog:', error);
      return [];
    }

    return (data || []) as AppVersion[];
  }

  /**
   * Admin: Register a new version
   */
  async registerVersion(
    version: Pick<AppVersion, 'version' | 'release_notes' | 'is_stable' | 'min_supported_version'>
  ): Promise<AppVersion | null> {
    const { data, error } = await supabase
      .from('app_versions')
      .insert({
        ...version,
        released_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to register version:', error);
      return null;
    }

    // Clear cache
    this.latestVersion = null;

    return data as AppVersion;
  }

  /**
   * Get current version info
   */
  getCurrentVersion(): string {
    return CURRENT_APP_VERSION;
  }
}

export const appVersionService = new AppVersionService();

// React hook for version checking
import { useState, useEffect } from 'react';

export function useAppVersion() {
  const [versionStatus, setVersionStatus] = useState<{
    currentVersion: string;
    latestVersion: string | null;
    isOutdated: boolean;
    isSupported: boolean;
    releaseNotes: string | null;
    loading: boolean;
  }>({
    currentVersion: CURRENT_APP_VERSION,
    latestVersion: null,
    isOutdated: false,
    isSupported: true,
    releaseNotes: null,
    loading: true,
  });

  useEffect(() => {
    const checkVersion = async () => {
      const status = await appVersionService.checkVersionStatus();
      setVersionStatus({ ...status, loading: false });
    };

    checkVersion();
  }, []);

  return versionStatus;
}
