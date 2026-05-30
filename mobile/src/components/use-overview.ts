import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/use-auth";
import { getTikchopOverview } from "@/lib/tikchop-api";
import { TikchopOverview } from "@/types/tikchop";

export function useOverview() {
  const { seller } = useAuth();
  const [overview, setOverview] = useState<TikchopOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await getTikchopOverview({ sellerId: seller?.id });
    setOverview(next);
    setLoading(false);
  }, [seller?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { overview, loading, refresh };
}
