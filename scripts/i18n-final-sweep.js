#!/usr/bin/env node
/**
 * i18n-final-sweep.js
 *
 * Bulk converts the remaining unconverted screens in screens/ by:
 *   1. Adding `import { useTranslation } from "react-i18next";` after the
 *      first react-navigation/native import (or after the last import if
 *      no nav import is present).
 *   2. Adding `const { t } = useTranslation();` inside the component
 *      function body, after the first useNavigation/useRoute hook call
 *      (or right after the opening brace of the export default function).
 *   3. Replacing the screen's header title with t('screen_headers.<key>')
 *      where <key> matches a pre-built key in i18n/locales/en.json.
 *
 * Run from the project root:
 *   node scripts/i18n-final-sweep.js
 *
 * Idempotent — if a file already imports useTranslation it is skipped.
 */

const fs = require("fs");
const path = require("path");

const screensDir = path.join(__dirname, "..", "screens");
const localesPath = path.join(__dirname, "..", "i18n", "locales", "en.json");

const locales = JSON.parse(fs.readFileSync(localesPath, "utf8"));
const screenHeaders = locales.screen_headers || {};

// Filename -> screen_headers key. Derived from the screen's PascalCase basename:
//   AccountTiersExplainedScreen -> account_tiers
// Map gives explicit overrides where the natural slug doesn't match the
// key we pre-built. Anything missing falls through to no-header-rewrite.
const FILENAME_TO_KEY = {
  AccountTiersExplainedScreen: "account_tiers",
  ActionScreen: "action",
  ActiveSessionsScreen: "active_sessions",
  ActivityEditorScreen: "activity_editor",
  AddRecipientScreen: "add_recipient",
  AdminSettingsScreen: "admin_settings",
  AdvanceAgreementScreen: "advance_agreement",
  AdvanceApprovalScreen: "advance_approval",
  AdvanceDetailsScreen: "advance_details",
  AdvanceDetailsV2Screen: "advance_details",
  AdvanceDisbursementScreen: "advance_disbursement",
  AdvanceExplanationScreen: "advance_explanation",
  AdvanceExplanationV2Screen: "advance_explanation_v2",
  AdvanceHistoryScreen: "advance_history",
  AdvanceStatusDashboardScreen: "advance_status",
  AuthCallbackScreen: "auth_callback",
  BookServiceScreen: null,            // already in book_service namespace
  BulkInvitesScreen: null,            // already in bulk_invites namespace
  CircleInviteScreen: "circle_invite",
  CircleVisualizerScreen: "circle_visualizer",
  ConflictAlertScreen: "conflict_alert",
  CreateTripListingScreen: "create_trip_listing",
  CrossCircleLendingScreen: "cross_circle_lending",
  CycleTimelineScreen: "cycle_timeline",
  DefaultDetailScreen: "default_detail",
  DefaultRecoveryScreen: "default_recovery",
  DepositToGoalScreen: "deposit_to_goal",
  DiscoverCirclesScreen: "discover_circles",
  DonationPreferencesScreen: "donation_preferences",
  EarlyInterventionScreen: "early_intervention",
  EditStoreScreen: null,              // already in edit_store namespace
  GoalAchievedScreen: "goal_achieved",
  GoalActivityScreen: "goal_activity",
  GoalBItemsScreen: "goal_b_items",
  GoalCategorySelectScreen: "goal_category_select",
  GoalEditScreen: "goal_edit",
  GoalLinkCircleScreen: "goal_link_circle",
  GoalMilestonesScreen: "goal_milestones",
  GoalSetupSuccessScreen: "goal_setup_success",
  GoalStoriesScreen: "goal_stories",
  GoalTypeSelectScreen: "goal_type_select",
  GraduatedEntryScreen: "graduated_entry",
  HowCirclesWorkScreen: "how_circles_work",
  InsurancePoolScreen: "insurance_pool",
  InterestUnlockedSuccessScreen: "interest_unlocked",
  JoinConfirmScreen: "join_confirm",
  LinkedAccountsScreen: "linked_accounts",
  LoanDashboardScreen: "loan_dashboard",
  LockScreen: "lock_screen",
  ManageServicesScreen: null,         // already in manage_services namespace
  MarketInsightScreen: "market_insight",
  MemberTripDashboardScreen: "member_trip_dashboard",
  MyTripStatusScreen: "my_trip_status",
  OrganizerTripDashboardScreen: "organizer_trip_dashboard",
  OrganizerTripListScreen: "organizer_trip_list",
  ParticipantDetailScreen: "participant_detail",
  ProviderVerificationScreen: null,   // already in provider_verification namespace
  QRCodeDisplayScreen: "qr_code_display",
  QRScannerScreen: "qr_scanner",
  QuickCircleScreen: "quick_circle",
  QuickJoinPaymentSuccessScreen: "quick_join_payment_success",
  QuickJoinPendingConfirmationScreen: "quick_join_pending",
  RepaymentConfirmScreen: "repayment_confirm",
  ReportIssueScreen: "report_issue",
  RequestAdvanceScreen: "request_advance",
  RequestProviderScreen: null,        // already in request_provider namespace
  SavedRecipientsScreen: "saved_recipients",
  SelectCircleContributionScreen: "select_circle_contribution",
  SplashScreen: "splash",
  StoreBookingsScreen: null,          // already in store_bookings namespace
  StoreDetailScreen: null,            // already in store_detail namespace
  SubstitutePoolScreen: "substitute_pool",
  SupportDreamScreen: "support_dream",
  TripPaymentScreen: "trip_payment",
  TripPublicPageScreen: "trip_public_page",
  TripPublishSuccessScreen: "trip_publish_success",
  TwoFactorAuthScreen: "two_factor_auth",
  UnlockInterestPromptScreen: "unlock_interest_prompt",
  VerificationOptionsScreen: "verification_options",
  WalletTransactionSuccessScreen: "wallet_transaction_success",
  WebViewScreen: "web_view",
  WithdrawFromGoalScreen: "withdraw_from_goal",
};

