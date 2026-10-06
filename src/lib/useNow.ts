import { useEffect, useState } from "react";
import { nowLocal } from "./dates.ts";

/** The current local time as "YYYY-MM-DDTHH:mm", refreshed every 15 seconds. */
export function useNow(): string {
  const [now, setNow] = useState(nowLocal);
  useEffect(() => {
    const id = setInterval(() => setNow(nowLocal()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
