/**
 * In-memory storage adapter for Supabase auth.
 * Tokens are kept only in JS memory (no localStorage) to limit XSS impact.
 * Tradeoff: user is logged out on tab close or refresh.
 */
const store = new Map<string, string>();

export const memoryStorage = {
  getItem: async (key: string): Promise<string | null> => store.get(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    store.delete(key);
  },
};
