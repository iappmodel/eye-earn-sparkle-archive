-- user_tasks drives reward eligibility. Client-writable rows allow spoofed completion/claims.
-- Creation/progress updates should flow through server endpoints (sync-user-tasks, update-task-progress).
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.user_tasks;

