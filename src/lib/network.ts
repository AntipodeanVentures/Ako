import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// Bridges React Native connectivity into TanStack Query. Once wired,
// queries refetch when the connection returns, and mutations made while
// offline are paused and resume automatically rather than failing.
export function initNetwork(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // isInternetReachable is null while still being determined; treat
      // that as online so a brief unknown does not block logging.
      setOnline(
        Boolean(state.isConnected) && state.isInternetReachable !== false,
      );
    }),
  );
}

// Whether the device currently has a usable connection.
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}
