import { useState, useRef, useEffect } from 'react';
import { Loader2, Search, Pill } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDrugSearch, DrugSuggestion } from '@/hooks/useDrugSearch';
import { cn } from '@/lib/utils';

interface DrugAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: DrugSuggestion) => void;
  placeholder?: string;
  showSearchIcon?: boolean;
  className?: string;
}

export default function DrugAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'e.g. Warfarin',
  showSearchIcon = false,
  className,
}: DrugAutocompleteProps) {
  const { suggestions, loading } = useDrugSearch(value);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpen(suggestions.length > 0 || (loading && value.trim().length >= 2));
    setHighlightIndex(-1);
  }, [suggestions, loading, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (s: DrugSuggestion) => {
    onChange(s.displayName);
    onSelect?.(s);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        {showSearchIcon && (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(showSearchIcon && 'pl-10', loading && 'pr-10')}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
          {loading && suggestions.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching openFDA...
            </div>
          )}
          {!loading && suggestions.length === 0 && value.trim().length >= 2 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No matching drugs found
            </div>
          )}
          {suggestions.length > 0 && (
            <ul className="max-h-56 overflow-y-auto py-1">
              {suggestions.map((s, i) => (
                <li
                  key={`${s.brandName}-${s.genericName}-${i}`}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors',
                    i === highlightIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted/60'
                  )}
                  onMouseEnter={() => setHighlightIndex(i)}
                  onClick={() => handleSelect(s)}
                >
                  <Pill className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.brandName || s.genericName}</p>
                    {s.brandName && s.genericName && (
                      <p className="text-xs text-muted-foreground truncate">{s.genericName}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