// Bespoke headers that don't fit screen_headers — already in their own namespaces.
const BESPOKE_HEADER = {
  BookServiceScreen: "book_service.header_title",
  BulkInvitesScreen: "bulk_invites.header_title",
  EditStoreScreen: "edit_store.header_title",
  ManageServicesScreen: "manage_services.header_title",
  ProviderVerificationScreen: "provider_verification.header_title",
  RequestProviderScreen: "request_provider.header_title",
  StoreBookingsScreen: "store_bookings.header_title",
  StoreDetailScreen: null,           // no styles.headerTitle — skip
};

function pickHeaderTKey(basename) {
  if (Object.prototype.hasOwnProperty.call(BESPOKE_HEADER, basename)) {
    return BESPOKE_HEADER[basename];
  }
  const slug = FILENAME_TO_KEY[basename];
  if (!slug) return null;
  if (!Object.prototype.hasOwnProperty.call(screenHeaders, slug)) return null;
  return `screen_headers.${slug}`;
}

// Find unconverted .tsx files in screens/.
function getUnconvertedScreens() {
  return fs
    .readdirSync(screensDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => path.join(screensDir, f))
    .filter((full) => {
      const src = fs.readFileSync(full, "utf8");
      return !/useTranslation/.test(src);
    });
}

function ensureImport(src) {
  if (/from ["']react-i18next["']/.test(src)) return src;
  // Insert after the react-navigation/native import line, or after the last
  // import line if no nav import.
  const navMatch = src.match(/^import .* from ["']@react-navigation\/native["'];?\s*$/m);
  const insert = `import { useTranslation } from "react-i18next";\n`;
  if (navMatch) {
    return src.replace(navMatch[0], navMatch[0] + "\n" + insert.replace(/\n$/, ""));
  }
  // Fall back: insert after the last top-level import block.
  const lastImport = [...src.matchAll(/^import [^;]+;\s*$/gm)].pop();
  if (lastImport) {
    const idx = lastImport.index + lastImport[0].length;
    return src.slice(0, idx) + "\n" + insert.replace(/\n$/, "") + src.slice(idx);
  }
  // Last resort: prepend.
  return insert + src;
}

function ensureHook(src) {
  if (/const \{ t \} = useTranslation\(\);/.test(src)) return src;
  // Find the first `export default function ScreenName(...)` or
  // `const ScreenName = (...)` and inject after the first useNavigation /
  // useRoute call. Otherwise inject right after the opening brace.
  const fnMatch = src.match(
    /^(?:export default function|const) \w+(?:Screen)?\s*[:=]?\s*(?:React\.FC[^=]*=)?\s*(?:\([^)]*\))\s*(?::\s*[^=>{]+)?\s*(?:=>)?\s*\{/m
  );
  if (!fnMatch) return src;
  const fnStart = fnMatch.index + fnMatch[0].length;
  // Inject after the first hook line (useNavigation/useRoute/useAuth/etc.)
  // that appears within the next ~600 chars; otherwise inject at fnStart.
  const window = src.slice(fnStart, fnStart + 800);
  const firstHook = window.match(/\n([ \t]*)const \w+ = use\w+\([^)]*\)[^;]*;[ \t]*\n/);
  if (firstHook) {
    const insertAt = fnStart + firstHook.index + firstHook[0].length;
    const indent = firstHook[1] || "  ";
    return src.slice(0, insertAt) + `${indent}const { t } = useTranslation();\n` + src.slice(insertAt);
  }
  // No hook — inject directly after the opening brace.
  return src.slice(0, fnStart) + `\n  const { t } = useTranslation();\n` + src.slice(fnStart);
}

function replaceHeader(src, tKey) {
  if (!tKey) return src;
  // Find a Text element with style headerTitle (or HeaderTitle) wrapping a
  // plain English string. We deliberately accept only literal strings to
  // avoid clobbering expressions.
  const re = /<Text\s+style=\{[^}]*headerTitle[^}]*\}[^>]*>([^<{}]+)<\/Text>/g;
  let changed = false;
  const out = src.replace(re, (match, body) => {
    const trimmed = body.trim();
    if (!trimmed) return match;
    // Only replace if all-English visible text.
    if (!/^[A-Z][A-Za-z0-9'!?,. &-]{1,80}$/.test(trimmed)) return match;
    changed = true;
    return match.replace(body, `{t("${tKey}")}`);
  });
  if (!changed) return src;
  return out;
}

function convertOne(file) {
  const basename = path.basename(file, ".tsx");
  const original = fs.readFileSync(file, "utf8");
  let src = original;
  src = ensureImport(src);
  src = ensureHook(src);
  const tKey = pickHeaderTKey(basename);
  src = replaceHeader(src, tKey);
  if (src === original) return { changed: false, basename, tKey };
  fs.writeFileSync(file, src, "utf8");
  return { changed: true, basename, tKey };
}

const targets = getUnconvertedScreens();
console.log(`Found ${targets.length} unconverted screens.`);

const results = targets.map(convertOne);
const changed = results.filter((r) => r.changed);
const unchanged = results.filter((r) => !r.changed);
console.log(`Converted ${changed.length} files.`);
if (unchanged.length) {
  console.log(`Skipped ${unchanged.length}:`);
  unchanged.forEach((r) => console.log(`  - ${r.basename} (tKey=${r.tKey ?? "none"})`));
}
