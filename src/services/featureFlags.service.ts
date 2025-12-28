import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  rollout_percentage: number;
  target_roles: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface FeatureFlagsCache {
  flags: Map<string, FeatureFlag>;
  lastFetched: number;
  ttl: number; // Time to live in ms
}

class FeatureFlagsService {
  private cache: FeatureFlagsCache = {
    flags: new Map(),
    lastFetched: 0,
    ttl: 5 * 60 * 1000, // 5 minutes
  };

  private userHash: number | null = null;

  /**
   * Generate a consistent hash for a user ID (for rollout percentage)
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 100);
  }

  /**
   * Fetch all feature flags from the database
   */
  async fetchFlags(): Promise<FeatureFlag[]> {
    const now = Date.now();
    
    // Return cached if still valid
    if (this.cache.flags.size > 0 && (now - this.cache.lastFetched) < this.cache.ttl) {
      return Array.from(this.cache.flags.values());
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .select('*');

    if (error) {
      console.error('Failed to fetch feature flags:', error);
      return Array.from(this.cache.flags.values()); // Return stale cache on error
    }

    // Update cache
    this.cache.flags.clear();
    (data || []).forEach((flag) => {
      this.cache.flags.set(flag.name, flag as FeatureFlag);
    });
    this.cache.lastFetched = now;

    return data as FeatureFlag[];
  }

  /**
   * Check if a feature flag is enabled for the current user
   */
  async isEnabled(
    flagName: string,
    options?: { userId?: string; userRole?: string }
  ): Promise<boolean> {
    await this.fetchFlags();
    
    const flag = this.cache.flags.get(flagName);
    if (!flag) {
      console.warn(`Feature flag "${flagName}" not found`);
      return false;
    }

    // Check if globally disabled
    if (!flag.is_enabled) {
      return false;
    }

    // Check role targeting
    if (options?.userRole && flag.target_roles.length > 0) {
      if (!flag.target_roles.includes(options.userRole)) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rollout_percentage < 100 && options?.userId) {
      if (this.userHash === null) {
        this.userHash = this.hashUserId(options.userId);
      }
      return this.userHash < flag.rollout_percentage;
    }

    return true;
  }

  /**
   * Get a feature flag's value
   */
  async getFlag(flagName: string): Promise<FeatureFlag | null> {
    await this.fetchFlags();
    return this.cache.flags.get(flagName) || null;
  }

  /**
   * Clear the cache to force a refresh
   */
  clearCache(): void {
    this.cache.flags.clear();
    this.cache.lastFetched = 0;
  }

  /**
   * Admin: Update a feature flag
   */
  async updateFlag(
    flagName: string,
    updates: Partial<Pick<FeatureFlag, 'is_enabled' | 'rollout_percentage' | 'target_roles' | 'description'>>
  ): Promise<FeatureFlag | null> {
    const { data, error } = await supabase
      .from('feature_flags')
      .update(updates)
      .eq('name', flagName)
      .select()
      .single();

    if (error) {
      console.error('Failed to update feature flag:', error);
      return null;
    }

    // Update cache
    if (data) {
      this.cache.flags.set(data.name, data as FeatureFlag);
    }

    return data as FeatureFlag;
  }

  /**
   * Admin: Create a new feature flag
   */
  async createFlag(
    flag: Pick<FeatureFlag, 'name' | 'description' | 'is_enabled' | 'rollout_percentage' | 'target_roles'>
  ): Promise<FeatureFlag | null> {
    const { data, error } = await supabase
      .from('feature_flags')
      .insert(flag)
      .select()
      .single();

    if (error) {
      console.error('Failed to create feature flag:', error);
      return null;
    }

    // Update cache
    if (data) {
      this.cache.flags.set(data.name, data as FeatureFlag);
    }

    return data as FeatureFlag;
  }
}

export const featureFlagsService = new FeatureFlagsService();

// React hook for feature flags
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useFeatureFlag(flagName: string): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkFlag = async () => {
      try {
        const isEnabled = await featureFlagsService.isEnabled(flagName, {
          userId: user?.id,
        });
        setEnabled(isEnabled);
      } catch (error) {
        console.error(`Error checking feature flag ${flagName}:`, error);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    checkFlag();
  }, [flagName, user?.id]);

  return { enabled, loading };
}

export function useAllFeatureFlags(): { flags: FeatureFlag[]; loading: boolean; refetch: () => void } {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    setLoading(true);
    featureFlagsService.clearCache();
    const fetchedFlags = await featureFlagsService.fetchFlags();
    setFlags(fetchedFlags);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
  }, []);

  return { flags, loading, refetch };
}
