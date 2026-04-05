// ══════════════════════════════════════════════════════════════════════════════
// HOOKS: Mock-to-Real Migration Priority Scoring (#193)
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for tracking migration progress across all UI screens.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MockToRealMigrationEngine,
  MigrationScreen,
  MigrationAuditEntry,
  MigrationDashboard,
  MigrationSummary,
  MigrationStatus,
  MigrationModule,
  WaveNumber,
  WaveProgress,
  UpdateScreenParams,
  ScoreUpdateParams,
} from '../services/MockToRealMigrationEngine';

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  1. useMigrationDashboard — Full dashboard with all data               │
// └──────────────────────────────────────────────────────────────────────────┘

export function useMigrationDashboard() {
  const [dashboard, setDashboard] = useState<MigrationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await MockToRealMigrationEngine.getDashboard();
      setDashboard(data);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime updates
  useEffect(() => {
    const channel = MockToRealMigrationEngine.subscribeToChanges(() => {
      fetch();
    });
    return () => { channel.unsubscribe(); };
  }, [fetch]);

  return { dashboard, loading, error, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  2. useMigrationScreens — All screens with filtering                   │
// └──────────────────────────────────────────────────────────────────────────┘

export function useMigrationScreens(filters?: {
  wave?: WaveNumber;
  module?: MigrationModule;
  status?: MigrationStatus;
}) {
  const [screens, setScreens] = useState<MigrationScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      let data: MigrationScreen[];

      if (filters?.wave) {
        data = await MockToRealMigrationEngine.getScreensByWave(filters.wave);
      } else if (filters?.module) {
        data = await MockToRealMigrationEngine.getScreensByModule(filters.module);
      } else {
        data = await MockToRealMigrationEngine.getAllScreens();
      }

      if (filters?.status) {
        data = data.filter(s => s.status === filters.status);
      }

      setScreens(data);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load screens');
    } finally {
      setLoading(false);
    }
  }, [filters?.wave, filters?.module, filters?.status]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Computed
  const byWave = useMemo(() => {
    const grouped: Record<number, MigrationScreen[]> = {};
    screens.forEach(s => {
      if (!grouped[s.wave]) grouped[s.wave] = [];
      grouped[s.wave].push(s);
    });
    return grouped;
  }, [screens]);

  const byModule = useMemo(() => {
    const grouped: Record<string, MigrationScreen[]> = {};
    screens.forEach(s => {
      if (!grouped[s.module]) grouped[s.module] = [];
      grouped[s.module].push(s);
    });
    return grouped;
  }, [screens]);

  const byStatus = useMemo(() => {
    const grouped: Record<MigrationStatus, MigrationScreen[]> = {
      mock: [], in_progress: [], connected: [], verified: [], blocked: [],
    };
    screens.forEach(s => grouped[s.status].push(s));
    return grouped;
  }, [screens]);

  return { screens, byWave, byModule, byStatus, loading, error, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  3. useMigrationScreen — Single screen detail                          │
// └──────────────────────────────────────────────────────────────────────────┘

export function useMigrationScreen(screenCode: string) {
  const [screen, setScreen] = useState<MigrationScreen | null>(null);
  const [auditLog, setAuditLog] = useState<MigrationAuditEntry[]>([]);
  const [dependencies, setDependencies] = useState<MigrationScreen[]>([]);
  const [canStart, setCanStart] = useState<{ allowed: boolean; reason?: string }>({ allowed: false });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const [screenData, logData, depData, startCheck] = await Promise.all([
        MockToRealMigrationEngine.getScreen(screenCode),
        MockToRealMigrationEngine.getAuditLog(screenCode, 20),
        MockToRealMigrationEngine.getDependencyTree(screenCode),
        MockToRealMigrationEngine.canStart(screenCode),
      ]);
      setScreen(screenData);
      setAuditLog(logData);
      setDependencies(depData);
      setCanStart(startCheck);
    } catch (err) {
      console.error('Failed to load screen:', err);
    } finally {
      setLoading(false);
    }
  }, [screenCode]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { screen, auditLog, dependencies, canStart, loading, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  4. useMigrationWaves — Wave progress overview                         │
// └──────────────────────────────────────────────────────────────────────────┘

export function useMigrationWaves() {
  const [summary, setSummary] = useState<MigrationSummary[]>([]);
  const [currentWave, setCurrentWave] = useState<WaveNumber>(1);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryData, wave] = await Promise.all([
        MockToRealMigrationEngine.getMigrationSummary(),
        MockToRealMigrationEngine.getCurrentWave(),
      ]);
      setSummary(summaryData);
      setCurrentWave(wave);
    } catch (err) {
      console.error('Failed to load wave status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const waves: WaveProgress[] = useMemo(() => {
    return summary.map(s => ({
      wave: s.wave as WaveNumber,
      label: s.wave === 1 ? 'Circles End-to-End' : s.wave === 2 ? 'Dashboard + Elder + Community' : 'Goals + Remaining',
      totalScreens: s.total,
      completedScreens: s.connected + s.verified,
      percentComplete: s.completionPct,
      isBlocked: s.blocked > 0,
      canStart: s.wave === 1 || (summary.find(prev => prev.wave === s.wave - 1)?.completionPct ?? 0) === 100,
    }));
  }, [summary]);

  return { summary, waves, currentWave, loading, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  5. useMigrationActions — Mutations for updating screens               │
// └──────────────────────────────────────────────────────────────────────────┘

export function useMigrationActions() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateScreen = useCallback(async (screenCode: string, params: UpdateScreenParams) => {
    try {
      setUpdating(true);
      setError(null);
      const result = await MockToRealMigrationEngine.updateScreen(screenCode, params);
      return result;
    } catch (err: any) {
      setError(err.message ?? 'Update failed');
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  const startWork = useCallback(async (screenCode: string) => {
    return updateScreen(screenCode, { status: 'in_progress' });
  }, [updateScreen]);

  const markConnected = useCallback(async (
    screenCode: string,
    service: string,
    table: string,
    hook?: string,
    notes?: string
  ) => {
    try {
      setUpdating(true);
      setError(null);
      return await MockToRealMigrationEngine.markConnected(screenCode, service, table, hook, notes);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  const markVerified = useCallback(async (screenCode: string, verifiedBy: string) => {
    try {
      setUpdating(true);
      setError(null);
      return await MockToRealMigrationEngine.markVerified(screenCode, verifiedBy);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  const blockScreen = useCallback(async (screenCode: string, reason: string) => {
    return updateScreen(screenCode, { status: 'blocked', blockedReason: reason });
  }, [updateScreen]);

  const unblockScreen = useCallback(async (screenCode: string) => {
    try {
      setUpdating(true);
      setError(null);
      return await MockToRealMigrationEngine.unblockScreen(screenCode);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  const updateScores = useCallback(async (screenCode: string, scores: ScoreUpdateParams) => {
    try {
      setUpdating(true);
      setError(null);
      return await MockToRealMigrationEngine.updateScores(screenCode, scores);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  const addNote = useCallback(async (screenCode: string, note: string) => {
    try {
      setError(null);
      await MockToRealMigrationEngine.addNote(screenCode, note);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    updating,
    error,
    updateScreen,
    startWork,
    markConnected,
    markVerified,
    blockScreen,
    unblockScreen,
    updateScores,
    addNote,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  6. useMigrationModuleProgress — Per-module breakdown                   │
// └──────────────────────────────────────────────────────────────────────────┘

export function useMigrationModuleProgress() {
  const [progress, setProgress] = useState<Record<string, { total: number; completed: number; pct: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await MockToRealMigrationEngine.getModuleProgress();
        setProgress(data);
      } catch (err) {
        console.error('Failed to load module progress:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { progress, loading };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  RE-EXPORT TYPES                                                       │
// └──────────────────────────────────────────────────────────────────────────┘

export type {
  MigrationScreen,
  MigrationAuditEntry,
  MigrationDashboard,
  MigrationSummary,
  MigrationStatus,
  MigrationModule,
  WaveNumber,
  WaveProgress,
  UpdateScreenParams,
  ScoreUpdateParams,
  WaveStatus,
};
