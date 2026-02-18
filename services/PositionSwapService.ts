/**
 * PositionSwapService.ts
 *
 * Handles position swap requests between circle members.
 * After positions are assigned, members can request to swap with each other.
 */

import { supabase } from "../lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export type SwapStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "completed"
  | "expired"
  | "cancelled";

export interface SwapRequest {
  id: string;
  circleId: string;
  requesterId: string;
  requesterName?: string;
  requesterCurrentPosition: number;
  targetUserId: string;
  targetName?: string;
  targetCurrentPosition: number;
  status: SwapStatus;
  requesterMessage?: string;
  responseMessage?: string;
  expiresAt: string;
  respondedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface SwapEligibility {
  canSwap: boolean;
  reason?: string;
  targetConstraints?: {
    minPosition: number;
    maxPosition: number;
  };
  requesterConstraints?: {
    minPosition: number;
    maxPosition: number;
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class PositionSwapService {
  private swapExpirationDays = 3;

  // ============================================================================
  // REQUEST A SWAP
  // ============================================================================

  /**
   * Request a position swap with another member
   */
  async requestSwap(
    requesterId: string,
    targetUserId: string,
    circleId: string,
    message?: string
  ): Promise<SwapRequest> {
    // Can't swap with yourself
    if (requesterId === targetUserId) {
      throw new Error("Cannot swap with yourself");
    }

    // Get circle and verify it hasn't started
    const { data: circle } = await supabase
      .from("circles")
      .select("current_cycle, max_members")
      .eq("id", circleId)
      .single();

    if (!circle) {
      throw new Error("Circle not found");
    }

    if ((circle.current_cycle || 1) > 1) {
      throw new Error("Cannot swap positions after circle has started");
    }

    // Get payout order
    const { data: payoutOrder } = await supabase
      .from("payout_orders")
      .select("order_data")
      .eq("circle_id", circleId)
      .eq("status", "active")
      .single();

    if (!payoutOrder) {
      throw new Error("Payout order not yet determined");
    }

    // Find both members in the order
    const order = payoutOrder.order_data;
    const requesterEntry = order.find((o: any) => o.userId === requesterId);
    const targetEntry = order.find((o: any) => o.userId === targetUserId);

    if (!requesterEntry || !targetEntry) {
      throw new Error("Both users must be members of this circle");
    }

    // Check for existing pending swap request
    const { data: existingRequest } = await supabase
      .from("position_swap_requests")
      .select("id")
      .eq("circle_id", circleId)
      .eq("requester_id", requesterId)
      .eq("status", "pending")
      .single();

    if (existingRequest) {
      throw new Error("You already have a pending swap request. Cancel it first.");
    }

    // Check constraints for both parties
    const eligibility = await this.checkSwapEligibility(
      requesterId,
      targetUserId,
      circleId,
      requesterEntry.position,
      targetEntry.position
    );

    if (!eligibility.canSwap) {
      throw new Error(eligibility.reason || "Swap not allowed");
    }

    // Create swap request
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.swapExpirationDays);

    const { data: swapRequest, error } = await supabase
      .from("position_swap_requests")
      .insert({
        circle_id: circleId,
        requester_id: requesterId,
        requester_current_position: requesterEntry.position,
        target_user_id: targetUserId,
        target_current_position: targetEntry.position,
        status: "pending",
        requester_message: message,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification to target
    await this.sendSwapNotification(targetUserId, {
      type: "swap_request_received",
      title: "Position Swap Request",
      body: `A member wants to swap positions with you. You are Position ${targetEntry.position}, they are Position ${requesterEntry.position}.`,
      data: {
        swapRequestId: swapRequest.id,
        circleId,
        yourPosition: targetEntry.position,
        theirPosition: requesterEntry.position,
      },
    });

    return this.transformSwapRequest(swapRequest);
  }

  /**
   * Check if a swap is allowed between two positions
   */
  async checkSwapEligibility(
    requesterId: string,
    targetUserId: string,
    circleId: string,
    requesterPosition: number,
    targetPosition: number
  ): Promise<SwapEligibility> {
    // Get constraints for both users
    const { data: requesterConstraint } = await supabase
      .from("position_constraints")
      .select("min_position, max_position")
      .eq("user_id", requesterId)
      .eq("circle_id", circleId)
      .single();

    const { data: targetConstraint } = await supabase
      .from("position_constraints")
      .select("min_position, max_position")
      .eq("user_id", targetUserId)
      .eq("circle_id", circleId)
      .single();

    // Check if target can take requester's position
    if (targetConstraint) {
      if (requesterPosition < targetConstraint.min_position) {
        return {
          canSwap: false,
          reason: `Target user cannot take Position ${requesterPosition} (minimum: ${targetConstraint.min_position})`,
          targetConstraints: targetConstraint,
        };
      }
      if (requesterPosition > targetConstraint.max_position) {
        return {
          canSwap: false,
          reason: `Target user cannot take Position ${requesterPosition} (maximum: ${targetConstraint.max_position})`,
          targetConstraints: targetConstraint,
        };
      }
    }

    // Check if requester can take target's position
    if (requesterConstraint) {
      if (targetPosition < requesterConstraint.min_position) {
        return {
          canSwap: false,
          reason: `You cannot take Position ${targetPosition} (your minimum: ${requesterConstraint.min_position})`,
          requesterConstraints: requesterConstraint,
        };
      }
      if (targetPosition > requesterConstraint.max_position) {
        return {
          canSwap: false,
          reason: `You cannot take Position ${targetPosition} (your maximum: ${requesterConstraint.max_position})`,
          requesterConstraints: requesterConstraint,
        };
      }
    }

    // Check if either position is locked
    const { data: preferences } = await supabase
      .from("position_preferences")
      .select("user_id, position_lock_agreed")
      .eq("circle_id", circleId)
      .in("user_id", [requesterId, targetUserId]);

    const lockedUsers = (preferences || []).filter(p => p.position_lock_agreed);

    if (lockedUsers.find(p => p.user_id === requesterId)) {
      return {
        canSwap: false,
        reason: "You agreed to lock your position and cannot swap",
      };
    }

    if (lockedUsers.find(p => p.user_id === targetUserId)) {
      return {
        canSwap: false,
        reason: "Target user has locked their position",
      };
    }

    return {
      canSwap: true,
      requesterConstraints: requesterConstraint || undefined,
      targetConstraints: targetConstraint || undefined,
    };
  }

  // ============================================================================
  // RESPOND TO SWAP
  // ============================================================================

  /**
   * Accept a swap request
   */
  async acceptSwap(swapRequestId: string, targetUserId: string, message?: string): Promise<SwapRequest> {
    const swapRequest = await this.validateSwapResponse(swapRequestId, targetUserId);

    // Re-verify eligibility (in case constraints changed)
    const eligibility = await this.checkSwapEligibility(
      swapRequest.requester_id,
      swapRequest.target_user_id,
      swapRequest.circle_id,
      swapRequest.requester_current_position,
      swapRequest.target_current_position
    );

    if (!eligibility.canSwap) {
      throw new Error(eligibility.reason || "Swap no longer allowed");
    }

    // Execute the swap
    await this.executeSwap(swapRequest);

    // Update swap request status
    const { data: updated, error } = await supabase
      .from("position_swap_requests")
      .update({
        status: "completed",
        response_message: message,
        responded_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", swapRequestId)
      .select()
      .single();

    if (error) throw error;

    // Notify requester
    await this.sendSwapNotification(swapRequest.requester_id, {
      type: "swap_completed",
      title: "Swap Completed!",
      body: `Your position swap was accepted. You are now Position ${swapRequest.target_current_position}.`,
      data: {
        circleId: swapRequest.circle_id,
        newPosition: swapRequest.target_current_position,
      },
    });

    return this.transformSwapRequest(updated);
  }

  /**
   * Decline a swap request
   */
  async declineSwap(swapRequestId: string, targetUserId: string, message?: string): Promise<SwapRequest> {
    await this.validateSwapResponse(swapRequestId, targetUserId);

    const { data: updated, error } = await supabase
      .from("position_swap_requests")
      .update({
        status: "declined",
        response_message: message,
        responded_at: new Date().toISOString(),
      })
      .eq("id", swapRequestId)
      .select()
      .single();

    if (error) throw error;

    // Notify requester
    await this.sendSwapNotification(updated.requester_id, {
      type: "swap_declined",
      title: "Swap Request Declined",
      body: "Your position swap request was declined.",
      data: {
        circleId: updated.circle_id,
      },
    });

    return this.transformSwapRequest(updated);
  }

  /**
   * Cancel a swap request (requester action)
   */
  async cancelSwap(swapRequestId: string, requesterId: string): Promise<void> {
    const { data: swapRequest } = await supabase
      .from("position_swap_requests")
      .select("*")
      .eq("id", swapRequestId)
      .eq("requester_id", requesterId)
      .eq("status", "pending")
      .single();

    if (!swapRequest) {
      throw new Error("Swap request not found or already processed");
    }

    await supabase
      .from("position_swap_requests")
      .update({ status: "cancelled" })
      .eq("id", swapRequestId);

    // Notify target that request was cancelled
    await this.sendSwapNotification(swapRequest.target_user_id, {
      type: "swap_cancelled",
      title: "Swap Request Cancelled",
      body: "A position swap request to you was cancelled.",
      data: {
        circleId: swapRequest.circle_id,
      },
    });
  }

  // ============================================================================
  // EXECUTE SWAP
  // ============================================================================

  private async executeSwap(swapRequest: any): Promise<void> {
    // Get current payout order
    const { data: payoutOrder } = await supabase
      .from("payout_orders")
      .select("*")
      .eq("circle_id", swapRequest.circle_id)
      .eq("status", "active")
      .single();

    if (!payoutOrder) {
      throw new Error("Payout order not found");
    }

    // Swap positions in the order
    const newOrder = payoutOrder.order_data.map((entry: any) => {
      if (entry.userId === swapRequest.requester_id) {
        return { ...entry, position: swapRequest.target_current_position };
      }
      if (entry.userId === swapRequest.target_user_id) {
        return { ...entry, position: swapRequest.requester_current_position };
      }
      return entry;
    });

    // Re-sort by position
    newOrder.sort((a: any, b: any) => a.position - b.position);

    // Record the modification
    const modifications = payoutOrder.modifications || [];
    modifications.push({
      type: "swap",
      user1: swapRequest.requester_id,
      user1OldPosition: swapRequest.requester_current_position,
      user2: swapRequest.target_user_id,
      user2OldPosition: swapRequest.target_current_position,
      timestamp: new Date().toISOString(),
      swapRequestId: swapRequest.id,
    });

    // Update payout order
    const { error } = await supabase
      .from("payout_orders")
      .update({
        order_data: newOrder,
        status: "modified",
        modifications,
        modification_count: (payoutOrder.modification_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutOrder.id);

    if (error) throw error;

    // Update position history for both users
    await this.updatePositionHistory(
      swapRequest.requester_id,
      swapRequest.circle_id,
      swapRequest.target_current_position,
      newOrder.length
    );

    await this.updatePositionHistory(
      swapRequest.target_user_id,
      swapRequest.circle_id,
      swapRequest.requester_current_position,
      newOrder.length
    );
  }

  private async updatePositionHistory(
    userId: string,
    circleId: string,
    newPosition: number,
    totalPositions: number
  ): Promise<void> {
    await supabase
      .from("member_position_history")
      .upsert({
        user_id: userId,
        circle_id: circleId,
        position: newPosition,
        total_positions: totalPositions,
        position_percentile: newPosition / totalPositions,
      }, {
        onConflict: "user_id,circle_id"
      });
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Get pending swap requests for a user
   */
  async getPendingRequests(userId: string): Promise<{
    incoming: SwapRequest[];
    outgoing: SwapRequest[];
  }> {
    // Incoming requests (user is target)
    const { data: incoming } = await supabase
      .from("position_swap_requests")
      .select(`
        *,
        requester:profiles!requester_id(full_name),
        circle:circles(name)
      `)
      .eq("target_user_id", userId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    // Outgoing requests (user is requester)
    const { data: outgoing } = await supabase
      .from("position_swap_requests")
      .select(`
        *,
        target:profiles!target_user_id(full_name),
        circle:circles(name)
      `)
      .eq("requester_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    return {
      incoming: (incoming || []).map(r => this.transformSwapRequest(r, r.requester?.full_name)),
      outgoing: (outgoing || []).map(r => this.transformSwapRequest(r, undefined, r.target?.full_name)),
    };
  }

  /**
   * Get swap history for a circle
   */
  async getCircleSwapHistory(circleId: string): Promise<SwapRequest[]> {
    const { data } = await supabase
      .from("position_swap_requests")
      .select(`
        *,
        requester:profiles!requester_id(full_name),
        target:profiles!target_user_id(full_name)
      `)
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false });

    return (data || []).map(r =>
      this.transformSwapRequest(r, r.requester?.full_name, r.target?.full_name)
    );
  }

  /**
   * Get available swap targets for a user
   */
  async getSwapTargets(userId: string, circleId: string): Promise<{
    userId: string;
    name: string;
    position: number;
    canSwap: boolean;
    reason?: string;
  }[]> {
    // Get payout order
    const { data: payoutOrder } = await supabase
      .from("payout_orders")
      .select("order_data")
      .eq("circle_id", circleId)
      .eq("status", "active")
      .single();

    if (!payoutOrder) return [];

    const order = payoutOrder.order_data;
    const myEntry = order.find((o: any) => o.userId === userId);

    if (!myEntry) return [];

    // Get member profiles
    const userIds = order.map((o: any) => o.userId).filter((id: string) => id !== userId);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

    // Check eligibility for each
    const targets = await Promise.all(
      order
        .filter((o: any) => o.userId !== userId)
        .map(async (entry: any) => {
          const eligibility = await this.checkSwapEligibility(
            userId,
            entry.userId,
            circleId,
            myEntry.position,
            entry.position
          );

          return {
            userId: entry.userId,
            name: profileMap.get(entry.userId) || "Unknown",
            position: entry.position,
            canSwap: eligibility.canSwap,
            reason: eligibility.reason,
          };
        })
    );

    return targets;
  }

  // ============================================================================
  // EXPIRE OLD REQUESTS
  // ============================================================================

  /**
   * Expire old swap requests (to be called by cron)
   */
  async expireOldRequests(): Promise<number> {
    const { data } = await supabase
      .from("position_swap_requests")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .select("id, requester_id");

    // Notify requesters
    for (const request of data || []) {
      await this.sendSwapNotification(request.requester_id, {
        type: "swap_expired",
        title: "Swap Request Expired",
        body: "Your position swap request has expired without a response.",
        data: {},
      });
    }

    return data?.length || 0;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async validateSwapResponse(swapRequestId: string, targetUserId: string): Promise<any> {
    const { data: swapRequest, error } = await supabase
      .from("position_swap_requests")
      .select("*")
      .eq("id", swapRequestId)
      .single();

    if (error || !swapRequest) {
      throw new Error("Swap request not found");
    }

    if (swapRequest.target_user_id !== targetUserId) {
      throw new Error("Only the target can respond to this request");
    }

    if (swapRequest.status !== "pending") {
      throw new Error("This request has already been processed");
    }

    if (new Date() > new Date(swapRequest.expires_at)) {
      await supabase
        .from("position_swap_requests")
        .update({ status: "expired" })
        .eq("id", swapRequestId);
      throw new Error("This request has expired");
    }

    // Verify circle hasn't started
    const { data: circle } = await supabase
      .from("circles")
      .select("current_cycle")
      .eq("id", swapRequest.circle_id)
      .single();

    if ((circle?.current_cycle || 1) > 1) {
      throw new Error("Cannot swap after circle has started");
    }

    return swapRequest;
  }

  private async sendSwapNotification(
    userId: string,
    notification: {
      type: string;
      title: string;
      body: string;
      data: any;
    }
  ): Promise<void> {
    // Would integrate with notification service
    console.log(`[Swap Notification] User: ${userId}`, notification);
  }

  private transformSwapRequest(
    row: any,
    requesterName?: string,
    targetName?: string
  ): SwapRequest {
    return {
      id: row.id,
      circleId: row.circle_id,
      requesterId: row.requester_id,
      requesterName: requesterName || row.requester?.full_name,
      requesterCurrentPosition: row.requester_current_position,
      targetUserId: row.target_user_id,
      targetName: targetName || row.target?.full_name,
      targetCurrentPosition: row.target_current_position,
      status: row.status,
      requesterMessage: row.requester_message,
      responseMessage: row.response_message,
      expiresAt: row.expires_at,
      respondedAt: row.responded_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
}

// Export default instance
export const positionSwapService = new PositionSwapService();

// Export convenience functions
export const requestSwap = (requesterId: string, targetUserId: string, circleId: string, message?: string) =>
  positionSwapService.requestSwap(requesterId, targetUserId, circleId, message);

export const acceptSwap = (swapRequestId: string, targetUserId: string, message?: string) =>
  positionSwapService.acceptSwap(swapRequestId, targetUserId, message);

export const declineSwap = (swapRequestId: string, targetUserId: string, message?: string) =>
  positionSwapService.declineSwap(swapRequestId, targetUserId, message);

export const cancelSwap = (swapRequestId: string, requesterId: string) =>
  positionSwapService.cancelSwap(swapRequestId, requesterId);

export const getPendingSwapRequests = (userId: string) =>
  positionSwapService.getPendingRequests(userId);

export const getSwapTargets = (userId: string, circleId: string) =>
  positionSwapService.getSwapTargets(userId, circleId);
