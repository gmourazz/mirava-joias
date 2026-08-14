import { useEffect, useState } from "react";

export function useAutoCarousel(count: number, intervalMs: number) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs]);

  const prev = () => setIndex((i) => (i + count - 1) % count);
  const next = () => setIndex((i) => (i + 1) % count);

  return { index, setIndex, prev, next };
}
