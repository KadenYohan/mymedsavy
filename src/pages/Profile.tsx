import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { User, X, Save } from 'lucide-react';

const COMMON_ALLERGIES = ['Penicillin', 'Sulfa', 'Aspirin', 'NSAIDs', 'Codeine', 'Latex', 'Iodine'];
const COMMON_CONDITIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'Kidney Disease', 'Liver Disease', 'Thyroid Disorder'];

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [sex, setSex] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [customCondition, setCustomCondition] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAge(profile.age?.toString() || '');
      setWeight(profile.weight?.toString() || '');
      setSex(profile.sex || '');
      setAllergies(profile.allergies || []);
      setConditions(profile.chronic_conditions || []);
    }
  }, [profile]);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const addCustom = (value: string, list: string[], setList: (v: string[]) => void, setInput: (v: string) => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput('');
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          age: age ? parseInt(age) : null,
          weight: weight ? parseFloat(weight) : null,
          sex: sex || null,
          allergies,
          chronic_conditions: conditions,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      await refreshProfile();
      toast({ title: 'Profile updated', description: 'Your health profile has been saved.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">User Profile</h2>
          <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Personal Info</CardTitle>
          <CardDescription>Your basic health information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Age</Label>
              <Input type="number" placeholder="30" value={age} onChange={(e) => setAge(e.target.value)} min={1} max={120} />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} min={1} />
            </div>
            <div className="space-y-2">
              <Label>Sex</Label>
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Allergies</CardTitle>
          <CardDescription>Select known drug allergies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {COMMON_ALLERGIES.map((a) => (
              <Badge
                key={a}
                variant={allergies.includes(a) ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                onClick={() => toggleItem(allergies, setAllergies, a)}
              >
                {a}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add custom allergy..."
              value={customAllergy}
              onChange={(e) => setCustomAllergy(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom(customAllergy, allergies, setAllergies, setCustomAllergy))}
            />
            <Button variant="outline" size="sm" onClick={() => addCustom(customAllergy, allergies, setAllergies, setCustomAllergy)}>Add</Button>
          </div>
          {allergies.filter((a) => !COMMON_ALLERGIES.includes(a)).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allergies.filter((a) => !COMMON_ALLERGIES.includes(a)).map((a) => (
                <Badge key={a} variant="secondary">
                  {a}
                  <button onClick={() => setAllergies(allergies.filter((x) => x !== a))} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Chronic Conditions</CardTitle>
          <CardDescription>Select any existing conditions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {COMMON_CONDITIONS.map((c) => (
              <Badge
                key={c}
                variant={conditions.includes(c) ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                onClick={() => toggleItem(conditions, setConditions, c)}
              >
                {c}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add custom condition..."
              value={customCondition}
              onChange={(e) => setCustomCondition(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom(customCondition, conditions, setConditions, setCustomCondition))}
            />
            <Button variant="outline" size="sm" onClick={() => addCustom(customCondition, conditions, setConditions, setCustomCondition)}>Add</Button>
          </div>
          {conditions.filter((c) => !COMMON_CONDITIONS.includes(c)).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {conditions.filter((c) => !COMMON_CONDITIONS.includes(c)).map((c) => (
                <Badge key={c} variant="secondary">
                  {c}
                  <button onClick={() => setConditions(conditions.filter((x) => x !== c))} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button className="w-full" onClick={handleSave} disabled={loading}>
        <Save className="h-4 w-4 mr-2" />
        {loading ? 'Saving...' : 'Save Profile'}
      </Button>
    </div>
  );
}
