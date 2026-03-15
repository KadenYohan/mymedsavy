import { create } from 'zustand';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
}

export interface DoseEntry {
  medId: string;
  taken: boolean;
  takenAt?: Date;
}

interface MedStore {
  medications: Medication[];
  doses: Record<string, DoseEntry>;
  addMedication: (med: Omit<Medication, 'id'>) => void;
  removeMedication: (id: string) => void;
  markDoseTaken: (medId: string) => void;
  unmarkDose: (medId: string) => void;
}

const DEFAULT_MEDS: Medication[] = [
  { id: '1', name: 'Aspirin', dosage: '81mg', frequency: 'Once daily', timeSlot: 'morning' },
  { id: '2', name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', timeSlot: 'morning' },
  { id: '3', name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', timeSlot: 'afternoon' },
  { id: '4', name: 'Atorvastatin', dosage: '20mg', frequency: 'Once daily', timeSlot: 'evening' },
];

export const useMedStore = create<MedStore>((set) => ({
  medications: DEFAULT_MEDS,
  doses: {},
  addMedication: (med) =>
    set((state) => ({
      medications: [
        ...state.medications,
        { ...med, id: crypto.randomUUID() },
      ],
    })),
  removeMedication: (id) =>
    set((state) => ({
      medications: state.medications.filter((m) => m.id !== id),
      doses: Object.fromEntries(
        Object.entries(state.doses).filter(([key]) => key !== id)
      ),
    })),
  markDoseTaken: (medId) =>
    set((state) => ({
      doses: {
        ...state.doses,
        [medId]: { medId, taken: true, takenAt: new Date() },
      },
    })),
  unmarkDose: (medId) =>
    set((state) => ({
      doses: {
        ...state.doses,
        [medId]: { medId, taken: false },
      },
    })),
}));
