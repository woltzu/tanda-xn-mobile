// =============================================================================
// config/faq.ts -- FAQ content surfaced by screens/FAQScreen.tsx.
//
// One row per question. The screen filters by category chip + free-text
// search across question + answer. Keep answers to 2-4 sentences in a
// friendly voice -- if it grows beyond that it belongs in a long-form
// help-center article that the FAQ row can link to.
//
// Adding a row: pick the category, write a short answer, give it a
// stable id (used as the AsyncStorage/analytics key if we add "was this
// helpful?" voting later). Don't reuse ids across categories.
// =============================================================================

export type FAQCategory =
  | "getting_started"
  | "circles"
  | "goals"
  | "advances"
  | "xnscore"
  | "verification"
  | "technical";

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
  /** Optional ids of related FAQ rows shown beneath the answer. */
  related?: string[];
}

export const FAQ_CATEGORIES: { id: FAQCategory; label: string; icon: string }[] = [
  { id: "getting_started", label: "Getting Started", icon: "rocket-outline" },
  { id: "circles",         label: "Circles",         icon: "people-outline" },
  { id: "goals",           label: "Goals",           icon: "trophy-outline" },
  { id: "advances",        label: "Advances",        icon: "cash-outline" },
  { id: "xnscore",         label: "XnScore",         icon: "speedometer-outline" },
  { id: "verification",    label: "Verification",    icon: "shield-checkmark-outline" },
  { id: "technical",       label: "Technical",       icon: "settings-outline" },
];

