"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import type { OutboxItem } from "@/lib/offline/db";
import {
  countUnsyncedOutbox,
  listOutboxForUser,
  subscribeOutboxChanged,
} from "@/lib/offline/outbox";

export function useOfflineOutbox() {
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setCount(0);
      setLoading(false);
      return;
    }
    try {
      const [rows, n] = await Promise.all([
        listOutboxForUser(userId),
        countUnsyncedOutbox(userId),
      ]);
      setItems(rows);
      setCount(n);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    return subscribeOutboxChanged(() => {
      void refresh();
    });
  }, [refresh]);

  return { items, count, loading, refresh, userId };
}
