import { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Loader2, AlertCircle, Pill, ShieldAlert, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DrugInfo {
  indications: string;
  adverse: string;
  interactions: string;
  source: string;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  content: string;
  colorClass: string;
  defaultOpen?: boolean;
}

function InfoSection({ title, icon, content, colorClass, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'flex items-center justify-between w-full px-4 py-3 rounded-lg text-left transition-colors',
            'hover:bg-muted/50',
            colorClass
          )}
        >
          <div className="flex items-center gap-2 font-medium text-sm">
            {icon}
            {title}
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-3 pt-1">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {lines.map((line, i) => (
            <li key={i} className="leading-relaxed">
              {line.startsWith('•') ? line : `• ${line}`}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function DrugInfoPanel({ drugName }: { drugName: string }) {
  const [info, setInfo] = useState<DrugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchInfo = async () => {
    if (info) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setExpanded(true);

    try {
      const { data, error } = await supabase.functions.invoke('drug-info', {
        body: { drugName },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: 'Could not load info', description: data.error, variant: 'destructive' });
        setExpanded(false);
      } else {
        setInfo(data as DrugInfo);
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch drug information.', variant: 'destructive' });
      setExpanded(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Button
        variant="ghost"
        size="icon"
        onClick={fetchInfo}
        disabled={loading}
        className="h-8 w-8 text-muted-foreground hover:text-primary"
        title={`Info about ${drugName}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Info className="h-4 w-4" />
        )}
      </Button>

      {expanded && info && (
        <Card className="mt-2 overflow-hidden animate-slide-up">
          <div className="p-3 border-b bg-muted/30">
            <h4 className="font-display font-semibold text-sm">{drugName} — Quick Summary</h4>
          </div>

          <div className="divide-y">
            <InfoSection
              title="What it's for"
              icon={<Pill className="h-4 w-4 text-primary" />}
              content={info.indications}
              colorClass="text-foreground"
              defaultOpen
            />
            <InfoSection
              title="What to look out for"
              icon={<AlertCircle className="h-4 w-4 text-warning" />}
              content={info.adverse}
              colorClass="text-foreground"
            />
            <InfoSection
              title="Do not mix with"
              icon={<Ban className="h-4 w-4 text-danger" />}
              content={info.interactions}
              colorClass="text-foreground"
            />
          </div>

          <p className="px-4 py-2 text-[11px] text-muted-foreground/70 border-t bg-muted/20">
            This is a brief summary. Always consult your healthcare provider for full medical advice.
          </p>
        </Card>
      )}
    </div>
  );
}
