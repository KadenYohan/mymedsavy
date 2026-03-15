import { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FdaInteraction {
  drug1: string;
  drug2: string;
  severity: 'high' | 'moderate' | 'low';
  summary: string;
}

const severityConfig = {
  high: { color: 'bg-danger/10 border-danger/30', badge: 'destructive' as const, icon: AlertTriangle, iconColor: 'text-danger' },
  moderate: { color: 'bg-warning/10 border-warning/30', badge: 'secondary' as const, icon: Info, iconColor: 'text-warning' },
  low: { color: 'bg-muted border-border', badge: 'outline' as const, icon: Info, iconColor: 'text-muted-foreground' },
};

function InteractionCard({ interaction }: { interaction: FdaInteraction }) {
  const config = severityConfig[interaction.severity];
  const Icon = config.icon;
  return (
    <Card className={cn('p-4 animate-slide-up', config.color)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', config.iconColor)} />
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{interaction.drug1} + {interaction.drug2}</span>
            <Badge variant={config.badge} className="capitalize text-xs">{interaction.severity} risk</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{interaction.summary}</p>
        </div>
      </div>
    </Card>
  );
}

export default function Safety() {
  const { user } = useAuth();
  const [medNames, setMedNames] = useState<string[]>([]);
  const [interactions, setInteractions] = useState<FdaInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('medications')
      .select('name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .then(({ data }) => {
        const names = (data ?? []).map((m) => m.name);
        setMedNames(names);
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (medNames.length < 2) {
      setInteractions([]);
      return;
    }
    checkFdaInteractions();
  }, [medNames]);

  const checkFdaInteractions = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-interactions', {
        body: { medications: medNames },
      });
      if (error) throw error;
      setInteractions(data?.interactions ?? []);
    } catch (e) {
      console.error('Failed to check interactions:', e);
      setInteractions([]);
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Interaction Checker</h2>
        <p className="text-sm text-muted-foreground">
          Analyzing {medNames.length} medications using openFDA data
        </p>
      </div>

      {checking ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-10 w-10 mx-auto mb-3 text-primary animate-spin" />
          <p className="font-display font-semibold text-lg">Checking Interactions</p>
          <p className="text-sm text-muted-foreground mt-1">Cross-referencing your medications with the FDA database...</p>
        </Card>
      ) : interactions.length === 0 ? (
        <Card className="p-8 text-center">
          <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-success" />
          <p className="font-display font-semibold text-lg">All Clear</p>
          <p className="text-sm text-muted-foreground mt-1">
            {medNames.length < 2
              ? 'Add at least 2 medications to your vault to check for interactions.'
              : 'No known interactions detected between your current medications.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            <span>
              {interactions.length} interaction{interactions.length > 1 ? 's' : ''} detected
            </span>
          </div>
          {interactions.map((interaction, i) => (
            <InteractionCard key={i} interaction={interaction} />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/70 text-center">
        Data sourced from openFDA. This is a brief summary — always consult your healthcare provider for full medical advice.
      </p>
    </div>
  );
}
