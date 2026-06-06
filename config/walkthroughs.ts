// =============================================================================
// config/walkthroughs.ts -- step definitions for first-time-user walkthroughs.
//
// Each walkthrough is identified by a stable string id. The id is the
// AsyncStorage key suffix the useWalkthrough hook uses, so renaming an id
// here makes returning users re-see the walkthrough -- intentional when
// the content changes meaningfully, accidental otherwise.
//
// Step shape:
//   targetId      stable string future versions can use to anchor the
//                 tooltip to a specific element (matched against a testID
//                 or accessibilityLabel). Today the overlay centers the
//                 tooltip in a modal backdrop, but the field is here so
//                 we can wire up element-anchored tooltips later without
//                 a config rewrite.
//   title         short headline (<= 40 chars)
//   description   one-sentence body
//   position      caret direction in the visual; currently informational
//                 only since the overlay centers, but used the moment
//                 element-anchored positioning ships.
// =============================================================================

import type { TooltipPosition } from "../components/Tooltip";

// Bump WALKTHROUGH_VERSION when step copy changes enough that returning
// users should see the walkthrough again. useWalkthrough wipes all
// completion flags on version change.
export const WALKTHROUGH_VERSION = 1;

export type WalkthroughId =
  | "circles_intro"
  | "join_circle_intro"
  | "goals_intro"
  | "advance_intro";

export interface WalkthroughStep {
  targetId: string;
  title: string;
  description: string;
  position: TooltipPosition;
}

export interface WalkthroughConfig {
  id: WalkthroughId;
  title: string;
  steps: WalkthroughStep[];
}

export const WALKTHROUGHS: Record<WalkthroughId, WalkthroughConfig> = {
  // ----- Create a circle -----------------------------------------------------
  circles_intro: {
    id: "circles_intro",
    title: "Create your first circle",
    steps: [
      {
        targetId: "button_new_circle",
        title: "Tap + New Circle",
        description: "Circles are savings groups you run with people you trust. Start one with the button on the top right.",
        position: "top",
      },
      {
        targetId: "circle_type_picker",
        title: "Choose a circle type",
        description: "Goal-based, emergency, traditional rotating, investment, or charity -- pick the one that matches what you're saving for.",
        position: "bottom",
      },
      {
        targetId: "circle_amount_members",
        title: "Set amount and members",
        description: "Decide how much each member contributes per cycle and how many people will join. You can adjust the schedule too.",
        position: "bottom",
      },
      {
        targetId: "circle_invite",
        title: "Invite members",
        description: "Send invites by phone, email, or a shareable link. Members confirm and the circle becomes active once everyone joins.",
        position: "top",
      },
      {
        targetId: "circle_success",
        title: "You're all set",
        description: "Your circle is created. You'll see contributions, payouts, and member activity on the circle detail screen.",
        position: "top",
      },
    ],
  },

  // ----- Join a circle -------------------------------------------------------
  join_circle_intro: {
    id: "join_circle_intro",
    title: "Join an existing circle",
    steps: [
      {
        targetId: "tab_browse_circles",
        title: "Browse circles",
        description: "The Discover tab shows public circles you can apply to, ranked by fit.",
        position: "top",
      },
      {
        targetId: "circle_card_join",
        title: "Tap Join on one you like",
        description: "Each card shows the contribution amount, frequency, and how many spots are open.",
        position: "bottom",
      },
      {
        targetId: "confirm_contribution",
        title: "Confirm your contribution",
        description: "Review the amount and frequency, then confirm. Your first contribution is held until the circle is full and starts.",
        position: "top",
      },
      {
        targetId: "await_approval",
        title: "Wait for admin approval",
        description: "The circle admin gets your request. You'll get a notification when you're accepted -- usually within 24 hours.",
        position: "top",
      },
    ],
  },

  // ----- Create a goal -------------------------------------------------------
  goals_intro: {
    id: "goals_intro",
    title: "Save toward a goal",
    steps: [
      {
        targetId: "tab_goals",
        title: "This is your Goals hub",
        description: "Goals are private savings targets. Use them to save toward a trip, a deposit, or anything else.",
        position: "top",
      },
      {
        targetId: "button_new_goal",
        title: "Tap + New Goal",
        description: "Start a new goal from the button on the top right of this screen.",
        position: "top",
      },
      {
        targetId: "goal_type_picker",
        title: "Choose a goal type",
        description: "Pick from emergency, education, travel, home, vehicle, or custom. The category drives default suggestions.",
        position: "bottom",
      },
      {
        targetId: "goal_target_savings_type",
        title: "Set target and savings type",
        description: "Choose how much you want to save and whether the funds sit in a wallet, a circle, or both.",
        position: "bottom",
      },
      {
        targetId: "goal_link_circle",
        title: "Link a circle (optional)",
        description: "Linking a circle counts your payouts toward this goal automatically. You can skip and link later.",
        position: "top",
      },
    ],
  },

  // ----- Request an advance --------------------------------------------------
  advance_intro: {
    id: "advance_intro",
    title: "Need funds before your payout?",
    steps: [
      {
        targetId: "tab_advance_hub",
        title: "Welcome to the Advance Hub",
        description: "Advances let you draw on an upcoming circle payout when you need cash sooner. Repayment comes out of the payout when it arrives.",
        position: "top",
      },
      {
        targetId: "advance_type_picker",
        title: "Choose an advance type",
        description: "Quick (small, fast), Flex (larger, requires higher score), or Bridge (cross-circle). Each has its own eligibility window.",
        position: "bottom",
      },
      {
        targetId: "advance_amount",
        title: "Enter an amount",
        description: "The screen shows your live cap, the fee for 30 vs 60-day repayment, and the net you'll receive.",
        position: "bottom",
      },
      {
        targetId: "advance_terms",
        title: "Accept the terms",
        description: "Review fees, repayment date, and the offset against your payout. The agreement is binding once you confirm.",
        position: "top",
      },
      {
        targetId: "advance_funds",
        title: "Receive your funds",
        description: "Approved advances disburse to your wallet, usually within a few minutes. Track repayment progress in Advance History.",
        position: "top",
      },
    ],
  },
};
