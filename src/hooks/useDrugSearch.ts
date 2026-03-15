import { useState, useEffect, useRef } from 'react';

export interface DrugSuggestion {
  brandName: string;
  genericName: string;
  displayName: string;
}

export function useDrugSearch(query: string, debounceMs = 300) {
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const encoded = encodeURIComponent(trimmed);
        const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:*${encoded}*+OR+openfda.generic_name:*${encoded}*&limit=10`;
        const resp = await fetch(url, { signal: controller.signal });

        if (!resp.ok) {
          setSuggestions([]);
          setLoading(false);
          return;
        }

        const json = await resp.json();
        const results: DrugSuggestion[] = [];
        const seen = new Set<string>();

        for (const item of json.results ?? []) {
          const brand = item.openfda?.brand_name?.[0] ?? '';
          const generic = item.openfda?.generic_name?.[0] ?? '';
          const key = `${brand.toLowerCase()}|${generic.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);

          results.push({
            brandName: brand,
            genericName: generic,
            displayName: brand || generic || 'Unknown',
          });
        }

        setSuggestions(results);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeout);
      abortRef.current?.abort();
    };
  }, [query, debounceMs]);

  return { suggestions, loading };
}
