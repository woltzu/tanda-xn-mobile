// =============================================================================
// load-test.js -- k6 load test for the TandaXn Supabase backend.
//
// Read-heavy by default so it's safe to run against any environment.
// Set WRITE=true to enable a small destructive journey (create circle,
// join circle, submit eligibility checks); only do that against staging
// or a throwaway project, never against prod.
//
// Run modes (set MODE env var, default = smoke):
//   smoke   1 VU,    30s     correctness check
//   load    50 VUs,  2m      typical day-shape (with 30s ramp)
//   stress  200 VUs, 5m      sustained pressure
//   spike   0->300->0 VUs    burst test
//
// Required env:
//   SUPABASE_URL        e.g. https://fjqdkyjkwqeoafwvnjgv.supabase.co
//   SUPABASE_ANON_KEY   the public anon key from project settings
// Optional env:
//   TEST_USER_EMAIL     existing test user; if unset, runs unauthenticated
//   TEST_USER_PASSWORD  paired with TEST_USER_EMAIL
//   WRITE               'true' to enable destructive flow (staging only)
//   THINK_MIN/THINK_MAX seconds between actions in a VU iteration
//                       (defaults 1 / 4 -- realistic human pacing)
//
// Run:
//   k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... -e MODE=smoke \
//          scripts/load-test.js
// =============================================================================

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// ---- env ----------------------------------------------------------------
const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY     = __ENV.SUPABASE_ANON_KEY;
const TEST_EMAIL   = __ENV.TEST_USER_EMAIL || "";
const TEST_PWD     = __ENV.TEST_USER_PASSWORD || "";
const MODE         = (__ENV.MODE || "smoke").toLowerCase();
const WRITE        = (__ENV.WRITE || "").toLowerCase() === "true";
const THINK_MIN    = parseInt(__ENV.THINK_MIN || "1", 10);
const THINK_MAX    = parseInt(__ENV.THINK_MAX || "4", 10);

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY. " +
    "Set both via -e flags or environment variables before running k6."
  );
}

// ---- options per mode ---------------------------------------------------
const STAGES = {
  smoke:  [{ duration: "30s", target: 1 }],
  load: [
    { duration: "30s", target: 50  },
    { duration: "2m",  target: 50  },
    { duration: "30s", target: 0   },
  ],
  stress: [
    { duration: "1m",  target: 50  },
    { duration: "3m",  target: 200 },
    { duration: "1m",  target: 0   },
  ],
  spike: [
    { duration: "10s", target: 300 },
    { duration: "30s", target: 300 },
    { duration: "20s", target: 0   },
  ],
};

if (!STAGES[MODE]) {
  throw new Error(`Unknown MODE='${MODE}'. Pick: smoke | load | stress | spike.`);
}

export const options = {
  stages: STAGES[MODE],
  thresholds: {
    // SLOs -- override per-mode if needed. These are the soft contract
    // the backend should hold under the smoke/load profiles. Stress
    // and spike will likely breach them; that's the point.
    http_req_failed:   ["rate<0.01"],          // <1% errors
    http_req_duration: ["p(95)<1500"],         // 95th percentile <1.5s
    "checks{phase:read}": ["rate>0.99"],       // read paths must be >99% correct
    "checks{phase:auth}": ["rate>0.99"],
  },
  noConnectionReuse: false,
  insecureSkipTLSVerify: false,
};

// ---- custom metrics -----------------------------------------------------
const trendAuthLogin     = new Trend("phase_auth_login_ms");
const trendListCircles   = new Trend("phase_list_circles_ms");
const trendEligibility   = new Trend("phase_eligibility_ms");
const rateEligibilityOk  = new Rate("phase_eligibility_ok");
const counterWriteOps    = new Counter("write_ops");

// ---- helpers ------------------------------------------------------------
const baseHeaders = (extra = {}) => ({
  apikey: ANON_KEY,
  "Content-Type": "application/json",
  ...extra,
});

function think() {
  sleep(randomIntBetween(THINK_MIN, THINK_MAX));
}

// One-shot auth at VU start so every request inside a VU iteration carries
// the same access token. k6's setup() doesn't share state with VUs (it
// runs in a separate context), so we authenticate per-VU on first use.
let accessToken = null;
let userId = null;

