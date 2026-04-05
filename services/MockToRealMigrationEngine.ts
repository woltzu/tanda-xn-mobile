// ══════════════════════════════════════════════════════════════════════════════
// SERVICE: Mock-to-Real Migration Priority Scoring Engine (#193)
// ══════════════════════════════════════════════════════════════════════════════
// Tracks and manages the migration of every UI screen from mock/hardcoded
// data to real Supabase queries. Implements the 4-dimension scoring model
// and enforces wave-based build ordering.
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  A. TYPES                                                              │
// └──────────────────────────────────────────────────────────────────────────┘

export type MigrationStatus = 'mock' | 'in_progress' | 'connected' | 'verified' | 'blocked';
export type MigrationModule = 'Circles' | 'Dashboard' | 'Elder' | 'Community' | 'Goals' | 'Loans';
export type AuditAction = 'status_change' | 'score_update' | 'dependency_added' | 'note_added' | 'verification';
export type WaveNumber = 1 | 2 | 3;

export interface MigrationScreen {
  id: string;
  screenCode: string;
  screenName: string;
  module: MigrationModule;
  revenueImpact: number;
  memberExperience: number;
  dataCollection: number;
  backendReadiness: number;
  totalScore: number;
  wave: number;
  status: MigrationStatus;
  blockedReason: string | null;
  connectedService: string | null;
  connectedTable: string | null;
  connectedHook: string | null;
  connectionNotes: string | null;
  startedAt: string | null;
  connectedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  dependsOn: string[] | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MigrationAuditEntry {
  id: string;
  screenId: string;
  screenCode: string;
  action: AuditAction;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  performedBy: string;
  createdAt: string;
}

export interface WaveStatus {
  wave: number;
  totalScreens: number;
  connectedScreens: number;
  verifiedScreens: number;
  blockedScreens: number;
  startedAt: string | null;
  completedAt: string | null;
  targetCompletion: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface MigrationSummary {
  wave: number;
  total: number;
  mock: number;
  inProgress: number;
  connected: number;
  verified: number;
  blocked: number;
  completionPct: number;
}

export interface WaveProgress {
  wave: WaveNumber;
  label: string;
  totalScreens: number;
  completedScreens: number;
  percentComplete: number;
  isBlocked: boolean;
  canStart: boolean;
}

export interface MigrationDashboard {
  overallProgress: number;
  totalScreens: number;
  completedScreens: number;
  waves: WaveProgress[];
  currentWave: WaveNumber;
  nextScreen: MigrationScreen | null;
  blockedScreens: MigrationScreen[];
  recentActivity: MigrationAuditEntry[];
}

export interface UpdateScreenParams {
  status?: MigrationStatus;
  connectedService?: string;
  connectedTable?: string;
  connectedHook?: string;
  connectionNotes?: string;
  blockedReason?: string;
  verifiedBy?: string;
}

export interface ScoreUpdateParams {
  revenueImpact?: number;
  memberExperience?: number;
  dataCollection?: number;
  backendReadiness?: number;
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  B. MAPPER FUNCTIONS                                                   │
// └──────────────────────────────────────────────────────────────────────────┘

function mapScreen(row: any): MigrationScreen {
  return {
    id: row.id,
    screenCode: row.screen_code,
    screenName: row.screen_name,
    module: row.module,
    revenueImpact: row.revenue_impact,
    memberExperience: row.member_experience,
    dataCollection: row.data_collection,
    backendReadiness: row.backend_readiness,
    totalScore: row.total_score,
    wave: row.wave,
    status: row.status,
    blockedReason: row.blocked_reason,
    connectedService: row.connected_service,
    connectedTable: row.connected_table,
    connectedHook: row.connected_hook,
    connectionNotes: row.connection_notes,
    startedAt: row.started_at,
    connectedAt: row.connected_at,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    dependsOn: row.depends_on,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuditEntry(row: any): MigrationAuditEntry {
  return {
    id: row.id,
    screenId: row.screen_id,
    screenCode: row.screen_code,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    performedBy: row.performed_by,
    createdAt: row.created_at,
  };
}

function mapWaveStatus(row: any): WaveStatus {
  return {
    wave: row.wave,
    totalScreens: row.total_screens,
    connectedScreens: row.connected_screens,
    verifiedScreens: row.verified_screens,
    blockedScreens: row.blocked_screens,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    targetCompletion: row.target_completion,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

function mapSummary(row: any): MigrationSummary {
  return {
    wave: row.wave,
    total: row.total,
    mock: row.mock,
    inProgress: row.in_progress,
    connected: row.connected,
    verified: row.verified,
    blocked: row.blocked,
    completionPct: row.completion_pct ?? 0,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  C. ENGINE                                                             │
// └──────────────────────────────────────────────────────────────────────────┘

export class MockToRealMigrationEngine {

  // ── C1. Query All Screens ────────────────────────────────────────────────

  static async getAllScreens(): Promise<MigrationScreen[]> {
    const { data, error } = await supabase
      .from('migration_screens')
      .select('*')
      .order('wave', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapScreen);
  }

  // ── C2. Get Screens by Wave ──────────────────────────────────────────────

  static async getScreensByWave(wave: WaveNumber): Promise<MigrationScreen[]> {
    const { data, error } = await supabase
      .from('migration_screens')
      .select('*')
      .eq('wave', wave)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapScreen);
  }

  // ── C3. Get Screens by Module ────────────────────────────────────────────

  static async getScreensByModule(module: MigrationModule): Promise<MigrationScreen[]> {
    const { data, error } = await supabase
      .from('migration_screens')
      .select('*')
      .eq('module', module)
      .order('wave', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapScreen);
  }

  // ── C4. Get Screen by Code ───────────────────────────────────────────────

  static async getScreen(screenCode: string): Promise<MigrationScreen | null> {
    const { data, error } = await supabase
      .from('migration_screens')
      .select('*')
      .eq('screen_code', screenCode)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapScreen(data) : null;
  }

  // ── C5. Update Screen Status ─────────────────────────────────────────────

  static async updateScreen(screenCode: string, params: UpdateScreenParams): Promise<MigrationScreen> {
    // Enforce wave ordering: cannot start lower wave while higher wave incomplete
    if (params.status === 'in_progress') {
      const screen = await this.getScreen(screenCode);
      if (screen && screen.wave > 1) {
        const prevWaveComplete = await this.isWaveComplete(screen.wave - 1 as WaveNumber);
        if (!prevWaveComplete) {
          throw new Error(
            `Cannot start ${screenCode} (Wave ${screen.wave}) — Wave ${screen.wave - 1} is not yet complete. ` +
            `Rule: no screen in a lower wave gets touched while a higher wave remains unconnected.`
          );
        }
      }

      // Check dependencies
      if (screen?.dependsOn?.length) {
        const deps = await this.getScreensByCode(screen.dependsOn);
        const unfinished = deps.filter(d => d.status !== 'connected' && d.status !== 'verified');
        if (unfinished.length > 0) {
          throw new Error(
            `Cannot start ${screenCode} — depends on ${unfinished.map(u => u.screenCode).join(', ')} which are not yet connected.`
          );
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (params.status !== undefined) updateData.status = params.status;
    if (params.connectedService !== undefined) updateData.connected_service = params.connectedService;
    if (params.connectedTable !== undefined) updateData.connected_table = params.connectedTable;
    if (params.connectedHook !== undefined) updateData.connected_hook = params.connectedHook;
    if (params.connectionNotes !== undefined) updateData.connection_notes = params.connectionNotes;
    if (params.blockedReason !== undefined) updateData.blocked_reason = params.blockedReason;
    if (params.verifiedBy !== undefined) updateData.verified_by = params.verifiedBy;

    const { data, error } = await supabase
      .from('migration_screens')
      .update(updateData)
      .eq('screen_code', screenCode)
      .select('*')
      .single();

    if (error) throw error;
    return mapScreen(data);
  }

  // ── C6. Batch Update Status ──────────────────────────────────────────────

  static async batchUpdateStatus(screenCodes: string[], status: MigrationStatus): Promise<MigrationScreen[]> {
    const results: MigrationScreen[] = [];
    for (const code of screenCodes) {
      const updated = await this.updateScreen(code, { status });
      results.push(updated);
    }
    return results;
  }

  // ── C7. Update Scores ────────────────────────────────────────────────────

  static async updateScores(screenCode: string, scores: ScoreUpdateParams): Promise<MigrationScreen> {
    const updateData: Record<string, unknown> = {};
    if (scores.revenueImpact !== undefined) updateData.revenue_impact = scores.revenueImpact;
    if (scores.memberExperience !== undefined) updateData.member_experience = scores.memberExperience;
    if (scores.dataCollection !== undefined) updateData.data_collection = scores.dataCollection;
    if (scores.backendReadiness !== undefined) updateData.backend_readiness = scores.backendReadiness;

    // Log the score change
    const oldScreen = await this.getScreen(screenCode);

    const { data, error } = await supabase
      .from('migration_screens')
      .update(updateData)
      .eq('screen_code', screenCode)
      .select('*')
      .single();

    if (error) throw error;

    // Audit log
    if (oldScreen) {
      await supabase.from('migration_audit_log').insert({
        screen_id: data.id,
        screen_code: screenCode,
        action: 'score_update',
        old_value: {
          revenue_impact: oldScreen.revenueImpact,
          member_experience: oldScreen.memberExperience,
          data_collection: oldScreen.dataCollection,
          backend_readiness: oldScreen.backendReadiness,
          total_score: oldScreen.totalScore,
        },
        new_value: {
          revenue_impact: data.revenue_impact,
          member_experience: data.member_experience,
          data_collection: data.data_collection,
          backend_readiness: data.backend_readiness,
          total_score: data.total_score,
        },
      });
    }

    return mapScreen(data);
  }

  // ── C8. Wave Queries ─────────────────────────────────────────────────────

  static async getWaveStatus(): Promise<WaveStatus[]> {
    const { data, error } = await supabase
      .from('migration_wave_status')
      .select('*')
      .order('wave', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapWaveStatus);
  }

  static async isWaveComplete(wave: WaveNumber): Promise<boolean> {
    const { data, error } = await supabase
      .from('migration_screens')
      .select('status')
      .eq('wave', wave)
      .not('status', 'in', '("connected","verified")');

    if (error) throw error;
    return (data ?? []).length === 0;
  }

  static async getCurrentWave(): Promise<WaveNumber> {
    for (const w of [1, 2, 3] as WaveNumber[]) {
      const complete = await this.isWaveComplete(w);
      if (!complete) return w;
    }
    return 3;
  }

  // ── C9. Next Screen to Work On ───────────────────────────────────────────

  static async getNextScreen(): Promise<MigrationScreen | null> {
    const currentWave = await this.getCurrentWave();

    // Find the highest-scoring mock screen in the current wave
    const { data, error } = await supabase
      .from('migration_screens')
      .select('*')
      .eq('wave', currentWave)
      .eq('status', 'mock')
      .order('total_score', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code === 'PGRST116') {
      // No mock screens left, check in_progress
      const { data: inProgress } = await supabase
        .from('migration_screens')
        .select('*')
        .eq('wave', currentWave)
        .eq('status', 'in_progress')
        .order('sort_order', { ascending: true })
        .limit(1)
        .single();

      return inProgress ? mapScreen(inProgress) : null;
    }

    if (error) throw error;
    return data ? mapScreen(data) : null;
  }

  // ── C10. Blocked Screens ─────────────────────────────────────────────────

  static async getBlockedScreens(): Promise<MigrationScreen[]> {
    const { data, error } = await supabase
      .from('migration_screens')
      .select('*')
      .eq('status', 'blocked')
      .order('module', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapScreen);
  }

  static async blockScreen(screenCode: string, reason: string): Promise<MigrationScreen> {
    return this.updateScreen(screenCode, { status: 'blocked', blockedReason: reason });
  }

  static async unblockScreen(screenCode: string): Promise<MigrationScreen> {
    return this.updateScreen(screenCode, { status: 'mock', blockedReason: '' });
  }

  // ── C11. Audit Log ───────────────────────────────────────────────────────

  static async getAuditLog(screenCode?: string, limit = 50): Promise<MigrationAuditEntry[]> {
    let query = supabase
      .from('migration_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (screenCode) {
      query = query.eq('screen_code', screenCode);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapAuditEntry);
  }

  static async addNote(screenCode: string, note: string, performedBy = 'system'): Promise<void> {
    const screen = await this.getScreen(screenCode);
    if (!screen) throw new Error(`Screen ${screenCode} not found`);

    await supabase.from('migration_audit_log').insert({
      screen_id: screen.id,
      screen_code: screenCode,
      action: 'note_added',
      new_value: { note },
      performed_by: performedBy,
    });
  }

  // ── C12. Migration Summary (view) ────────────────────────────────────────

  static async getMigrationSummary(): Promise<MigrationSummary[]> {
    const { data, error } = await supabase
      .from('migration_summary')
      .select('*')
      .order('wave', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapSummary);
  }

  // ── C13. Full Dashboard ──────────────────────────────────────────────────

  static async getDashboard(): Promise<MigrationDashboard> {
    const [allScreens, summary, blocked, recentActivity] = await Promise.all([
      this.getAllScreens(),
      this.getMigrationSummary(),
      this.getBlockedScreens(),
      this.getAuditLog(undefined, 10),
    ]);

    const totalScreens = allScreens.length;
    const completedScreens = allScreens.filter(
      s => s.status === 'connected' || s.status === 'verified'
    ).length;

    const waves: WaveProgress[] = summary.map(s => ({
      wave: s.wave as WaveNumber,
      label: s.wave === 1 ? 'Circles End-to-End' : s.wave === 2 ? 'Dashboard + Elder + Community' : 'Goals + Remaining',
      totalScreens: s.total,
      completedScreens: s.connected + s.verified,
      percentComplete: s.completionPct,
      isBlocked: s.blocked > 0,
      canStart: s.wave === 1 || summary.find(prev => prev.wave === s.wave - 1)?.completionPct === 100,
    }));

    const currentWave = await this.getCurrentWave();
    const nextScreen = await this.getNextScreen();

    return {
      overallProgress: totalScreens > 0 ? Math.round((completedScreens / totalScreens) * 100) : 0,
      totalScreens,
      completedScreens,
      waves,
      currentWave,
      nextScreen,
      blockedScreens: blocked,
      recentActivity,
    };
  }

  // ── C14. Dependency Helpers ──────────────────────────────────────────────

  static async getScreensByCode(codes: string[]): Promise<MigrationScreen[]> {
    const { data, error } = await supabase
      .from('migration_screens')
      .select('*')
      .in('screen_code', codes);

    if (error) throw error;
    return (data ?? []).map(mapScreen);
  }

  static async getDependencyTree(screenCode: string): Promise<MigrationScreen[]> {
    const screen = await this.getScreen(screenCode);
    if (!screen || !screen.dependsOn?.length) return [];

    const deps = await this.getScreensByCode(screen.dependsOn);
    const deepDeps: MigrationScreen[] = [];

    for (const dep of deps) {
      const childDeps = await this.getDependencyTree(dep.screenCode);
      deepDeps.push(...childDeps);
    }

    return [...deepDeps, ...deps];
  }

  static async canStart(screenCode: string): Promise<{ allowed: boolean; reason?: string }> {
    const screen = await this.getScreen(screenCode);
    if (!screen) return { allowed: false, reason: 'Screen not found' };

    if (screen.status === 'blocked') {
      return { allowed: false, reason: `Blocked: ${screen.blockedReason}` };
    }

    // Check wave ordering
    if (screen.wave > 1) {
      const prevWaveComplete = await this.isWaveComplete((screen.wave - 1) as WaveNumber);
      if (!prevWaveComplete) {
        return { allowed: false, reason: `Wave ${screen.wave - 1} must complete first` };
      }
    }

    // Check direct dependencies
    if (screen.dependsOn?.length) {
      const deps = await this.getScreensByCode(screen.dependsOn);
      const unfinished = deps.filter(d => d.status !== 'connected' && d.status !== 'verified');
      if (unfinished.length > 0) {
        return {
          allowed: false,
          reason: `Depends on: ${unfinished.map(u => `${u.screenCode} (${u.status})`).join(', ')}`,
        };
      }
    }

    return { allowed: true };
  }

  // ── C15. Mark Screen Connected (convenience) ─────────────────────────────

  static async markConnected(
    screenCode: string,
    service: string,
    table: string,
    hook?: string,
    notes?: string
  ): Promise<MigrationScreen> {
    return this.updateScreen(screenCode, {
      status: 'connected',
      connectedService: service,
      connectedTable: table,
      connectedHook: hook,
      connectionNotes: notes,
    });
  }

  // ── C16. Mark Screen Verified (convenience) ──────────────────────────────

  static async markVerified(screenCode: string, verifiedBy: string): Promise<MigrationScreen> {
    return this.updateScreen(screenCode, {
      status: 'verified',
      verifiedBy,
    });
  }

  // ── C17. Realtime Subscription ───────────────────────────────────────────

  static subscribeToChanges(callback: (screen: MigrationScreen) => void) {
    return supabase
      .channel('migration_screens_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'migration_screens' },
        (payload) => {
          if (payload.new) {
            callback(mapScreen(payload.new));
          }
        }
      )
      .subscribe();
  }

  // ── C18. Module Progress ─────────────────────────────────────────────────

  static async getModuleProgress(): Promise<Record<MigrationModule, { total: number; completed: number; pct: number }>> {
    const screens = await this.getAllScreens();
    const modules: Record<string, { total: number; completed: number; pct: number }> = {};

    for (const screen of screens) {
      if (!modules[screen.module]) {
        modules[screen.module] = { total: 0, completed: 0, pct: 0 };
      }
      modules[screen.module].total++;
      if (screen.status === 'connected' || screen.status === 'verified') {
        modules[screen.module].completed++;
      }
    }

    for (const mod of Object.keys(modules)) {
      modules[mod].pct = modules[mod].total > 0
        ? Math.round((modules[mod].completed / modules[mod].total) * 100)
        : 0;
    }

    return modules as Record<MigrationModule, { total: number; completed: number; pct: number }>;
  }
}
