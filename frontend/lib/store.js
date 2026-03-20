/**
 * frontend/lib/store.js
 * Zustand stores for wizard state and auth state.
 */
import { create } from 'zustand';

export const useWizardStore = create((set) => ({
  step: 0,
  repoUrl: '',
  branch: 'main',
  platforms: { supabase: false, vercel: false, railway: false },
  plan: 'starter',
  paymentIntentId: null,
  clientSecret: null,
  tasks: [],
  completedTasks: [],
  currentTask: null,
  deployedUrls: null,

  setStep: (step) => set({ step }),
  setRepoUrl: (repoUrl) => set({ repoUrl }),
  setBranch: (branch) => set({ branch }),
  setPlatform: (id, value) => set((s) => ({ platforms: { ...s.platforms, [id]: value } })),
  setPlan: (plan) => set({ plan }),
  setPayment: (paymentIntentId, clientSecret) => set({ paymentIntentId, clientSecret }),
  setTasks: (tasks) => set({ tasks }),
  setCompletedTasks: (completedTasks) => set({ completedTasks }),
  setCurrentTask: (currentTask) => set({ currentTask }),
  setDeployedUrls: (deployedUrls) => set({ deployedUrls }),
  reset: () => set({
    step: 0, repoUrl: '', branch: 'main',
    platforms: { supabase: false, vercel: false, railway: false },
    plan: 'starter', paymentIntentId: null, clientSecret: null,
    tasks: [], completedTasks: [], currentTask: null, deployedUrls: null,
  }),
}));

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mb_token');
    }
    set({ user: null, token: null });
  },
}));
