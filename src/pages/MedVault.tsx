import { useState, useEffect } from 'react';
import { Plus, Trash2, Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { checkInteractions } from '@/lib/interactionEngine';
import DrugInfoPanel from '@/components/DrugInfoPanel';
import DrugAutocomplete from '@/components/DrugAutocomplete';
import AddMedDialog from '@/components/AddMedDialog';
import type { Tables } from '@/integrations/supabase/types';
import type { DrugSuggestion } from '@/hooks/useDrugSearch';

type Medication = Tables<'medications'>;

export default function MedVault() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [prefillName, setPrefillName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchMedications();
  }, [user]);

  const fetchMedications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setMedications(data ?? []);
    setLoading(false);
  };

  // Filter existing meds by search term
  const filtered = medications.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search term doesn't match any existing med (for quick-add)
  const isNewDrug = search.trim().length >= 2 && !medications.some(
    (m) => m.name.toLowerCase() === search.trim().toLowerCase()
  );

  const handleQuickAdd = (suggestion: DrugSuggestion) => {
    setPrefillName(suggestion.displayName);
    setSearch('');
    setOpen(true);
  };

  const handleAdd = async (med: {
    name: string;
    dosage: string;
    strength: string;
    form: string;
    frequency: string;
    timeSlot: string;
    instructions: string;
  }) => {
    if (!user) return;

    // Safety check
    const currentNames = medications.map((m) => m.name);
    const interactions = checkInteractions([...currentNames, med.name]);
    const major = interactions.find((i) => i.severity === 'high');
    if (major) {
      toast({
        title: '⚠️ Major Interaction Detected',
        description: major.message,
        variant: 'destructive',
      });
    }

    const { error } = await supabase.from('medications').insert({
      user_id: user.id,
      name: med.name,
      dosage: med.dosage,
      strength: med.strength,
      form: med.form,
      frequency: med.frequency,
      time_slot: med.timeSlot,
      instructions: med.instructions,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    fetchMedications();
    toast({ title: 'Medication added', description: `${med.name} has been added to your vault.` });
  };

  const handleRemove = async (id: string) => {
    await supabase.from('medications').update({ is_active: false }).eq('id', id);
    fetchMedications();
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Med Vault</h2>
          <p className="text-sm text-muted-foreground">{medications.length} active medications</p>
        </div>
        <Button onClick={() => { setPrefillName(''); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add Med
        </Button>
      </div>

      <AddMedDialog
        open={open}
        onOpenChange={setOpen}
        onAdd={handleAdd}
        initialName={prefillName}
      />

      {/* Combined search / quick-add bar */}
      <DrugAutocomplete
        value={search}
        onChange={setSearch}
        onSelect={handleQuickAdd}
        placeholder="Search or add a new medication..."
        showSearchIcon
      />

      <div className="space-y-3">
        {filtered.map((med) => (
          <Card key={med.id} className="flex items-center justify-between p-4 animate-slide-up">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Pill className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{med.name}</p>
                <p className="text-sm text-muted-foreground">
                  {med.dosage} · {med.frequency}
                  {med.instructions ? ` · ${med.instructions}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-3">
              <Badge variant="secondary" className="capitalize text-xs">{med.time_slot}</Badge>
              <DrugInfoPanel drugName={med.name} />
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-danger" onClick={() => handleRemove(med.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && !isNewDrug && (
          <div className="text-center py-12 text-muted-foreground">
            <Pill className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No medications found</p>
          </div>
        )}
      </div>
    </div>
  );
}
