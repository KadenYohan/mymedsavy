import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import DrugAutocomplete from '@/components/DrugAutocomplete';

interface AddMedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (med: {
    name: string;
    dosage: string;
    strength: string;
    form: string;
    frequency: string;
    timeSlot: string;
    instructions: string;
    startDate?: string;
  }) => void;
  initialName?: string;
}

const FREQUENCY_OPTIONS = [
  { value: 'Once daily', label: 'Once daily', description: 'One dose per day' },
  { value: 'Twice daily', label: 'Twice daily', description: '8:00 AM & 8:00 PM' },
  { value: 'Three times daily', label: 'Three times daily', description: '8:00 AM, 12:00 PM & 8:00 PM' },
  { value: 'Every 4 hours', label: 'Every 4 hours', description: '6 doses per day' },
  { value: 'Every 6 hours', label: 'Every 6 hours', description: '4 doses per day' },
  { value: 'Every 8 hours', label: 'Every 8 hours', description: '3 doses per day' },
  { value: 'Weekly', label: 'Weekly', description: 'Once per week' },
  { value: 'As needed', label: 'As needed', description: 'Take when required' },
];

function getSmartSchedule(frequency: string): string {
  switch (frequency) {
    case 'Once daily':
      return '→ Scheduled: 8:00 AM';
    case 'Twice daily':
      return '→ Scheduled: 8:00 AM & 8:00 PM';
    case 'Three times daily':
      return '→ Scheduled: 8:00 AM, 12:00 PM & 8:00 PM';
    case 'Every 4 hours':
      return '→ Scheduled: 6:00 AM, 10:00 AM, 2:00 PM, 6:00 PM, 10:00 PM';
    case 'Every 6 hours':
      return '→ Scheduled: 6:00 AM, 12:00 PM, 6:00 PM, 12:00 AM';
    case 'Every 8 hours':
      return '→ Scheduled: 8:00 AM, 4:00 PM, 12:00 AM';
    case 'Weekly':
      return '→ Scheduled: Once per week (same day each week)';
    default:
      return '';
  }
}

export default function AddMedDialog({ open, onOpenChange, onAdd, initialName = '' }: AddMedDialogProps) {
  const [name, setName] = useState(initialName);
  const [dosage, setDosage] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState('Tablet');
  const [frequency, setFrequency] = useState('Once daily');
  const [timeSlot, setTimeSlot] = useState('morning');
  const [instructions, setInstructions] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (open && initialName) {
      setName(initialName);
    }
  }, [open, initialName]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName('');
      setDosage('');
      setStrength('');
      setForm('Tablet');
      setFrequency('Once daily');
      setTimeSlot('morning');
      setInstructions('');
      setStartDate(new Date());
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    onAdd({
      name: name.trim(),
      dosage: dosage.trim(),
      strength: strength.trim(),
      form,
      frequency,
      timeSlot,
      instructions: instructions.trim(),
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
    });
    handleOpenChange(false);
  };

  const schedule = getSmartSchedule(frequency);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Add Medication</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <DrugAutocomplete
              value={name}
              onChange={setName}
              placeholder="e.g. Warfarin"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Dosage</Label>
              <Input placeholder="e.g. 5mg" value={dosage} onChange={(e) => setDosage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Strength</Label>
              <Input placeholder="e.g. 500mg" value={strength} onChange={(e) => setStrength(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Form</Label>
              <Select value={form} onValueChange={setForm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Other'].map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">({opt.description})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {schedule && (
              <p className="text-xs text-primary font-medium px-1">{schedule}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Time Slot</Label>
            <Select value={timeSlot} onValueChange={setTimeSlot}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning (8:00 AM)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12:00 PM)</SelectItem>
                <SelectItem value="evening">Evening (8:00 PM)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Instructions</Label>
            <Input placeholder="e.g. After meal" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={!name.trim() || !dosage.trim()}>Add Medication</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
