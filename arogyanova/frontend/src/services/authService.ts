// ArogyaNova — Auth Service
import api from './api';
import type { User } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  license_number?: string;
  specialization?: string;
  date_of_birth?: string;
  phone?: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<User> {
    const { data } = await api.post<User>('/auth/login', credentials);
    if (data.access_token) {
      sessionStorage.setItem('arogyanova_token', data.access_token);
    }
    return data;
  },

  async register(registerData: RegisterData): Promise<User> {
    const { data } = await api.post<User>('/auth/register', registerData);
    if (data.access_token) {
      sessionStorage.setItem('arogyanova_token', data.access_token);
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      sessionStorage.removeItem('arogyanova_token');
    }
  },

  async getCurrentUser(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};
