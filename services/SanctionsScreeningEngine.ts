/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SANCTIONS SCREENING ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Compliance layer for OFAC SDN, EU Consolidated Sanctions, and UN Security
 * Council list screening. Wraps Sanctions.io API with fuzzy matching,
 * auto-clear logic, review queue, and member status management.
 *
 * Sections:
 *   A — Screen Execution      F — Screen History
 *   B — Match Processing       G — Rolling Screen (batch)
 *   C — API Integration        H — List Updates
 *   D — Review Queue           I — Statistics
 *   E — Member Status          J — Realtime
 */

import { supabase } from '@/lib/supabase';


// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ScreenType = 'onboarding' | 'circle_join' | 'transaction' | 'rolling' | 'profile_update';
export type ListSource = 'OFAC_SDN' | 'EU_CONSOLIDATED' | 'UN_SECURITY_COUNCIL';
export type ScreenResult = 'clear' | 'review' | 'match' | 'error';
export type MatchType = 'exact' | 'fuzzy' | 'alias';
export type ReviewStatus = 'pending' | 'assigned' | 'resolved' | 'escalated';
export type ReviewPriority = 'critical' | 'high' | 'medium';
export type SanctionsStatus = 'clear' | 'under_review' | 'blocked';
export type Resolution = 'cleared' | 'confirmed_match' | 'escalated';

