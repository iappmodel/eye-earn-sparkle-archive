import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  type: 'daily' | 'weekly' | 'milestone' | 'streak';
  category: string;
  goal: number;
  reward_type: 'vicoin' | 'icoin' | 'xp';
  reward_value: number;
  xp_reward: number;
  icon: string | null;
}

export interface UserTask {
  id: string;
  user_id: string;
  template_id: string;
  progress: number;
  goal: number;
  completed: boolean;
  completed_at: string | null;
  reward_claimed: boolean;
  period_start: string;
  template?: TaskTemplate;
}

export interface UserLevel {
  id: string;
  user_id: string;
  current_xp: number;
  total_xp: number;
  level: number;
  streak_days: number;
  last_active_date: string | null;
  longest_streak: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  requirement_type: string;
  requirement_value: number;
  xp_reward: number;
}

export interface UserAchievement {
  id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

interface TaskXpSyncPayload {
  xpAwarded: number;
  level: number;
  currentXp: number;
  totalXp: number;
}

// XP required per level (exponential curve)
export const getXpForLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

export const useTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load user level (read-only on client; server-owned writes for anti-fraud)
  const initializeUserLevel = useCallback(async () => {
    if (!user) return null;

    const { data: existing, error } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading user level:', error);
    }

    if (existing) {
      return existing as UserLevel;
    }

    // Local fallback keeps task/achievement UI usable until a server-side reward/check-in path creates the row.
    return {
      id: `local-${user.id}`,
      user_id: user.id,
      current_xp: 0,
      total_xp: 0,
      level: 1,
      streak_days: 0,
      last_active_date: null,
      longest_streak: 0,
    } satisfies UserLevel;
  }, [user]);

  // Fetch task templates
  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('task_templates')
      .select('*')
      .eq('is_active', true);

    if (data) {
      setTemplates(data as TaskTemplate[]);
    }
    return data || [];
  }, []);

  // Fetch user tasks for today (server sync creates missing rows)
  const fetchUserTasks = useCallback(async () => {
    if (!user) return;

    const localWeekStart = getWeekStart();

    // Get templates first so we can render immediately after sync/select.
    const allTemplates = await fetchTemplates();

    const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-user-tasks', {
      body: {},
    });
    if (syncError) {
      // Reads still proceed so existing tasks remain visible if sync endpoint is temporarily unavailable.
      console.error('Error syncing user tasks:', syncError);
    }
    const serverWeekStart = (syncData as { weekStart?: string } | null)?.weekStart;
    const taskPeriodLowerBound = typeof serverWeekStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(serverWeekStart)
      ? serverWeekStart
      : localWeekStart;

    // Fetch synced tasks
    const { data: allTasks } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', user.id)
      .gte('period_start', taskPeriodLowerBound)
      .order('created_at', { ascending: true });

    // Merge with templates
    const tasksWithTemplates = (allTasks || []).map(task => ({
      ...task,
      template: allTemplates.find(t => t.id === task.template_id),
    })) as UserTask[];

    setTasks(tasksWithTemplates);
  }, [user, fetchTemplates]);

  // Fetch achievements
  const fetchAchievements = useCallback(async () => {
    if (!user) return;

    const { data: allAchievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true);

    const { data: userAchs } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', user.id);

    if (allAchievements) {
      setAchievements(allAchievements as Achievement[]);
    }
    
    if (userAchs) {
      const withDetails = userAchs.map(ua => ({
        ...ua,
        achievement: allAchievements?.find(a => a.id === ua.achievement_id),
      })) as UserAchievement[];
      setUserAchievements(withDetails);
    }
  }, [user]);

  // Update task progress
  const updateTaskProgress = async (templateId: string, increment: number = 1) => {
    if (!user) return;

    const localTask = tasks.find(t => t.template_id === templateId && !t.completed);
    const template = localTask?.template ?? templates.find(t => t.id === templateId);
    if (!template) return;

    const { data, error } = await supabase.functions.invoke('update-task-progress', {
      body: {
        templateId,
        increment,
      },
    });

    if (error) {
      console.error('Error updating task progress:', error);
      return;
    }

    const result = data as {
      success?: boolean;
      error?: string;
      completedJustNow?: boolean;
      task?: UserTask;
    };

    if (!result?.success || !result.task) {
      console.error('Task progress update failed:', result?.error || 'Unknown error');
      return;
    }

    const updatedTask = {
      ...result.task,
      template,
    } as UserTask;

    // Update local state from server-authoritative row.
    setTasks(prev =>
      prev.some(t => t.id === updatedTask.id)
        ? prev.map(t => (t.id === updatedTask.id ? updatedTask : t))
        : [...prev, updatedTask]
    );

    if (result.completedJustNow) {
      toast.success(`Task completed: ${template.title}!`);
    }
  };

  // Claim task reward
  const claimTaskReward = async (taskId: string) => {
    if (!user) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.completed || task.reward_claimed || !task.template) return;

    let rewardToastLabel = `+${task.template.reward_value} ${task.template.reward_type.toUpperCase()}!`;
    let serverTaskXp: TaskXpSyncPayload | null = null;

    // Claim all task rewards through the secure backend path (coin and XP-only). The backend verifies task
    // ownership/completion and computes wallet and XP mutations server-side.
    const idempotencyKey = crypto.randomUUID();
    const { data, error } = await supabase.functions.invoke('issue-reward', {
      headers: { 'idempotency-key': idempotencyKey },
      body: {
        rewardType: 'user_task_complete',
        contentId: task.id,
      },
    });

    if (error) {
      let message = error.message || 'Failed to claim task reward';
      const errorWithContext = error as { context?: Response };
      if (errorWithContext.context) {
        try {
          const payload = await errorWithContext.context.json() as { error?: string; code?: string };
          if (payload?.error) message = payload.error;
          if (payload?.code === 'reward_already_claimed') {
            setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, reward_claimed: true } : t)));
          }
        } catch {
          // Keep fallback error message.
        }
      }
      toast.error(message);
      return;
    }

    const result = data as {
      success?: boolean;
      amount?: number;
      coinType?: 'vicoin' | 'icoin' | null;
      error?: string;
      code?: string;
      taskXp?: TaskXpSyncPayload;
      taskXpSyncFailed?: boolean;
      taskRewardType?: 'xp' | 'vicoin' | 'icoin';
    };

    if (!result?.success) {
      if (result?.code === 'reward_already_claimed') {
        setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, reward_claimed: true } : t)));
      }
      toast.error(result?.error || 'Failed to claim task reward');
      return;
    }

    serverTaskXp = result.taskXp ?? null;
    if (task.template.reward_type === 'xp') {
      rewardToastLabel = `+${serverTaskXp?.xpAwarded ?? task.template.xp_reward} XP!`;
    } else {
      rewardToastLabel = `+${result.amount ?? task.template.reward_value} ${(result.coinType ?? task.template.reward_type).toUpperCase()}!`;
    }
    if (result.taskXpSyncFailed) {
      console.warn('Task reward claimed but XP sync failed on server for task:', taskId);
    }

    // Keep UI consistent locally; backend already marks user_task rewards as claimed server-side.

    // Apply server-computed XP/level progression (coin and XP-only task rewards both come from backend now).
    if (serverTaskXp) {
      const priorLevel = userLevel?.level ?? 1;
      const levelUps = Math.max(0, serverTaskXp.level - priorLevel);
      for (let i = 1; i <= levelUps; i++) {
        toast.success(`🎉 Level Up! You're now level ${priorLevel + i}!`);
      }

      setUserLevel(prev =>
        prev ? {
          ...prev,
          current_xp: serverTaskXp.currentXp,
          total_xp: serverTaskXp.totalXp,
          level: serverTaskXp.level,
        } : {
          id: `local-${user.id}`,
          user_id: user.id,
          current_xp: serverTaskXp.currentXp,
          total_xp: serverTaskXp.totalXp,
          level: serverTaskXp.level,
          streak_days: 0,
          last_active_date: null,
          longest_streak: 0,
        }
      );
    } else if ((task.template.reward_type === 'xp') || task.template.xp_reward > 0) {
      console.warn('Task reward claimed without taskXp payload; skipping client XP fallback for security.');
      toast.error('Reward claimed, but XP sync is pending. Refresh shortly.');
    }

    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, reward_claimed: true } : t))
    );

    toast.success(rewardToastLabel);

    // Check achievements
    checkAchievements();
  };

  // Check and unlock achievements
  const checkAchievements = async () => {
    if (!user || !userLevel) return;

    const unlockedIds = userAchievements.map(ua => ua.achievement_id);
    const completedTasks = tasks.filter(t => t.completed).length;
    let workingLevel = userLevel;

    for (const achievement of achievements) {
      if (unlockedIds.includes(achievement.id)) continue;

      let meetsRequirement = false;

      switch (achievement.requirement_type) {
        case 'level':
          meetsRequirement = workingLevel.level >= achievement.requirement_value;
          break;
        case 'streak':
          meetsRequirement = userLevel.streak_days >= achievement.requirement_value;
          break;
        case 'tasks_completed':
          meetsRequirement = completedTasks >= achievement.requirement_value;
          break;
        case 'coins_earned':
          // Let the server verify aggregate earned coins authoritatively from the ledger.
          meetsRequirement = true;
          break;
      }

      if (meetsRequirement) {
        const idempotencyKey = crypto.randomUUID();
        const { data: rewardData, error: rewardError } = await supabase.functions.invoke('issue-reward', {
          headers: { 'idempotency-key': idempotencyKey },
          body: {
            rewardType: 'achievement_unlock',
            contentId: achievement.id,
          },
        });

        let rewardErrorCode: string | undefined;
        if (rewardError) {
          let rewardMessage = rewardError.message || 'Failed to unlock achievement';
          const rewardErrorWithContext = rewardError as { context?: Response };
          if (rewardErrorWithContext.context) {
            try {
              const payload = await rewardErrorWithContext.context.json() as { error?: string; code?: string };
              if (payload?.error) rewardMessage = payload.error;
              rewardErrorCode = payload?.code;
            } catch {
              // keep fallback message
            }
          }

          if (rewardErrorCode === 'requirement_not_met') {
            continue;
          }

          if (rewardErrorCode === 'reward_already_claimed') {
            const { data: existingAchievementRow } = await supabase
              .from('user_achievements')
              .select('*')
              .eq('user_id', user.id)
              .eq('achievement_id', achievement.id)
              .maybeSingle();
            if (existingAchievementRow) {
              setUserAchievements(prev => (
                prev.some(ua => ua.achievement_id === achievement.id)
                  ? prev
                  : [...prev, { ...existingAchievementRow, achievement }]
              ));
            }
            continue;
          }

          console.error('Achievement unlock reward failed:', rewardError);
          toast.error(rewardMessage);
          continue;
        }

        const rewardResult = rewardData as {
          success?: boolean;
          error?: string;
          code?: string;
          achievementXp?: TaskXpSyncPayload | null;
          achievementUnlock?: {
            id?: string;
            achievementId?: string;
            unlockedAt?: string;
          } | null;
        };

        if (!rewardResult?.success) {
          if (rewardResult?.code === 'requirement_not_met') {
            continue;
          }
          if (rewardResult?.code === 'reward_already_claimed') {
            const { data: existingAchievementRow } = await supabase
              .from('user_achievements')
              .select('*')
              .eq('user_id', user.id)
              .eq('achievement_id', achievement.id)
              .maybeSingle();
            if (existingAchievementRow) {
              setUserAchievements(prev => (
                prev.some(ua => ua.achievement_id === achievement.id)
                  ? prev
                  : [...prev, { ...existingAchievementRow, achievement }]
              ));
            }
            continue;
          }
          toast.error(rewardResult?.error || 'Failed to unlock achievement');
          continue;
        }

        const unlockRow = rewardResult.achievementUnlock;
        const localUnlockedAchievementRow = {
          id: unlockRow?.id ?? crypto.randomUUID(),
          user_id: user.id,
          achievement_id: unlockRow?.achievementId ?? achievement.id,
          unlocked_at: unlockRow?.unlockedAt ?? new Date().toISOString(),
        };

        setUserAchievements(prev => (
          prev.some(ua => ua.achievement_id === achievement.id)
            ? prev
            : [...prev, { ...localUnlockedAchievementRow, achievement }]
        ));
        toast.success(`🏆 Achievement Unlocked: ${achievement.name}!`);

        const achievementXp = rewardResult.achievementXp ?? null;
        if (achievementXp) {
          const levelUps = Math.max(0, achievementXp.level - workingLevel.level);
          for (let i = 1; i <= levelUps; i++) {
            toast.success(`🎉 Level Up! You're now level ${workingLevel.level + i}!`);
          }

          workingLevel = {
            ...workingLevel,
            current_xp: achievementXp.currentXp,
            total_xp: achievementXp.totalXp,
            level: achievementXp.level,
          };
          setUserLevel(workingLevel);
        } else if (achievement.xp_reward > 0) {
          console.warn('Achievement unlock succeeded without achievementXp payload');
        }
      }
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const level = await initializeUserLevel();
      if (level) setUserLevel(level);
      await Promise.all([fetchUserTasks(), fetchAchievements()]);
      setIsLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user, initializeUserLevel, fetchUserTasks, fetchAchievements]);

  return {
    tasks,
    templates,
    userLevel,
    achievements,
    userAchievements,
    isLoading,
    updateTaskProgress,
    claimTaskReward,
    checkAchievements,
    refetch: fetchUserTasks,
  };
};

// Helper function to get week start date
function getWeekStart(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(today.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}
