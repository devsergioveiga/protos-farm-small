import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import NetInfo from '@react-native-community/netinfo';

type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';

interface ConnectivityContextValue {
  /** Whether the device currently has internet connectivity. */
  isConnected: boolean;
  /** The type of network connection (wifi, cellular, none, unknown). */
  connectionType: ConnectionType;
  /** ISO timestamp of the last time the device was online. Null if never observed online. */
  lastOnlineAt: string | null;
  /** How many hours the device has been continuously offline. 0 if online. */
  offlineDurationHours: number;
  /** True if offline for more than 24 hours. */
  showOfflineAlert: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({
  isConnected: true,
  connectionType: 'unknown',
  lastOnlineAt: null,
  offlineDurationHours: 0,
  showOfflineAlert: false,
});

function mapConnectionType(type: string): ConnectionType {
  switch (type) {
    case 'wifi':
      return 'wifi';
    case 'cellular':
      return 'cellular';
    case 'none':
      return 'none';
    default:
      return 'unknown';
  }
}

/** Interval for updating offline duration (every 60 seconds). */
const DURATION_UPDATE_INTERVAL_MS = 60_000;

function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<ConnectionType>('unknown');
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
  const [offlineDurationHours, setOfflineDurationHours] = useState(0);
  const lastOnlineAtRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);
      setConnectionType(mapConnectionType(state.type));

      if (connected) {
        const now = new Date().toISOString();
        setLastOnlineAt(now);
        lastOnlineAtRef.current = now;
        setOfflineDurationHours(0);
      }
    });

    return () => unsubscribe();
  }, []);

  // Periodically update offline duration when disconnected
  useEffect(() => {
    if (isConnected) return;

    const updateDuration = () => {
      if (!lastOnlineAtRef.current) {
        setOfflineDurationHours(0);
        return;
      }
      const elapsed = Date.now() - new Date(lastOnlineAtRef.current).getTime();
      setOfflineDurationHours(elapsed / (1000 * 60 * 60));
    };

    updateDuration();
    const interval = setInterval(updateDuration, DURATION_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected]);

  const showOfflineAlert = !isConnected && offlineDurationHours >= 24;

  const value = useMemo<ConnectivityContextValue>(
    () => ({
      isConnected,
      connectionType,
      lastOnlineAt,
      offlineDurationHours,
      showOfflineAlert,
    }),
    [isConnected, connectionType, lastOnlineAt, offlineDurationHours, showOfflineAlert],
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

function useConnectivity(): ConnectivityContextValue {
  return useContext(ConnectivityContext);
}

export { ConnectivityProvider, useConnectivity };
