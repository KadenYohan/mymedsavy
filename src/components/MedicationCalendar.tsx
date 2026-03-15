import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, isSameDay, addDays, addWeeks, addMonths, addYears, subDays, subWeeks, subMonths, subYears, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, Pill, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Medication = Tables<'medications'>;
type DoseLog = Tables<'dose_log'>;

type ViewMode = 'day' | 'week' | 'month' | 'year';

interface ScheduledDose {
  medication: Medication;
  time: string;
  timeSlot: string;
  taken: boolean;
  doseLogId?: string;
}

const TIME_SLOT_TIMES: Record<string, string> = {
  morning: '8:00 AM',
  afternoon: '12:00 PM',
  evening: '8:00 PM',
};

const TIME_SLOT_ORDER = ['morning', 'afternoon', 'evening'];

function getScheduledDosesForDay(
  date: Date,
  medications: Medication[],
  doseLogs: DoseLog[]
): ScheduledDose[] {
  const dateStr = format(date, 'yyyy-MM-dd');
  const doses: ScheduledDose[] = [];

  for (const med of medications) {
    if (!med.is_active) continue;
    if (med.start_date && med.start_date > dateStr) continue;
    if (med.end_date && med.end_date < dateStr) continue;

    const slots = getTimeSlotsForFrequency(med.frequency, med.time_slot);
    for (const slot of slots) {
      const log = doseLogs.find(
        (l) =>
          l.medication_id === med.id &&
          l.scheduled_time.startsWith(dateStr) &&
          l.status === 'taken'
      );
      doses.push({
        medication: med,
        time: TIME_SLOT_TIMES[slot] || '8:00 AM',
        timeSlot: slot,
        taken: !!log,
        doseLogId: log?.id,
      });
    }
  }

  return doses.sort(
    (a, b) => TIME_SLOT_ORDER.indexOf(a.timeSlot) - TIME_SLOT_ORDER.indexOf(b.timeSlot)
  );
}

function getTimeSlotsForFrequency(frequency: string, defaultSlot: string): string[] {
  switch (frequency) {
    case 'Twice daily':
      return ['morning', 'evening'];
    case 'Three times daily':
      return ['morning', 'afternoon', 'evening'];
    default:
      return [defaultSlot];
  }
}

