import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isFieldOnlyRole } from "../auth/authorization";
import {
  DPR_OUTBOX_EVENT,
  dprOutbox,
  getDprOutboxSummary,
} from "../utils/offlineDprOutbox";
import { syncQueuedDprEntry } from "../utils/offlineDprSync";
import { getNetworkStatus } from "../utils/pwa";

const getSyncMessage = (result) => {
  if (result.synced.length > 0 && result.failed.length === 0) {
    return `${result.synced.length} local site update${result.synced.length > 1 ? "s" : ""} synchronized.`;
  }
  if (result.synced.length > 0) {
    return `${result.synced.length} local site update${result.synced.length > 1 ? "s" : ""} synchronized; ${result.failed.length} still need${result.failed.length === 1 ? "s" : ""} attention.`;
  }
  return "";
};

export const useDprOutboxSync = ({ userId, role } = {}) => {
  const [isOnline, setIsOnline] = useState(getNetworkStatus);
  const [entries, setEntries] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const syncLockRef = useRef(false);
  const fieldOnly = isFieldOnlyRole(role);
  const owner = String(userId || "").trim();

  const refresh = useCallback(async () => {
    if (!owner || !fieldOnly) {
      setEntries([]);
      return [];
    }

    await dprOutbox.recoverInterruptedSyncs(owner);
    const nextEntries = await dprOutbox.list(owner);
    setEntries(nextEntries);
    return nextEntries;
  }, [fieldOnly, owner]);

  const synchronize = useCallback(async () => {
    if (!owner || !fieldOnly || !getNetworkStatus() || syncLockRef.current) {
      return { synced: [], failed: [], skipped: [] };
    }

    syncLockRef.current = true;
    setIsSyncing(true);
    try {
      const result = await dprOutbox.sync({
        userId: owner,
        syncEntry: (entry) => syncQueuedDprEntry({ entry, userId: owner }),
      });
      const message = getSyncMessage(result);
      if (message) setSyncMessage(message);
      await refresh();
      return result;
    } finally {
      syncLockRef.current = false;
      setIsSyncing(false);
    }
  }, [fieldOnly, owner, refresh]);

  const queueDpr = useCallback(async (options) => {
    if (!owner || !fieldOnly) {
      throw new Error("Only the active field user can queue a local site update.");
    }

    const result = await dprOutbox.enqueue({ ...options, userId: owner });
    setSyncMessage("");
    await refresh();
    return result;
  }, [fieldOnly, owner, refresh]);

  const retryPending = useCallback(async () => {
    if (!owner || !fieldOnly) return null;
    const entriesToRetry = await dprOutbox.list(owner);
    await Promise.all(
      entriesToRetry
        .filter((entry) => entry.retryable !== false)
        .map((entry) => dprOutbox.retry(owner, entry.clientSubmissionId))
    );
    await refresh();
    return synchronize();
  }, [fieldOnly, owner, refresh, synchronize]);

  useEffect(() => {
    const updateNetworkStatus = () => setIsOnline(getNetworkStatus());
    updateNetworkStatus();
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await refresh();
      } catch (error) {
        if (active) setSyncMessage("Local synchronization status could not be loaded on this device.");
      }
    };
    void load();

    const onOutboxChange = () => { void load(); };
    window.addEventListener(DPR_OUTBOX_EVENT, onOutboxChange);
    return () => {
      active = false;
      window.removeEventListener(DPR_OUTBOX_EVENT, onOutboxChange);
    };
  }, [refresh]);

  useEffect(() => {
    if (fieldOnly && owner && isOnline) void synchronize();
  }, [fieldOnly, isOnline, owner, synchronize]);

  return {
    isOnline,
    entries,
    summary: useMemo(() => getDprOutboxSummary(entries), [entries]),
    isSyncing,
    syncMessage,
    queueDpr,
    retryPending,
    synchronize,
    refresh,
  };
};