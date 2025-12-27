-- Create task templates table (admin-defined tasks)
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, milestone, streak
  category TEXT NOT NULL DEFAULT 'engagement', -- engagement, social, earning, promo
  goal INTEGER NOT NULL DEFAULT 1,
  reward_type TEXT NOT NULL DEFAULT 'vicoin', -- vicoin, icoin, xp
  reward_value INTEGER NOT NULL DEFAULT 10,
  xp_reward INTEGER NOT NULL DEFAULT 5,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  target_roles TEXT[] DEFAULT ARRAY['user', 'creator'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user tasks table (user-specific task progress)
CREATE TABLE public.user_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.task_templates(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  goal INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  period_end DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, template_id, period_start)
);

-- Create user XP and levels table
CREATE TABLE public.user_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_xp INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create achievements table
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general', -- general, earning, social, streak
  icon TEXT,
  requirement_type TEXT NOT NULL, -- xp_total, level, streak, coins_earned, tasks_completed
  requirement_value INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user achievements table
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Task templates policies (public read, admin write)
CREATE POLICY "Anyone can view active task templates"
  ON public.task_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage task templates"
  ON public.task_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- User tasks policies
CREATE POLICY "Users can view their own tasks"
  ON public.user_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
  ON public.user_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.user_tasks FOR UPDATE
  USING (auth.uid() = user_id);

-- User levels policies
CREATE POLICY "Users can view their own level"
  ON public.user_levels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own level"
  ON public.user_levels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own level"
  ON public.user_levels FOR UPDATE
  USING (auth.uid() = user_id);

-- Public leaderboard view (limited data)
CREATE POLICY "Users can view all levels for leaderboard"
  ON public.user_levels FOR SELECT
  USING (true);

-- Achievements policies
CREATE POLICY "Anyone can view active achievements"
  ON public.achievements FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage achievements"
  ON public.achievements FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- User achievements policies
CREATE POLICY "Users can view their own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX idx_user_tasks_completed ON public.user_tasks(user_id, completed);
CREATE INDEX idx_user_levels_level ON public.user_levels(level DESC);
CREATE INDEX idx_user_levels_total_xp ON public.user_levels(total_xp DESC);
CREATE INDEX idx_user_achievements_user_id ON public.user_achievements(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_task_templates_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_tasks_updated_at
  BEFORE UPDATE ON public.user_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_levels_updated_at
  BEFORE UPDATE ON public.user_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default task templates
INSERT INTO public.task_templates (title, description, type, category, goal, reward_type, reward_value, xp_reward, icon) VALUES
  ('Watch 3 Videos', 'Watch 3 videos to earn rewards', 'daily', 'engagement', 3, 'vicoin', 15, 10, 'play'),
  ('Like 5 Posts', 'Show appreciation for content you enjoy', 'daily', 'engagement', 5, 'vicoin', 10, 5, 'heart'),
  ('Share Content', 'Share a video with friends', 'daily', 'social', 1, 'vicoin', 20, 15, 'share'),
  ('Daily Login', 'Log in to the app', 'daily', 'engagement', 1, 'vicoin', 5, 5, 'calendar'),
  ('Invite a Friend', 'Invite a friend to join', 'weekly', 'social', 1, 'icoin', 50, 25, 'user-plus'),
  ('Complete 10 Tasks', 'Complete 10 daily tasks this week', 'weekly', 'engagement', 10, 'icoin', 100, 50, 'check-circle'),
  ('7-Day Streak', 'Log in for 7 days in a row', 'streak', 'engagement', 7, 'icoin', 200, 100, 'flame');

-- Insert default achievements
INSERT INTO public.achievements (name, description, category, icon, requirement_type, requirement_value, xp_reward) VALUES
  ('First Steps', 'Reach level 2', 'general', 'footprints', 'level', 2, 25),
  ('Rising Star', 'Reach level 5', 'general', 'star', 'level', 5, 50),
  ('Veteran', 'Reach level 10', 'general', 'medal', 'level', 10, 100),
  ('Legend', 'Reach level 25', 'general', 'crown', 'level', 25, 250),
  ('Coin Collector', 'Earn 100 total Vicoins', 'earning', 'coins', 'coins_earned', 100, 50),
  ('Big Spender', 'Earn 1000 total Vicoins', 'earning', 'gem', 'coins_earned', 1000, 150),
  ('Streak Starter', 'Maintain a 3-day streak', 'streak', 'flame', 'streak', 3, 25),
  ('Week Warrior', 'Maintain a 7-day streak', 'streak', 'zap', 'streak', 7, 75),
  ('Month Master', 'Maintain a 30-day streak', 'streak', 'trophy', 'streak', 30, 300),
  ('Task Master', 'Complete 50 tasks', 'general', 'check-square', 'tasks_completed', 50, 100);