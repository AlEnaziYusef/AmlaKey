import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { setOnlineStatus } from "../lib/offlineDb";
import { processQueue, getPendingCount, SyncResult } from "../lib/syncQueue";

interface NetworkContextValue {
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastSyncResult: SyncResult | null;
  triggerSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  pendingSyncCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  lastSyncResult: null,
  triggerSync: async () => {},
  refreshPendingCount: async () => {},
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const syncingRef = useRef(false);

  // Monitor network state
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setIsOnline(online);
      setOnlineStatus(online);

      // Auto-sync when coming back online
      if (online) {
        triggerSync();
      }
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      const online = !!state.isConnected;
      setIsOnline(online);
      setOnlineStatus(online);
    });

    // Check pending count on mount
    refreshPendingCount();

    return () => unsubscribe();
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingSyncCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncingRef.current) return; // prevent concurrent syncs
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await processQueue();
      setLastSyncResult(result);
      setLastSyncAt(Date.now());
      if (result.errors.length > 0) {
        console.warn("[Sync] Errors:", result.errors);
      }
    } catch (e) {
      console.warn("[Sync] Failed:", e);
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        pendingSyncCount,
        isSyncing,
        lastSyncAt,
        lastSyncResult,
        triggerSync,
        refreshPendingCount,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
