import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/stores/AuthContext';

/**
 * Refreshes the session token when the app returns to foreground.
 * This keeps the session alive as long as the user opens the app
 * at least once within the refresh token's validity window (7 days).
 */
export function useSessionKeepAlive() {
  const { isAuthenticated, refreshSession } = useAuth();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        void refreshSession();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, refreshSession]);
}
