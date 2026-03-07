import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface ConnectivityContextValue {
  isConnected: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({ isConnected: true });

function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isConnected }}>{children}</ConnectivityContext.Provider>
  );
}

function useConnectivity(): ConnectivityContextValue {
  return useContext(ConnectivityContext);
}

export { ConnectivityProvider, useConnectivity };