export interface SanctionsScreen {
  id: string;
  memberId: string;
  screenType: ScreenType;
  screenDate: string;
  listsChecked: string[];
  overallResult: ScreenResult;
  matchCount: number;
  highestMatchScore: number;
  apiResponse: Record<string, any>;
  reviewedBy: string | null;
  reviewDate: string | null;
  resolution: Resolution | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SanctionsMatch {
  id: string;
  screenId: string;
  listSource: ListSource;
  matchedName: string;
  memberNameSubmitted: string;
  similarityScore: number;
  matchType: MatchType;
  dobMatch: boolean;
  nationalityMatch: boolean;
  sanctionsEntryId: string | null;
  sanctionsDetails: Record<string, any>;
  autoCleared: boolean;
  createdAt: string;
}

export interface ReviewQueueItem {
  id: string;
  screenId: string;
  memberId: string;
  status: ReviewStatus;
  assignedTo: string | null;
  priority: ReviewPriority;
  memberContext: Record<string, any>;
  matchSummary: string | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  resolution: Resolution | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListUpdate {
  id: string;
  listName: ListSource;
  lastUpdatedAt: string;
  recordCount: number;
  updateSource: string | null;
  hash: string | null;
  createdAt: string;
}

export interface ScreenMemberResult {
  screenId: string;
  overallResult: ScreenResult;
  matchCount: number;
  highestMatchScore: number;
  reviewCreated: boolean;
}

export interface BatchScreenResult {
  processed: number;
  cleared: number;
  flagged: number;
  errors: number;
  durationMs: number;
}

export interface ScreeningStats {
  totalScreens: number;
  clearCount: number;
  reviewCount: number;
  matchCount: number;
  errorCount: number;
  pendingReviews: number;
  avgReviewTimeHours: number | null;
  falsePositiveRate: number | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAPPERS — snake_case DB → camelCase TypeScript
// ═══════════════════════════════════════════════════════════════════════════════

function mapScreen(row: any): SanctionsScreen {
  return {
    id: row.id,
    memberId: row.member_id,
    screenType: row.screen_type,
    screenDate: row.screen_date,
    listsChecked: row.lists_checked || [],
    overallResult: row.overall_result,
    matchCount: parseInt(row.match_count) || 0,
    highestMatchScore: parseFloat(row.highest_match_score) || 0,
    apiResponse: row.api_response || {},
    reviewedBy: row.reviewed_by || null,
    reviewDate: row.review_date || null,
    resolution: row.resolution || null,
    resolutionNotes: row.resolution_notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMatch(row: any): SanctionsMatch {
  return {
    id: row.id,
    screenId: row.screen_id,
    listSource: row.list_source,
    matchedName: row.matched_name,
    memberNameSubmitted: row.member_name_submitted,
    similarityScore: parseFloat(row.similarity_score) || 0,
    matchType: row.match_type,
    dobMatch: row.dob_match ?? false,
    nationalityMatch: row.nationality_match ?? false,
    sanctionsEntryId: row.sanctions_entry_id || null,
    sanctionsDetails: row.sanctions_details || {},
    autoCleared: row.auto_cleared ?? false,
    createdAt: row.created_at,
  };
}

function mapReviewItem(row: any): ReviewQueueItem {
  return {
    id: row.id,
    screenId: row.screen_id,
    memberId: row.member_id,
    status: row.status,
    assignedTo: row.assigned_to || null,
    priority: row.priority,
    memberContext: row.member_context || {},
    matchSummary: row.match_summary || null,
    assignedAt: row.assigned_at || null,
    resolvedAt: row.resolved_at || null,
    resolution: row.resolution || null,
    resolutionNotes: row.resolution_notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapListUpdate(row: any): ListUpdate {
  return {
    id: row.id,
    listName: row.list_name,
    lastUpdatedAt: row.last_updated_at,
    recordCount: parseInt(row.record_count) || 0,
    updateSource: row.update_source || null,
    hash: row.hash || null,
    createdAt: row.created_at,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class SanctionsScreeningEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION A — Screen Execution
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Main entry point: screen a member against all sanctions lists.
   * Fetches profile, calls API, records results, creates review if needed.
   */
  static async screenMember(
    userId: string,
    screenType: ScreenType
  ): Promise<ScreenMemberResult> {
    // 1. Fetch member profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('full_name, date_of_birth, country_of_origin, country_of_residence')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      // Record error screen
      const { data: errScreen } = await supabase
        .from('sanctions_screens')
        .insert({
          member_id: userId,
          screen_type: screenType,
          overall_result: 'error',
          api_response: { error: profileErr?.message || 'Profile not found' },
        })
        .select('id')
        .single();

      return {
        screenId: errScreen?.id || '',
        overallResult: 'error',
        matchCount: 0,
        highestMatchScore: 0,
        reviewCreated: false,
      };
    }

    const fullName = profile.full_name || '';
    const dob = profile.date_of_birth || null;
    const country = profile.country_of_origin || profile.country_of_residence || null;

    // 2. Call screening API
    const apiResponse = await SanctionsScreeningEngine.callScreeningAPI(fullName, dob, country);

    // 3. Insert screen record
    const { data: screen, error: screenErr } = await supabase
      .from('sanctions_screens')
      .insert({
        member_id: userId,
        screen_type: screenType,
        overall_result: 'clear', // Will update after match processing
        api_response: apiResponse,
      })
      .select('id')
      .single();

    if (screenErr || !screen) {
      return {
        screenId: '',
        overallResult: 'error',
        matchCount: 0,
        highestMatchScore: 0,
        reviewCreated: false,
      };
    }

    const screenId = screen.id;

    // 4. Process matches
    const matches = apiResponse.matches || [];
    let matchCount = 0;
    let highestScore = 0;
    let hasNonClearedMatch = false;

    if (matches.length > 0) {
      const result = await SanctionsScreeningEngine.processMatches(
        screenId, apiResponse, dob, country
      );
      matchCount = result.totalMatches;
      highestScore = result.highestScore;
      hasNonClearedMatch = result.hasNonClearedMatch;
    }

    // 5. Determine overall result
    let overallResult: ScreenResult = 'clear';
    if (apiResponse.error) {
      overallResult = 'error';
    } else if (hasNonClearedMatch && highestScore >= 0.98) {
      overallResult = 'match';
    } else if (hasNonClearedMatch) {
      overallResult = 'review';
    }

    // 6. Update screen record
    await supabase
      .from('sanctions_screens')
      .update({
        overall_result: overallResult,
        match_count: matchCount,
        highest_match_score: highestScore,
      })
      .eq('id', screenId);

    // 7. Update profiles.last_sanctions_screen
    await supabase
      .from('profiles')
      .update({ last_sanctions_screen: new Date().toISOString() })
      .eq('id', userId);

    // 8. Create review item if needed
    let reviewCreated = false;
    if (overallResult === 'review' || overallResult === 'match') {
      const priority = SanctionsScreeningEngine.determinePriority(highestScore, matchCount);
      const matchSummary = `${matchCount} match(es) found, highest similarity: ${(highestScore * 100).toFixed(1)}%`;

      await SanctionsScreeningEngine.createReviewItem(screenId, userId, priority, matchSummary);
      await SanctionsScreeningEngine.updateMemberSanctionsStatus(userId, 'under_review');
      reviewCreated = true;
    }

    return {
      screenId,
      overallResult,
      matchCount,
      highestMatchScore: highestScore,
      reviewCreated,
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B — Match Processing
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Process API response matches — calculate similarity, apply auto-clear
   * logic, and insert match records.
   */
  static async processMatches(
    screenId: string,
    apiResponse: any,
    memberDob: string | null,
    memberCountry: string | null
  ): Promise<{ totalMatches: number; highestScore: number; hasNonClearedMatch: boolean }> {
    const matches = apiResponse.matches || [];
    let highestScore = 0;
    let hasNonClearedMatch = false;
    const matchRows: any[] = [];

    for (const m of matches) {
      const matchedName = m.name || m.matched_name || '';
      const memberName = m.query_name || apiResponse.query?.name || '';
      const listSource: ListSource = m.list || m.list_source || 'OFAC_SDN';

      // Calculate similarity
      const similarity = SanctionsScreeningEngine.calculateSimilarity(
        memberName.toLowerCase(),
        matchedName.toLowerCase()
      );

      if (similarity > highestScore) highestScore = similarity;

      // Check DOB match
      const matchDob = m.date_of_birth || m.dob || null;
      const dobMatch = !!(memberDob && matchDob && memberDob === matchDob);

      // Check nationality match
      const matchNationality = m.nationality || m.country || null;
      const nationalityMatch = !!(
        memberCountry &&
        matchNationality &&
        memberCountry.toLowerCase() === matchNationality.toLowerCase()
      );

      // Auto-clear logic: different DOB + different nationality + < 85% similarity
      const autoCleared = !dobMatch && !nationalityMatch && similarity < 0.85;

      if (!autoCleared) {
        hasNonClearedMatch = true;
      }

      matchRows.push({
        screen_id: screenId,
        list_source: listSource,
        matched_name: matchedName,
        member_name_submitted: memberName,
        similarity_score: similarity,
        match_type: SanctionsScreeningEngine.determineMatchType(similarity),
        dob_match: dobMatch,
        nationality_match: nationalityMatch,
        sanctions_entry_id: m.entry_id || m.id || null,
        sanctions_details: m,
        auto_cleared: autoCleared,
      });
    }

    // Batch insert matches
    if (matchRows.length > 0) {
      await supabase.from('sanctions_matches').insert(matchRows);
    }

    return {
      totalMatches: matchRows.length,
      highestScore,
      hasNonClearedMatch,
    };
  }

  /**
   * Levenshtein-based similarity score normalized to 0-1.
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;

    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    if (maxLen === 0) return 1.0;

    // Levenshtein distance
    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,       // deletion
          matrix[i][j - 1] + 1,       // insertion
          matrix[i - 1][j - 1] + cost  // substitution
        );
      }
    }

    const distance = matrix[len1][len2];
    return 1 - distance / maxLen;
  }

  /**
   * Classify match type by similarity score.
   */
  private static determineMatchType(similarity: number): MatchType {
    if (similarity >= 0.98) return 'exact';
    if (similarity >= 0.70) return 'fuzzy';
    return 'alias';
  }

  /**
   * Determine review priority from match quality.
   */
  private static determinePriority(highestScore: number, matchCount: number): ReviewPriority {
    if (highestScore >= 0.95 || matchCount >= 3) return 'critical';
    if (highestScore >= 0.85) return 'high';
    return 'medium';
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION C — API Integration
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Call the Sanctions.io screening API. In mock mode or when no API key
   * is configured, returns a clear response for development.
   */
  static async callScreeningAPI(
    fullName: string,
    dob: string | null,
    country: string | null
  ): Promise<any> {
    // Check for mock mode
    const apiKey = process.env.SANCTIONS_API_KEY || '';
    const mockMode = process.env.SANCTIONS_MOCK_MODE === 'true' || !apiKey;

    if (mockMode) {
      return {
        query: { name: fullName, dob, country },
        matches: [],
        screened_at: new Date().toISOString(),
        lists_checked: ['OFAC_SDN', 'EU_CONSOLIDATED', 'UN_SECURITY_COUNCIL'],
        mock: true,
      };
    }

    // Real API call with retries
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch('https://api.sanctions.io/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: fullName,
            date_of_birth: dob,
            country: country,
            sources: ['OFAC_SDN', 'EU_CONSOLIDATED', 'UN_SECURITY_COUNCIL'],
            min_score: 70,
          }),
        });

        if (response.ok) {
          return await response.json();
        }

        // Rate limit — wait and retry
        if (response.status === 429) {
          const waitMs = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        lastError = `API returned ${response.status}: ${response.statusText}`;
      } catch (err: any) {
        lastError = err.message || 'Network error';
        // Exponential backoff
        const waitMs = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, waitMs));
      }
    }

    // All retries exhausted — return error result (never throw)
    return {
      query: { name: fullName, dob, country },
      matches: [],
      error: lastError || 'API call failed after retries',
      screened_at: new Date().toISOString(),
      lists_checked: ['OFAC_SDN', 'EU_CONSOLIDATED', 'UN_SECURITY_COUNCIL'],
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION D — Review Queue
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a review queue item for human review.
   */
  static async createReviewItem(
    screenId: string,
    memberId: string,
    priority: ReviewPriority,
    matchSummary: string
  ): Promise<ReviewQueueItem | null> {
    // Snapshot member context for the reviewer
    let memberContext: Record<string, any> = {};
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, country_of_origin, country_of_residence, date_of_birth, xn_score')
        .eq('id', memberId)
        .single();

      if (profile) {
        memberContext = {
          fullName: profile.full_name,
          countryOfOrigin: profile.country_of_origin,
          countryOfResidence: profile.country_of_residence,
          dateOfBirth: profile.date_of_birth,
          xnScore: profile.xn_score,
        };
      }
    } catch (err) {
      console.warn('[SanctionsScreening] Profile snapshot failed (non-fatal):', err);
    }

    // Try to get risk level (non-fatal)
    try {
      const { data: risk } = await supabase
        .from('member_risk_indicators')
        .select('overall_risk_level, overall_risk_score')
        .eq('user_id', memberId)
        .single();

      if (risk) {
        memberContext.riskLevel = risk.overall_risk_level;
        memberContext.riskScore = risk.overall_risk_score;
      }
    } catch (err) {
      console.warn('[SanctionsScreening] Risk indicator lookup failed (non-fatal):', err);
    }

    const { data, error } = await supabase
      .from('sanctions_review_queue')
      .insert({
        screen_id: screenId,
        member_id: memberId,
        priority,
        match_summary: matchSummary,
        member_context: memberContext,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[SanctionsScreening] Failed to create review item:', error);
      return null;
    }

    return mapReviewItem(data);
  }

  /**
   * Assign a review item to a reviewer (Elder or compliance officer).
   */
  static async assignReview(reviewId: string, assigneeId: string): Promise<void> {
    await supabase
      .from('sanctions_review_queue')
      .update({
        status: 'assigned',
        assigned_to: assigneeId,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', reviewId);
  }

  /**
   * Resolve a review — updates review queue, screen resolution, and member status.
   */
  static async resolveReview(
    reviewId: string,
    resolution: Resolution,
    notes: string
  ): Promise<void> {
    // 1. Update review queue
    const { data: review } = await supabase
      .from('sanctions_review_queue')
      .update({
        status: 'resolved',
        resolution,
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select('screen_id, member_id')
      .single();

    if (!review) return;

    // 2. Update the underlying screen
    const reviewerId = (await supabase.auth.getUser()).data?.user?.id || null;

    await supabase
      .from('sanctions_screens')
      .update({
        resolution,
        resolution_notes: notes,
        reviewed_by: reviewerId,
        review_date: new Date().toISOString(),
      })
      .eq('id', review.screen_id);

    // 3. Update member sanctions status based on resolution
    let newStatus: SanctionsStatus = 'clear';
    if (resolution === 'confirmed_match') {
      newStatus = 'blocked';
    } else if (resolution === 'escalated') {
      newStatus = 'under_review';
    }

    await SanctionsScreeningEngine.updateMemberSanctionsStatus(review.member_id, newStatus);
  }

  /**
   * Get review queue items with optional filters.
   */
  static async getReviewQueue(
    filters?: { status?: ReviewStatus; priority?: ReviewPriority }
  ): Promise<ReviewQueueItem[]> {
    let query = supabase
      .from('sanctions_review_queue')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapReviewItem);
  }

  /**
   * Get reviews assigned to a specific reviewer.
   */
  static async getMyReviews(assigneeId: string): Promise<ReviewQueueItem[]> {
    const { data, error } = await supabase
      .from('sanctions_review_queue')
      .select('*')
      .eq('assigned_to', assigneeId)
      .in('status', ['assigned', 'pending'])
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(mapReviewItem);
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION E — Member Status
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update a member's sanctions status on their profile.
   */
  static async updateMemberSanctionsStatus(
    userId: string,
    status: SanctionsStatus
  ): Promise<void> {
    await supabase
      .from('profiles')
      .update({ sanctions_status: status })
      .eq('id', userId);
  }

  /**
   * Get a member's current sanctions status and last screen date.
   */
  static async getMemberSanctionsStatus(
    userId: string
  ): Promise<{ sanctionsStatus: SanctionsStatus; lastScreen: string | null }> {
    const { data, error } = await supabase
      .from('profiles')
      .select('sanctions_status, last_sanctions_screen')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return { sanctionsStatus: 'clear', lastScreen: null };
    }

    return {
      sanctionsStatus: data.sanctions_status || 'clear',
      lastScreen: data.last_sanctions_screen || null,
    };
  }

  /**
   * Quick check: is this member clear to proceed?
   */
  static async isMemberClear(userId: string): Promise<boolean> {
    const { sanctionsStatus } = await SanctionsScreeningEngine.getMemberSanctionsStatus(userId);
    return sanctionsStatus === 'clear';
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION F — Screen History
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all screening history for a member.
   */
  static async getMemberScreenHistory(userId: string): Promise<SanctionsScreen[]> {
    const { data, error } = await supabase
      .from('sanctions_screens')
      .select('*')
      .eq('member_id', userId)
      .order('screen_date', { ascending: false });

    if (error || !data) return [];
    return data.map(mapScreen);
  }

  /**
   * Get details of a specific screen.
   */
  static async getScreenDetails(screenId: string): Promise<SanctionsScreen | null> {
    const { data, error } = await supabase
      .from('sanctions_screens')
      .select('*')
      .eq('id', screenId)
      .single();

    if (error || !data) return null;
    return mapScreen(data);
  }

  /**
   * Get all matches for a specific screen.
   */
  static async getMatchesForScreen(screenId: string): Promise<SanctionsMatch[]> {
    const { data, error } = await supabase
      .from('sanctions_matches')
      .select('*')
      .eq('screen_id', screenId)
      .order('similarity_score', { ascending: false });

    if (error || !data) return [];
    return data.map(mapMatch);
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION G — Rolling Screen (Batch)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Screen all active (non-blocked) members. Used by weekly cron job.
   * Processes in batches of 50 with rate limiting.
   */
  static async screenAllActiveMembers(): Promise<BatchScreenResult> {
    const startTime = Date.now();
    let processed = 0;
    let cleared = 0;
    let flagged = 0;
    let errors = 0;

    // Fetch all non-blocked member IDs
    const { data: members, error } = await supabase
      .from('profiles')
      .select('id')
      .or('sanctions_status.eq.clear,sanctions_status.is.null');

    if (error || !members) {
      return { processed: 0, cleared: 0, flagged: 0, errors: 1, durationMs: Date.now() - startTime };
    }

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize);

      for (const member of batch) {
        try {
          const result = await SanctionsScreeningEngine.screenMember(member.id, 'rolling');
          processed++;

          if (result.overallResult === 'clear') {
            cleared++;
          } else if (result.overallResult === 'review' || result.overallResult === 'match') {
            flagged++;
          } else {
            errors++;
          }
        } catch (err) {
          console.error(`[SanctionsScreening] Rolling screen failed for ${member.id}:`, err);
          errors++;
          processed++;
        }
      }

      // Rate limit: 1-second delay between batches
      if (i + batchSize < members.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return {
      processed,
      cleared,
      flagged,
      errors,
      durationMs: Date.now() - startTime,
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION H — List Updates
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check when each sanctions list was last updated.
   */
  static async checkListUpdates(): Promise<ListUpdate[]> {
    const { data, error } = await supabase
      .from('sanctions_list_updates')
      .select('*')
      .order('last_updated_at', { ascending: false });

    if (error || !data) return [];
    return data.map(mapListUpdate);
  }

  /**
   * Record that a sanctions list has been updated.
   */
  static async recordListUpdate(
    listName: ListSource,
    recordCount: number,
    hash: string
  ): Promise<void> {
    await supabase
      .from('sanctions_list_updates')
      .insert({
        list_name: listName,
        record_count: recordCount,
        hash,
        update_source: 'api_sync',
      });
  }

  /**
   * Get full history of list updates.
   */
  static async getListUpdateHistory(): Promise<ListUpdate[]> {
    const { data, error } = await supabase
      .from('sanctions_list_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data.map(mapListUpdate);
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION I — Statistics
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get aggregate screening statistics.
   */
  static async getScreeningStats(): Promise<ScreeningStats> {
    // Total screens by result
    const { data: screens } = await supabase
      .from('sanctions_screens')
      .select('overall_result');

    const totalScreens = screens?.length || 0;
    let clearCount = 0;
    let reviewCount = 0;
    let matchCount = 0;
    let errorCount = 0;

    for (const s of screens || []) {
      switch (s.overall_result) {
        case 'clear': clearCount++; break;
        case 'review': reviewCount++; break;
        case 'match': matchCount++; break;
        case 'error': errorCount++; break;
      }
    }

    // Pending reviews
    const { count: pendingReviews } = await supabase
      .from('sanctions_review_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'assigned']);

    // Average review time (resolved items)
    const { data: resolved } = await supabase
      .from('sanctions_review_queue')
      .select('created_at, resolved_at')
      .eq('status', 'resolved')
      .not('resolved_at', 'is', null);

    let avgReviewTimeHours: number | null = null;
    if (resolved && resolved.length > 0) {
      let totalMs = 0;
      for (const r of resolved) {
        totalMs += new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime();
      }
      avgReviewTimeHours = totalMs / resolved.length / (1000 * 60 * 60);
    }

    // False positive rate (cleared / total resolved)
    let falsePositiveRate: number | null = null;
    if (resolved && resolved.length > 0) {
      const { count: clearedCount } = await supabase
        .from('sanctions_review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'resolved')
        .eq('resolution', 'cleared');

      if (clearedCount !== null) {
        falsePositiveRate = resolved.length > 0 ? clearedCount / resolved.length : null;
      }
    }

    return {
      totalScreens,
      clearCount,
      reviewCount,
      matchCount,
      errorCount,
      pendingReviews: pendingReviews || 0,
      avgReviewTimeHours,
      falsePositiveRate,
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION J — Realtime
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to review queue changes (all items).
   */
  static subscribeToReviewQueue(callback: () => void) {
    return supabase
      .channel('sanctions-review-queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sanctions_review_queue',
        },
        () => { callback(); }
      )
      .subscribe();
  }

  /**
   * Subscribe to a specific member's screening results.
   */
  static subscribeToMemberScreens(userId: string, callback: () => void) {
    return supabase
      .channel(`sanctions-screens-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sanctions_screens',
          filter: `member_id=eq.${userId}`,
        },
        () => { callback(); }
      )
      .subscribe();
  }
}
