import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function useInactivityTimeout() {
  const { isAuthenticated, logout } = useAuthStore();
  const timerRef = useRef<number | null>(null);

  const resetTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    
    if (isAuthenticated) {
      timerRef.current = window.setTimeout(() => {
        console.log('User inactive for 30 minutes, logging out...');
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  };

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    if (isAuthenticated) {
      events.forEach(event => {
        window.addEventListener(event, resetTimer);
      });
      
      resetTimer(); // Initialize timer
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated, logout]);
}
