import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotification = { ...notification, id };
    
    set((state) => ({
      notifications: [...state.notifications, newNotification]
    }));

    // Auto remove after duration (default 5s)
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      }));
    }, notification.duration || 5000);
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }));
  }
}));

// Helper function for quick access
export const notify = {
  success: (title: string, message: string = '') => 
    useNotificationStore.getState().addNotification({ type: 'success', title, message }),
  error: (title: string, message: string = '') => 
    useNotificationStore.getState().addNotification({ type: 'error', title, message }),
  warning: (title: string, message: string = '') => 
    useNotificationStore.getState().addNotification({ type: 'warning', title, message }),
  info: (title: string, message: string = '') => 
    useNotificationStore.getState().addNotification({ type: 'info', title, message }),
};