function ensureAuth() {
  if (accessToken) return;
  if (!TEST_EMAIL || !TEST_PWD) return; // unauthenticated mode

  const r = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PWD }),
    { headers: baseHeaders(), tags: { phase: "auth" } },
  );

  trendAuthLogin.add(r.timings.duration);
  const ok = check(r, {
    "auth login 200": (res) => res.status === 200,
    "auth has token":  (res) => res.json("access_token") !== undefined,
  }, { phase: "auth" });

  if (ok) {
    accessToken = r.json("access_token");
    userId = r.json("user.id");
  }
}

function authHeaders() {
  return baseHeaders(
    accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  );
}

// ---- the journey --------------------------------------------------------
// Each VU iteration walks a slice of the realistic user flow. Sleep is
// scattered between phases so a single VU mimics a human, not a fire hose.

export default function () {
  group("phase 1 -- auth", () => {
    ensureAuth();
  });

  group("phase 2 -- read joinable circles", () => {
    const r = http.get(
      `${SUPABASE_URL}/rest/v1/circles?status=in.(pending,forming,open)&select=id,name,amount,frequency,member_count,current_members,status&limit=50`,
      { headers: authHeaders(), tags: { phase: "read" } },
    );

    trendListCircles.add(r.timings.duration);
    check(r, {
      "circles 200":         (res) => res.status === 200,
      "circles is array":    (res) => Array.isArray(res.json()),
      "circles latency ok":  (res) => res.timings.duration < 2000,
    }, { phase: "read" });

    // Pick one circle to probe eligibility against (if any returned).
    const list = Array.isArray(r.json()) ? r.json() : [];
    if (list.length > 0 && userId) {
      const target = list[randomIntBetween(0, list.length - 1)];

      // Sub-phase: circle join eligibility check (the gate we wired up
      // in migration 112). Read-only RPC -- safe in any environment.
      const elig = http.post(
        `${SUPABASE_URL}/rest/v1/rpc/check_circle_eligibility`,
        JSON.stringify({ p_user_id: userId, p_circle_id: target.id }),
        { headers: authHeaders(), tags: { phase: "read" } },
      );

      trendEligibility.add(elig.timings.duration);
      const okEli = check(elig, {
        "eligibility 200":      (res) => res.status === 200,
        "eligibility is array": (res) => Array.isArray(res.json()),
      }, { phase: "read" });
      rateEligibilityOk.add(okEli);
    }
  });

  think();

  if (WRITE && userId) {
    group("phase 3 -- write journey (WRITE=true only)", () => {
      // Submit a contribution -- this writes to cycle_contributions
      // via the process-contribution Edge Function (not directly to
      // the table) so RLS + business logic stays enforced.
      // Schema/keys depend on the user's active circle; for the load
      // test we just exercise the EF surface with a stub payload and
      // tolerate either 200 or 4xx (we want to measure latency under
      // pressure, not data correctness).
      const r = http.post(
        `${SUPABASE_URL}/functions/v1/process-contribution`,
        JSON.stringify({
          load_test: true,
          synthetic: true,
          user_id: userId,
          amount_cents: 10000,
        }),
        { headers: authHeaders(), tags: { phase: "write" } },
      );
      counterWriteOps.add(1);
      check(r, {
        "process-contribution reached EF": (res) => res.status < 500,
      }, { phase: "write" });
    });

    think();
  }

  group("phase 4 -- read own profile + alerts (admin)", () => {
    if (!userId) return;

    // Profile read -- canonical authenticated-read example.
    const p = http.get(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,full_name,xn_score,language`,
      { headers: authHeaders(), tags: { phase: "read" } },
    );
    check(p, {
      "profile 200":         (res) => res.status === 200,
      "profile single row":  (res) => Array.isArray(res.json()) && res.json().length <= 1,
    }, { phase: "read" });
  });
}

// ---- setup / teardown ---------------------------------------------------
// k6's setup() runs once on test start; we use it for a sanity ping that
// fails fast if env is misconfigured before VUs ramp.

export function setup() {
  const ping = http.get(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: ANON_KEY },
  });
  if (ping.status !== 200) {
    throw new Error(
      `Sanity ping to ${SUPABASE_URL}/rest/v1/ returned ${ping.status}. ` +
      "Check SUPABASE_URL + SUPABASE_ANON_KEY before running."
    );
  }
  return { startedAt: new Date().toISOString(), mode: MODE, write: WRITE };
}

export function teardown(data) {
  console.log(`[teardown] mode=${data.mode} write=${data.write} startedAt=${data.startedAt}`);
}
