import React, { createContext, useState, useContext, ReactNode, useCallback } from "react";

export type CreateCircleWizardState = {
  type: string | null;
  name: string;
  amount: number;
  frequency: string;
  memberCount: number;
  startDate: string;
  gracePeriodDays: number;
  rotationMethod: string;
  invitedMembers: Array<{ id: number; name: string; phone: string }>;
  description: string;
  emoji: string;
  location: string;
  minScore: number;
};

type CreateCircleWizardContextType = {
  state: CreateCircleWizardState;
  updateField: <K extends keyof CreateCircleWizardState>(
    field: K,
    value: CreateCircleWizardState[K]
  ) => void;
  updateFields: (fields: Partial<CreateCircleWizardState>) => void;
  resetWizard: () => void;
  isComplete: boolean;
};

const initialState: CreateCircleWizardState = {
  type: null,
  name: "",
  amount: 100,
  frequency: "monthly",
  memberCount: 6,
  startDate: "",
  gracePeriodDays: 2,
  rotationMethod: "xnscore",
  invitedMembers: [],
  description: "",
  emoji: "",
  location: "",
  minScore: 0,
};

const CreateCircleWizardContext = createContext<CreateCircleWizardContextType | undefined>(undefined);

export const useCreateCircleWizard = () => {
  const context = useContext(CreateCircleWizardContext);
  if (!context) {
    throw new Error("useCreateCircleWizard must be used within CreateCircleWizardProvider");
  }
  return context;
};

export const CreateCircleWizardProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<CreateCircleWizardState>(initialState);

  const updateField = useCallback(<K extends keyof CreateCircleWizardState>(
    field: K,
    value: CreateCircleWizardState[K]
  ) => {
    setState(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateFields = useCallback((fields: Partial<CreateCircleWizardState>) => {
    setState(prev => ({ ...prev, ...fields }));
  }, []);

  const resetWizard = useCallback(() => {
    setState(initialState);
  }, []);

  const isComplete = Boolean(
    state.type && state.name && state.amount > 0 && state.frequency && state.memberCount > 0
  );

  return (
    <CreateCircleWizardContext.Provider value={{ state, updateField, updateFields, resetWizard, isComplete }}>
      {children}
    </CreateCircleWizardContext.Provider>
  );
};
