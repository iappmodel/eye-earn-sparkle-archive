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

  // Initialize user level if not exists
  const initializeUserLevel = useCallback(async () => {
    if (!user) return null;

    const { data: existing } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      // Check and update streak
      const today = new Date().toISOString().split('T')[0];
      const lastActive = existing.last_active_date;
      
      if (lastActive !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const newStreakDays = lastActive === yesterdayStr ? existing.streak_days + 1 : 1;
        const newLongestStreak = Math.max(newStreakDays, existing.longest_streak);

        const { data: updated } = await supabase
          .from('user_levels')
          .update({
            streak_days: newStreakDays,
            longest_streak: newLongestStreak,
            last_active_date: today,
          })
          .eq('user_id', user.id)
          .select()
          .single();

        return updated as UserLevel;
      }
      return existing as UserLevel;
    }

    const { data: newLevel } = await supabase
      .from('user_levels')
      .insert({
        user_id: user.id,
        last_active_date: new Date().toISOString().split('T')[0],
        streak_days: 1,
      })
      .select()
      .single();

    return newLevel as UserLevel;
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

  // Fetch or create user tasks for today
  const fetchUserTasks = useCallback(async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart();

    // Get existing tasks
    const { data: existingTasks } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', user.id)
      .gte('period_start', weekStart);

    // Get templates to create missing tasks
    const allTemplates = await fetchTemplates();
    
    const tasksToCreate: any[] = [];
    
    for (const template of allTemplates) {
      const periodStart = template.type === 'weekly' ? weekStart : today;
      const exists = existingTasks?.find(
        t => t.template_id === template.id && t.period_start === periodStart
      );
      
      if (!exists) {
        tasksToCreate.push({
          user_id: user.id,
          template_id: template.id,
          goal: template.goal,
          period_start: periodStart,
        });
      }
    }

    if (tasksToCreate.length > 0) {
      await supabase.from('user_tasks').insert(tasksToCreate);
    }

    // Refetch all tasks
    const { data: allTasks } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', user.id)
      .gte('period_start', weekStart)
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

    const task = tasks.find(t => t.template_id === templateId && !t.completed);
    if (!task) return;

    const newProgress = Math.min(task.progress + increment, task.goal);
    const completed = newProgress >= task.goal;

    const { error } = await supabase
      .from('user_tasks')
      .update({
        progress: newProgress,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', task.id);

    if (error) {
      console.error('Error updating task:', error);
      return;
    }

    // Update local state
    setTasks(prev =>
      prev.map(t =>
        t.id === task.id
          ? { ...t, progress: newProgress, completed }
          : t
      )
    );

    if (completed && task.template) {
      toast.success(`Task completed: ${task.template.title}!`);
    }
  };

  // Claim task reward
  const claimTaskReward = async (taskId: string) => {
    if (!user || !userLevel) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.completed || task.reward_claimed || !task.template) return;

    // Mark as claimed
    await supabase
      .from('user_tasks')
      .update({ reward_claimed: true })
      .eq('id', taskId);

    // Award XP
    const xpGained = task.template.xp_reward;
    const newTotalXp = userLevel.total_xp + xpGained;
    let newCurrentXp = userLevel.current_xp + xpGained;
    let newLevel = userLevel.level;

    // Check for level up
    while (newCurrentXp >= getXpForLevel(newLevel)) {
      newCurrentXp -= getXpForLevel(newLevel);
      newLevel++;
      toast.success(`🎉 Level Up! You're now level ${newLevel}!`);
    }

    await supabase
      .from('user_levels')
      .update({
        current_xp: newCurrentXp,
        total_xp: newTotalXp,
        level: newLevel,
      })
      .eq('user_id', user.id);

    setUserLevel(prev =>
      prev ? { ...prev, current_xp: newCurrentXp, total_xp: newTotalXp, level: newLevel } : null
    );

    // Award coins
    if (task.template.reward_type !== 'xp') {
      const coinField = task.template.reward_type === 'vicoin' ? 'vicoin_balance' : 'icoin_balance';
      
      // Get current balance and update
      const { data: profileData } = await supabase
        .from('profiles')
        .select(coinField)
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        const currentBalance = (profileData as Record<string, number>)[coinField] || 0;
        await supabase
          .from('profiles')
          .update({ [coinField]: currentBalance + task.template.reward_value })
          .eq('user_id', user.id);
      }
    }

    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, reward_claimed: true } : t))
    );

    toast.success(`+${task.template.reward_value} ${task.template.reward_type.toUpperCase()}!`);

    // Check achievements
    checkAchievements();
  };

  // Check and unlock achievements
  const checkAchievements = async () => {
    if (!user || !userLevel) return;

    const unlockedIds = userAchievements.map(ua => ua.achievement_id);
    const completedTasks = tasks.filter(t => t.completed).length;

    for (const achievement of achievements) {
      if (unlockedIds.includes(achievement.id)) continue;

      let meetsRequirement = false;

      switch (achievement.requirement_type) {
        case 'level':
          meetsRequirement = userLevel.level >= achievement.requirement_value;
          break;
        case 'streak':
          meetsRequirement = userLevel.streak_days >= achievement.requirement_value;
          break;
        case 'tasks_completed':
          meetsRequirement = completedTasks >= achievement.requirement_value;
          break;
      }

      if (meetsRequirement) {
        const { data } = await supabase
          .from('user_achievements')
          .insert({
            user_id: user.id,
            achievement_id: achievement.id,
          })
          .select()
          .single();

        if (data) {
          setUserAchievements(prev => [...prev, { ...data, achievement }]);
          toast.success(`🏆 Achievement Unlocked: ${achievement.name}!`);

          // Award achievement XP
          if (achievement.xp_reward > 0) {
            const newTotalXp = userLevel.total_xp + achievement.xp_reward;
            await supabase
              .from('user_levels')
              .update({ total_xp: newTotalXp })
              .eq('user_id', user.id);
          }
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
