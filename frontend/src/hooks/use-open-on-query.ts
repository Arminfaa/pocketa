"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * When URL has `?key=value`, run `onOpen` once then strip the query (replace pathname).
 * Used by bottom-nav add shortcuts to open create modals.
 */
export function useOpenOnQuery(
  key: string,
  value: string,
  pathname: string,
  onOpen: () => void
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (searchParams.get(key) !== value) return;
    onOpenRef.current();
    router.replace(pathname, { scroll: false });
  }, [searchParams, router, key, value, pathname]);
}