export default function MedicationCalendar() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDose, setSelectedDose] = useState<ScheduledDose | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, currentDate, viewMode]);

  const fetchData = async () => {
    if (!user) return;

    const { data: meds } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    setMedications(meds ?? []);

    const range = getDateRange();
    const { data: logs } = await supabase
      .from('dose_log')
      .select('*')
      .eq('user_id', user.id)
      .gte('scheduled_time', range.start.toISOString())
      .lte('scheduled_time', range.end.toISOString());

    setDoseLogs(logs ?? []);
    setLoading(false);
  };

  const getDateRange = () => {
    switch (viewMode) {
      case 'day':
        return { start: new Date(format(currentDate, 'yyyy-MM-dd') + 'T00:00:00'), end: new Date(format(currentDate, 'yyyy-MM-dd') + 'T23:59:59') };
      case 'week':
        return { start: startOfWeek(currentDate, { weekStartsOn: 0 }), end: endOfWeek(currentDate, { weekStartsOn: 0 }) };
      case 'month':
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
      case 'year':
        return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
    }
  };

  const navigate = (direction: 'prev' | 'next') => {
    const fn = direction === 'next'
      ? { day: addDays, week: addWeeks, month: addMonths, year: addYears }
      : { day: subDays, week: subWeeks, month: subMonths, year: subYears };
    setCurrentDate(fn[viewMode](currentDate, 1));
  };

  const toggleDose = async (dose: ScheduledDose, date: Date) => {
    if (!user) return;
    const dateStr = format(date, 'yyyy-MM-dd');

    if (dose.taken && dose.doseLogId) {
      await supabase
        .from('dose_log')
        .update({ status: 'pending', taken_time: null })
        .eq('id', dose.doseLogId);
    } else {
      await supabase.from('dose_log').insert({
        user_id: user.id,
        medication_id: dose.medication.id,
        scheduled_time: new Date(dateStr + 'T12:00:00').toISOString(),
        taken_time: new Date().toISOString(),
        status: 'taken',
      });
      toast({ title: '✓ Dose logged', description: `${dose.medication.name} marked as taken` });
    }
    fetchData();
  };

  const headerLabel = useMemo(() => {
    switch (viewMode) {
      case 'day': return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week': {
        const s = startOfWeek(currentDate, { weekStartsOn: 0 });
        const e = endOfWeek(currentDate, { weekStartsOn: 0 });
        return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
      }
      case 'month': return format(currentDate, 'MMMM yyyy');
      case 'year': return format(currentDate, 'yyyy');
    }
  }, [currentDate, viewMode]);

  if (loading) {
    return <div className="h-64 bg-muted animate-pulse rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-display font-semibold text-lg min-w-[200px] text-center">{headerLabel}</h3>
          <Button variant="outline" size="icon" onClick={() => navigate('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-2 h-6">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-2 h-6">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-2 h-6">Month</TabsTrigger>
              <TabsTrigger value="year" className="text-xs px-2 h-6">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Views */}
      {viewMode === 'day' && <DayView date={currentDate} medications={medications} doseLogs={doseLogs} onToggle={toggleDose} />}
      {viewMode === 'week' && <WeekView currentDate={currentDate} medications={medications} doseLogs={doseLogs} onSelectDate={(d) => { setSelectedDate(d); setViewMode('day'); setCurrentDate(d); }} />}
      {viewMode === 'month' && <MonthView currentDate={currentDate} medications={medications} doseLogs={doseLogs} onSelectDate={(d) => { setSelectedDate(d); setViewMode('day'); setCurrentDate(d); }} />}
      {viewMode === 'year' && <YearView currentDate={currentDate} medications={medications} doseLogs={doseLogs} onSelectMonth={(d) => { setCurrentDate(d); setViewMode('month'); }} />}

      {/* Dose detail dialog */}
      {selectedDose && (
        <Dialog open={!!selectedDose} onOpenChange={() => setSelectedDose(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{selectedDose.medication.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-primary" />
                <span className="text-sm">{selectedDose.medication.dosage} · {selectedDose.medication.form}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedDose.time} ({selectedDose.timeSlot})</span>
              </div>
              {selectedDose.medication.instructions && (
                <p className="text-sm text-muted-foreground">📋 {selectedDose.medication.instructions}</p>
              )}
              <Badge variant={selectedDose.taken ? 'default' : 'secondary'}>
                {selectedDose.taken ? '✓ Taken' : 'Pending'}
              </Badge>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ───── Day View ───── */
function DayView({
  date,
  medications,
  doseLogs,
  onToggle,
}: {
  date: Date;
  medications: Medication[];
  doseLogs: DoseLog[];
  onToggle: (dose: ScheduledDose, date: Date) => void;
}) {
  const doses = getScheduledDosesForDay(date, medications, doseLogs);

  if (doses.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Pill className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-muted-foreground">No medications scheduled for this day</p>
      </Card>
    );
  }

  const grouped = TIME_SLOT_ORDER.reduce<Record<string, ScheduledDose[]>>((acc, slot) => {
    const slotDoses = doses.filter((d) => d.timeSlot === slot);
    if (slotDoses.length > 0) acc[slot] = slotDoses;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([slot, slotDoses]) => (
        <div key={slot} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="timeline-dot" />
            <span className="font-display font-semibold capitalize">{slot}</span>
            <Badge variant="secondary" className="text-xs">{TIME_SLOT_TIMES[slot]}</Badge>
          </div>
          <div className="ml-5 space-y-2">
            {slotDoses.map((dose, i) => (
              <Card
                key={`${dose.medication.id}-${slot}-${i}`}
                className={cn(
                  'flex items-center justify-between p-3 transition-all',
                  dose.taken && 'med-card-taken'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    dose.taken ? 'bg-success' : 'bg-primary/10'
                  )}>
                    {dose.taken
                      ? <Check className="h-4 w-4 text-success-foreground" />
                      : <span className="text-xs font-bold text-primary">{dose.medication.name.charAt(0)}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className={cn('font-semibold text-sm truncate', dose.taken && 'line-through text-muted-foreground')}>
                      {dose.medication.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dose.medication.dosage}
                      {dose.medication.instructions ? ` · ${dose.medication.instructions}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={dose.taken ? 'outline' : 'default'}
                  onClick={() => onToggle(dose, date)}
                  className={cn('text-xs', dose.taken && 'border-success text-success hover:bg-success/10')}
                >
                  {dose.taken ? 'Undo' : 'Take'}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───── Week View ───── */
function WeekView({
  currentDate,
  medications,
  doseLogs,
  onSelectDate,
}: {
  currentDate: Date;
  medications: Medication[];
  doseLogs: DoseLog[];
  onSelectDate: (date: Date) => void;
}) {
  const start = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end: addDays(start, 6) });

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const doses = getScheduledDosesForDay(day, medications, doseLogs);
        const allTaken = doses.length > 0 && doses.every((d) => d.taken);
        const someTaken = doses.some((d) => d.taken);

        return (
          <Card
            key={day.toISOString()}
            onClick={() => onSelectDate(day)}
            className={cn(
              'p-2 cursor-pointer hover:border-primary/50 transition-all min-h-[100px]',
              isToday(day) && 'border-primary/50 bg-primary/5',
              allTaken && 'bg-success/5 border-success/30'
            )}
          >
            <p className={cn('text-xs font-medium mb-1', isToday(day) ? 'text-primary' : 'text-muted-foreground')}>
              {format(day, 'EEE')}
            </p>
            <p className={cn('text-lg font-display font-bold mb-1', isToday(day) && 'text-primary')}>
              {format(day, 'd')}
            </p>
            <div className="space-y-0.5">
              {doses.slice(0, 3).map((dose, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', dose.taken ? 'bg-success' : 'bg-primary/40')} />
                  <span className="text-[10px] truncate text-muted-foreground">{dose.medication.name}</span>
                </div>
              ))}
              {doses.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{doses.length - 3} more</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ───── Month View ───── */
function MonthView({
  currentDate,
  medications,
  doseLogs,
  onSelectDate,
}: {
  currentDate: Date;
  medications: Medication[];
  doseLogs: DoseLog[];
  onSelectDate: (date: Date) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = day.getMonth() === currentDate.getMonth();
          const doses = getScheduledDosesForDay(day, medications, doseLogs);
          const allTaken = doses.length > 0 && doses.every((d) => d.taken);
          const hasDoses = doses.length > 0;

          return (
            <div
              key={day.toISOString()}
              onClick={() => inMonth && onSelectDate(day)}
              className={cn(
                'relative p-1.5 text-center rounded-lg transition-all min-h-[48px] cursor-pointer',
                !inMonth && 'opacity-30 cursor-default',
                inMonth && 'hover:bg-accent',
                isToday(day) && 'bg-primary/10 ring-1 ring-primary/30',
                allTaken && inMonth && 'bg-success/10'
              )}
            >
              <span className={cn(
                'text-sm',
                isToday(day) && 'font-bold text-primary',
                !inMonth && 'text-muted-foreground'
              )}>
                {format(day, 'd')}
              </span>
              {hasDoses && inMonth && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {doses.slice(0, 3).map((dose, i) => (
                    <div key={i} className={cn('w-1.5 h-1.5 rounded-full', dose.taken ? 'bg-success' : 'bg-primary/40')} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───── Year View ───── */
function YearView({
  currentDate,
  medications,
  doseLogs,
  onSelectMonth,
}: {
  currentDate: Date;
  medications: Medication[];
  doseLogs: DoseLog[];
  onSelectMonth: (date: Date) => void;
}) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(currentDate.getFullYear(), i, 1));

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {months.map((month) => {
        const mStart = startOfMonth(month);
        const mEnd = endOfMonth(month);
        const daysInMonth = eachDayOfInterval({ start: mStart, end: mEnd });
        const isCurrentMonth = month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear();

        // Count days with all meds taken
        let daysWithDoses = 0;
        let daysComplete = 0;
        for (const day of daysInMonth) {
          const doses = getScheduledDosesForDay(day, medications, doseLogs);
          if (doses.length > 0) {
            daysWithDoses++;
            if (doses.every((d) => d.taken)) daysComplete++;
          }
        }
        const adherence = daysWithDoses > 0 ? Math.round((daysComplete / daysWithDoses) * 100) : 0;

        return (
          <Card
            key={month.toISOString()}
            onClick={() => onSelectMonth(month)}
            className={cn(
              'p-3 cursor-pointer hover:border-primary/50 transition-all',
              isCurrentMonth && 'border-primary/50 bg-primary/5'
            )}
          >
            <p className="font-display font-semibold text-sm mb-1">{format(month, 'MMMM')}</p>
            {daysWithDoses > 0 ? (
              <>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${adherence}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{adherence}% adherence</p>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">No data</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