export const FAQ_ITEMS: FAQItem[] = [
  // ----- Getting Started ----------------------------------------------------
  {
    id: "what_is_tandaxn",
    category: "getting_started",
    question: "What is TandaXn?",
    answer:
      "TandaXn is a savings app built around rotating savings circles (ROSCAs). You pool small contributions with people you trust, take turns receiving the payout, and build a verified financial track record (XnScore) along the way. Goals, liquidity advances, and insurance are layered on top.",
    related: ["how_do_circles_work", "what_is_xnscore"],
  },
  {
    id: "is_my_money_safe",
    category: "getting_started",
    question: "Is my money safe?",
    answer:
      "Funds are held with regulated payment partners, never in our own bank account. Each circle is also backed by an insurance pool that absorbs missed contributions when a member defaults. We use bank-grade encryption and require KYC for every account.",
    related: ["how_does_insurance_pool_work", "what_is_kyc"],
  },
  {
    id: "how_do_i_refer_friends",
    category: "getting_started",
    question: "How do I refer friends?",
    answer:
      "Open Profile -> Refer & Earn for your personal link. When someone joins through your link, completes KYC, and contributes to their first circle, you both get a small XnScore boost. No cash referral rewards yet -- the reward is a faster track to higher liquidity caps.",
    related: ["what_is_xnscore"],
  },

  // ----- Circles ------------------------------------------------------------
  {
    id: "how_do_circles_work",
    category: "circles",
    question: "How do circles (ROSCAs) work?",
    answer:
      "Every member contributes the same amount each cycle. On each cycle, one member receives the whole pot. The order is set when the circle forms and rotates until everyone has been paid out exactly once. By the end, every member has received the same total -- it's a savings discipline, not a loan.",
    related: ["how_do_i_create_a_circle", "what_if_i_miss_a_contribution"],
  },
  {
    id: "how_do_i_create_a_circle",
    category: "circles",
    question: "How do I create a circle?",
    answer:
      "Open the Circles tab and tap the + button. Pick a type (traditional, goal, emergency, investment, or charity), set the contribution amount and member count, and invite people by phone, email, or shareable link. The circle starts once every invited member confirms.",
    related: ["how_do_circles_work", "how_do_i_join_a_circle"],
  },
  {
    id: "how_do_i_join_a_circle",
    category: "circles",
    question: "How do I join a circle?",
    answer:
      "From the Circles tab, switch to Browse. Each card shows the contribution amount, frequency, and how many spots remain. Tap Join, confirm the contribution, and wait for the circle admin to approve -- usually within 24 hours.",
    related: ["how_do_circles_work", "can_i_leave_a_circle"],
  },
  {
    id: "can_i_leave_a_circle",
    category: "circles",
    question: "Can I leave a circle? What happens to my contributions?",
    answer:
      "Yes, but the rules depend on whether you've already received your payout. If you haven't, your contributions to date are refunded minus any handling fees and you forfeit your future slot. If you have, you owe the rest of your contributions to complete the rotation -- leaving early without paying counts as a default and hurts your XnScore.",
    related: ["what_if_i_miss_a_contribution", "what_is_substitute_member"],
  },
  {
    id: "what_if_i_miss_a_contribution",
    category: "circles",
    question: "What happens if I miss a contribution?",
    answer:
      "Late contributions trigger a grace period (configurable per circle, usually 48-72 hours). If the contribution still doesn't land, the insurance pool covers the missed amount so the cycle payout goes through on time. Your XnScore drops, and persistent misses move you to the substitute member pool.",
    related: ["how_does_insurance_pool_work", "what_is_substitute_member"],
  },
  {
    id: "what_is_substitute_member",
    category: "circles",
    question: "What is the substitute member system?",
    answer:
      "A substitute pool is a vetted bench of members who can step in when an active member defaults or has to leave mid-cycle. The substitute takes over the remaining contributions and the next payout slot, keeping the circle alive. This is what lets a circle survive a member dropping out without unwinding everyone else.",
    related: ["what_if_i_miss_a_contribution", "can_i_leave_a_circle"],
  },
  {
    id: "how_does_insurance_pool_work",
    category: "circles",
    question: "How does the insurance pool work?",
    answer:
      "Each circle has a small insurance pool funded by a tiny percentage of every contribution (typically 2-3%). When a member misses a payment, the pool covers the gap so the scheduled payout still happens. Rates are dynamic -- circles with strong member XnScores, good circle-health metrics, and high reputation pay less.",
    related: ["what_if_i_miss_a_contribution", "what_is_xnscore"],
  },

  // ----- Goals --------------------------------------------------------------
  {
    id: "what_are_goals",
    category: "goals",
    question: "What are goals and how do they earn interest?",
    answer:
      "Goals are private savings targets you set for yourself -- emergency fund, vacation, home deposit, anything. Funds you allocate to a goal sit in a yield-bearing wallet and accrue interest daily. You can link a circle to a goal so payouts roll in automatically.",
    related: ["flexible_vs_emergency_vs_locked"],
  },
  {
    id: "flexible_vs_emergency_vs_locked",
    category: "goals",
    question: "What's the difference between Flexible, Emergency, and Locked savings?",
    answer:
      "Flexible: withdraw any time, lower interest rate. Emergency: 1-3 day cool-off before withdrawal, mid-tier rate, ideal for actual emergencies. Locked: fixed term (3/6/12 months) with the highest rate, early withdrawal forfeits accrued interest.",
    related: ["what_are_goals"],
  },
  {
    id: "how_do_i_withdraw",
    category: "goals",
    question: "How do I withdraw money?",
    answer:
      "Open the goal or wallet, tap Withdraw, and pick a linked bank account or debit card. Flexible withdrawals usually settle same-day; locked savings honor the chosen term. Wallet balance moves to your bank in 1-3 business days depending on the rail.",
    related: ["how_do_i_link_a_bank", "flexible_vs_emergency_vs_locked"],
  },

  // ----- Advances -----------------------------------------------------------
  {
    id: "how_do_advances_work",
    category: "advances",
    question: "How do advances (liquidity) work?",
    answer:
      "An advance lets you draw cash now against an upcoming circle payout you're scheduled to receive. The advance amount, plus a fee, is automatically deducted from that payout when it arrives. There's no separate repayment schedule -- if you have an upcoming payout, your advance is naturally collateralized.",
    related: ["what_are_the_fees", "what_is_xnscore"],
  },
  {
    id: "what_are_the_fees",
    category: "advances",
    question: "What are the fees?",
    answer:
      "30-day advances start at 3% and 60-day at 5%, but both are dynamic -- they rise when the liquidity pool is under stress and fall when it's healthy. The current rate is shown live on the advance screen before you confirm. Circles with high reputation get a small fee discount.",
    related: ["how_do_advances_work"],
  },

  // ----- XnScore ------------------------------------------------------------
  {
    id: "what_is_xnscore",
    category: "xnscore",
    question: "What is XnScore and how is it calculated?",
    answer:
      "XnScore is your TandaXn credit-style score on a 0-100 scale. It blends on-time contribution history (40%), circle completion record (25%), engagement (15%), default penalty (10%), and tenure (10%). It unlocks larger circles, better advance terms, and lower insurance rates as it grows.",
    related: ["how_do_advances_work", "how_do_circles_work"],
  },
  {
    id: "how_do_i_become_an_elder",
    category: "xnscore",
    question: "How do I become an Elder?",
    answer:
      "Elders are members at the top XnScore tier with a sustained record of completed circles and successful vouches. You qualify by maintaining a 90+ XnScore for at least 6 months, completing at least 5 circles, and vouching for 3 members who also complete circles successfully. Elders can adjudicate disputes and earn passive rewards.",
    related: ["what_is_xnscore"],
  },

  // ----- Goals (additional) -------------------------------------------------
  {
    id: "how_to_set_a_goal",
    category: "goals",
    question: "How do I set a goal?",
    answer:
      "Open the Goals tab and tap +. Pick a category (Emergency, Education, Travel, Home, Vehicle, or Custom), choose a target amount and timeline, and pick a savings type. You can optionally link a circle so payouts auto-deposit into the goal.",
    related: ["what_are_goals", "flexible_vs_emergency_vs_locked", "how_does_auto_deposit_work"],
  },
  {
    id: "how_do_i_earn_interest",
    category: "goals",
    question: "How do I earn interest on my savings?",
    answer:
      "Funds you put into a goal sit in a yield-bearing wallet and accrue interest daily. The rate depends on the savings type you picked when you created the goal -- Flexible is lowest, Locked is highest. Interest is calculated daily and credited monthly.",
    related: ["flexible_vs_emergency_vs_locked", "what_are_goals"],
  },
  {
    id: "how_does_auto_deposit_work",
    category: "goals",
    question: "How does auto-deposit work?",
    answer:
      "When you link a circle to a goal, every payout you receive from that circle gets routed straight into the goal's balance instead of your wallet. You can unlink at any time from the goal's detail screen, and you can link multiple circles to the same goal.",
    related: ["how_to_set_a_goal", "what_are_goals"],
  },

  // ----- Verification -------------------------------------------------------
  {
    id: "what_is_kyc",
    category: "verification",
    question: "What is KYC and why do I need it?",
    answer:
      "KYC (Know Your Customer) is the identity check we run before money can move. We verify your government ID, address, and a selfie to comply with anti-money-laundering law. It's a one-time process per person and unlocks circles, advances, and withdrawals.",
    related: ["is_my_money_safe"],
  },
  {
    id: "how_do_i_link_a_bank",
    category: "verification",
    question: "How do I link a bank account or card?",
    answer:
      "Open Profile -> Payment Methods and pick Add Bank or Add Card. Bank links go through Stripe Financial Connections (instant for most US banks). Cards are tokenized -- we never store the raw number. You can add multiple methods and pick a default.",
    related: ["how_do_i_withdraw"],
  },
  {
    id: "what_documents_for_kyc",
    category: "verification",
    question: "What documents are accepted for KYC?",
    answer:
      "A government-issued photo ID (passport, driver's license, or national ID card), proof of address (a utility bill or bank statement issued in the last 90 days), and a live selfie that matches the ID photo. Make sure every corner of the document is in frame and the text is readable.",
    related: ["what_is_kyc", "how_long_does_kyc_take"],
  },
  {
    id: "how_long_does_kyc_take",
    category: "verification",
    question: "How long does KYC verification take?",
    answer:
      "Most submissions are approved automatically within a few minutes. If anything triggers a manual review -- low-quality photo, name mismatch, restricted country -- a human checks it within one business day. You'll get a push notification either way.",
    related: ["what_is_kyc", "what_documents_for_kyc"],
  },

  // ----- Wallet / Funds (lives under technical to stay within the
  //       existing FAQCategory union; if we ever split out a dedicated
  //       Wallet category, these rows are the natural seed.) ----------
  {
    id: "how_do_i_add_funds",
    category: "technical",
    question: "How do I add funds to my wallet?",
    answer:
      "Open Wallet -> Add Funds and pick a linked bank or card. Bank transfers settle in 1-3 business days; debit-card top-ups are typically instant. You can also set a recurring auto-top-up from Wallet -> Settings if you want a hands-off approach.",
    related: ["how_do_i_link_a_bank", "what_are_wallet_fees"],
  },
  {
    id: "what_are_wallet_fees",
    category: "technical",
    question: "What are the wallet and withdrawal fees?",
    answer:
      "Bank deposits and standard withdrawals are free. Debit-card top-ups carry a small processing fee (currently 1.5%) that the screen always shows before you confirm. Instant withdrawals to a card add a separate expedite fee; same-day to a bank is free.",
    related: ["how_do_i_add_funds", "how_do_i_withdraw"],
  },

  // ----- Account & Privacy (also under technical for now) -----------
  {
    id: "how_is_my_data_protected",
    category: "technical",
    question: "How is my data protected?",
    answer:
      "Personal data is encrypted at rest with AES-256 and in transit with TLS 1.3. Payment credentials are tokenized by our payment partners -- we never store raw card or bank numbers. You can review the data we hold, export it, or request deletion from Profile -> Privacy.",
    related: ["delete_account", "is_my_money_safe"],
  },
  {
    id: "change_language",
    category: "technical",
    question: "Can I change the app language?",
    answer:
      "Yes. Open Profile -> Language & Region and pick from the supported languages. Decisions and notifications are localized too -- the AI explanations you see in your Decision History switch language the moment you change the setting.",
  },

  // ----- Technical / Support -----------------------------------------------
  {
    id: "how_do_i_contact_support",
    category: "technical",
    question: "I have a problem -- how do I contact support?",
    answer:
      "Tap Contact Support at the bottom of this screen to email us at support@tandaxn.com, or open Profile -> Help Center for the chat. We aim to respond within one business day. For account-takeover concerns, include the word URGENT in the subject line and we'll prioritize.",
  },
  {
    id: "two_factor_auth",
    category: "technical",
    question: "How do I turn on two-factor authentication?",
    answer:
      "Open Profile -> Security -> Two-Factor Authentication and pick SMS or an authenticator app. We strongly recommend the authenticator app -- it works without cell signal and isn't vulnerable to SIM swaps. You'll be prompted to re-verify on every new device sign-in once it's on.",
  },
  {
    id: "delete_account",
    category: "technical",
    question: "How do I delete my account?",
    answer:
      "Open Profile -> Privacy -> Delete Account. You'll need to close any active circles and withdraw your wallet balance first. Deletion is permanent after a 30-day cooling-off period; during that window you can sign back in to cancel.",
  },
];
