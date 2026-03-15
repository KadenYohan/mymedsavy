import { useEffect, useState } from 'react';
import { Sun, Cloud, Moon, Check, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { hasHighRiskInteraction } from '@/lib/interactionEngine';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import DrugInfoPanel from '@/components/DrugInfoPanel';
import MedicationCalendar from '@/components/MedicationCalendar';
import type { Tables } from '@/integrations/supabase/types';

type Medication = Tables<'medications'>;

interface DoseState {
  [medId: string]: { taken: boolean; doseLogId?: string };
}

const TIME_SLOTS = [
  { key: 'morning', label: 'Morning', time: '8:00 AM', icon: Sun },
  { key: 'afternoon', label: 'Afternoon', time: '1:00 PM', icon: Cloud },
  { key: 'evening', label: 'Evening', time: '8:00 PM', icon: Moon },
];

function MedCard({
  med,
  taken,
  onToggle,
}: {
  med: Medication;
  taken: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={cn(
        'flex items-center justify-between p-4 transition-all duration-300 animate-slide-up',
        taken && 'med-card-taken animate-pulse-success'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300',
            taken ? 'bg-success' : 'bg-primary/10'
          )}
        >
          {taken ? (
            <Check className="h-5 w-5 text-success-foreground" />
          ) : (
            <span className="text-sm font-bold text-primary">{med.name.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className={cn('font-semibold truncate', taken && 'line-through text-muted-foreground')}>
            {med.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {med.dosage} · {med.frequency}
            {med.instructions ? ` · ${med.instructions}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-3">
        <DrugInfoPanel drugName={med.name} />
        <Button
          size="sm"
          variant={taken ? 'outline' : 'default'}
          onClick={onToggle}
          className={cn(
            'transition-all duration-300',
            taken && 'border-success text-success hover:bg-success/10'
          )}
        >
          {taken ? 'Undo' : 'Take'}
        </Button>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doses, setDoses] = useState<DoseState>({});
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const { data: meds } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    setMedications(meds ?? []);

    const startOfDay = new Date(todayStr + 'T00:00:00Z').toISOString();
    const endOfDay = new Date(todayStr + 'T23:59:59Z').toISOString();

    const { data: logs } = await supabase
      .from('dose_log')
      .select('*')
      .eq('user_id', user.id)
      .gte('scheduled_time', startOfDay)
      .lte('scheduled_time', endOfDay);

    const doseState: DoseState = {};
    (logs ?? []).forEach((log) => {
      if (log.status === 'taken') {
        doseState[log.medication_id] = { taken: true, doseLogId: log.id };
      }
    });
    setDoses(doseState);
    setLoading(false);
  };

  const toggleDose = async (med: Medication) => {
    if (!user) return;
    const current = doses[med.id];

    if (current?.taken && current.doseLogId) {
      await supabase
        .from('dose_log')
        .update({ status: 'pending', taken_time: null })
        .eq('id', current.doseLogId);

      setDoses((prev) => {
        const next = { ...prev };
        delete next[med.id];
        return next;
      });
    } else {
      const scheduledTime = new Date();
      const { data, error } = await supabase
        .from('dose_log')
        .insert({
          user_id: user.id,
          medication_id: med.id,
          scheduled_time: scheduledTime.toISOString(),
          taken_time: new Date().toISOString(),
          status: 'taken',
        })
        .select()
        .single();

      if (!error && data) {
        setDoses((prev) => ({
          ...prev,
          [med.id]: { taken: true, doseLogId: data.id },
        }));
        toast({ title: '✓ Dose logged', description: `${med.name} marked as taken` });
      }
    }
  };

  const takenCount = Object.values(doses).filter((d) => d.taken).length;
  const totalCount = medications.length;
  const progressPercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const highRisk = hasHighRiskInteraction(medications.map((m) => m.name));

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {highRisk && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30 animate-slide-up">
          <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-danger">High Risk Interaction</p>
            <p className="text-sm text-foreground/80">{highRisk.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold mb-1">
            {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 👋
          </h2>
          <p className="text-sm text-muted-foreground">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/vault')}>
          <Plus className="h-4 w-4 mr-1" /> Quick Add
        </Button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Daily Progress</span>
            <span className="text-sm text-muted-foreground">{takenCount} of {totalCount} taken</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </Card>
      )}

      {/* Today's medication agenda */}
      {totalCount === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-3">No medications added yet</p>
          <Button onClick={() => navigate('/vault')}>
            <Plus className="h-4 w-4 mr-1" /> Add Your First Medication
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {TIME_SLOTS.map((slot) => {
            const meds = medications.filter((m) => m.time_slot === slot.key);
            if (meds.length === 0) return null;

            return (
              <div key={slot.key} className="relative flex gap-4">
                <div className="flex flex-col items-center pt-1">
                  <div className="timeline-dot" />
                  <div className="timeline-line flex-1 mt-2" />
                </div>
                <div className="flex-1 pb-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <slot.icon className="h-4 w-4 text-primary" />
                    <span className="font-display font-semibold">{slot.label}</span>
                    <Badge variant="secondary" className="text-xs">{slot.time}</Badge>
                  </div>
                  {meds.map((med) => (
                    <MedCard
                      key={med.id}
                      med={med}
                      taken={doses[med.id]?.taken ?? false}
                      onToggle={() => toggleDose(med)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar */}
      <Card className="p-4">
        <h3 className="font-display font-bold text-lg mb-4">Medication Scheduler</h3>
        <MedicationCalendar />
      </Card>
    </div>
  );
}
