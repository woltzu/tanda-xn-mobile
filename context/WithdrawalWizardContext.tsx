import React, { createContext, useState, useContext, ReactNode, useCallback } from "react";

export type WithdrawalWizardState = {
  goalId: string | null;
  goalName: string;
  goalEmoji: string;
  tier: string;
  currentBalance: number;
  penaltyPercent: number;
  amount: number;
  penaltyAmount: number;
  receiveAmount: number;
  reason: string | null;
  transactionId: string | null;
  remainingBalance: number;
};

type WithdrawalWizardContextType = {
  state: WithdrawalWizardState;
  updateField: <K extends keyof WithdrawalWizardState>(
    field: K,
    value: WithdrawalWizardState[K]
  ) => void;
  updateFields: (fields: Partial<WithdrawalWizardState>) => void;
  resetWizard: () => void;
  initFromGoal: (goal: {
    id: string;
    name: string;
    emoji: string;
    type: string;
    currentBalance: number;
    earlyWithdrawalPenalty?: number;
  }) => void;
};

const initialState: WithdrawalWizardState = {
  goalId: null,
  goalName: "",
  goalEmoji: "",
  tier: "flexible",
  currentBalance: 0,
  penaltyPercent: 0,
  amount: 0,
  penaltyAmount: 0,
  receiveAmount: 0,
  reason: null,
  transactionId: null,
  remainingBalance: 0,
};

const WithdrawalWizardContext = createContext<WithdrawalWizardContextType | undefined>(undefined);

export const useWithdrawalWizard = () => {
  const context = useContext(WithdrawalWizardContext);
  if (!context) {
    throw new Error("useWithdrawalWizard must be used within WithdrawalWizardProvider");
  }
  return context;
};

export const WithdrawalWizardProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<WithdrawalWizardState>(initialState);

  const updateField = useCallback(<K extends keyof WithdrawalWizardState>(
    field: K,
    value: WithdrawalWizardState[K]
  ) => {
    setState(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateFields = useCallback((fields: Partial<WithdrawalWizardState>) => {
    setState(prev => ({ ...prev, ...fields }));
  }, []);

  const resetWizard = useCallback(() => {
    setState(initialState);
  }, []);

  const initFromGoal = useCallback((goal: {
    id: string;
    name: string;
    emoji: string;
    type: string;
    currentBalance: number;
    earlyWithdrawalPenalty?: number;
  }) => {
    setState({
      ...initialState,
      goalId: goal.id,
      goalName: goal.name,
      goalEmoji: goal.emoji,
      tier: goal.type,
      currentBalance: goal.currentBalance,
      penaltyPercent: (goal.earlyWithdrawalPenalty || 0) * 100,
    });
  }, []);

  return (
    <WithdrawalWizardContext.Provider value={{ state, updateField, updateFields, resetWizard, initFromGoal }}>
      {children}
    </WithdrawalWizardContext.Provider>
  );
};
