import { useEffect, useState, type DependencyList } from 'react';

type Result = { data: unknown; error: { message?: string; code?: string } | null };

// Если ответ Supabase содержит ошибку, бросаем её, чтобы обработать в одном месте.
export function unwrap<T>(res: Result): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (alive) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(e);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
