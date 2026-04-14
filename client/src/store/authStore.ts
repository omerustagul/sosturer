import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api } from '../lib/api';

export interface Company {
  id: string;
  name: string;
  companyAddress: string;
  taxOffice: string;
  taxNumber: string;
  sicilNo: string;
  mersisNo: string;
  kepAddress: string;
  companyPhone: string;
  companyEmail: string;
  website: string;
  sector: string;
  employees: string;
  founded: string;
  logoUrl: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl: string;
  companyId: string;
  
  // Personal Info
  tc: string;
  gender: string;
  nationality: string;
  birthDate: string;
  personalPhone: string;
  personalAddress: string;
  memberSince: string;
  status: string;
}

interface AuthState {
  user: User | null;
  company: Company | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User, company?: Company) => void;
  updateUser: (newData: Partial<User>) => void;
  updateCompany: (newData: Partial<Company>) => void;
  saveProfile: (newData: Partial<User>) => Promise<void>;
  saveCompany: (newData: Partial<Company>) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      token: null,
      isAuthenticated: false,
      login: (token, user, company) => {
        sessionStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true, company: company || null });
      },
      updateUser: (newData) => {
        set((state) => ({ user: state.user ? { ...state.user, ...newData } : null }));
      },
      updateCompany: (newData) => {
        set((state) => ({ company: state.company ? { ...state.company, ...newData } : null }));
      },
      saveProfile: async (newData) => {
        try {
          const updatedUser = await api.put('/auth/me', newData);
          set({ user: updatedUser });
        } catch (error) {
          console.error('Failed to save profile:', error);
          throw error;
        }
      },
      saveCompany: async (newData) => {
        try {
          const updatedCompany = await api.put('/auth/company', newData);
          set({ company: updatedCompany });
        } catch (error) {
          console.error('Failed to save company:', error);
          throw error;
        }
      },
      refreshUser: async () => {
        try {
          const data = await api.get('/auth/me');
          const { company, token, ...user } = data;
          
          if (token) {
            sessionStorage.setItem('token', token);
          }
          
          set({ user, company, ...(token ? { token } : {}) });
        } catch (error) {
          console.log('Refresh failed, keeping current local session if any.');
        }
      },
      logout: () => {
        sessionStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false, company: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
