# scripts/

One-off operational scripts that don't ship with the app. Today this
directory holds the k6 load test.

## load-test.js -- k6 backend load test

A read-heavy k6 script that exercises the Supabase REST + Auth + Edge
Function surface under realistic VU pressure. Read-only by default so
it can run against any environment; opt-in `WRITE=true` enables a
small destructive flow that should only point at staging.

### 1. Install k6

| Platform | Command |
| --- | --- |
| macOS (Homebrew) | `brew install k6` |
| Windows (Scoop) | `scoop install k6` |
| Windows (Chocolatey) | `choco install k6` |
| Linux (Debian/Ubuntu) | `sudo apt-get install k6` after adding the k6 apt repo per [k6 install docs](https://k6.io/docs/get-started/installation/) |
| Docker | `docker run --rm -i grafana/k6 run - <scripts/load-test.js` |

Confirm: `k6 version` should print >= v0.50.

### 2. Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Project URL (e.g. `https://fjqdkyjkwqeoafwvnjgv.supabase.co`) |
| `SUPABASE_ANON_KEY` | yes | Anon key from project settings -> API |
| `TEST_USER_EMAIL` | recommended | Existing test user. If unset, the script runs unauthenticated and skips per-user paths. |
| `TEST_USER_PASSWORD` | paired with above | |
| `MODE` | no (default `smoke`) | `smoke` \| `load` \| `stress` \| `spike` -- see profiles below |
| `WRITE` | no (default `false`) | Set to `true` to enable phase 3 (writes via process-contribution EF). Staging only. |
| `THINK_MIN` / `THINK_MAX` | no | Seconds of synthetic think-time between phases (defaults 1 / 4) |

**Never** point the script at prod with `WRITE=true`. The phase-3 path
hits `process-contribution` with a synthetic `load_test: true` payload;
the EF will likely reject it but the request is still recorded in
cron_job_logs/alerts and counts against rate limits.

### 3. Profiles

| Mode | VU shape | Wall-clock | Purpose |
| --- | --- | --- | --- |
| `smoke` | 1 VU for 30s | 30s | Correctness check -- runs in CI, fails fast on broken auth / config |
| `load` | 0 -> 50 over 30s, hold 50 for 2m, ramp down | 3m | "Typical day" pressure |
| `stress` | ramp to 200 VUs, hold 3m | 5m | Sustained pressure; expect SLO breaches |
| `spike` | 0 -> 300 -> 0 in ~1m | 1m | Burst-arrival test; what happens during a notification fan-out |

### 4. Run

Smoke (recommended first run from any environment):

```
k6 run \
  -e SUPABASE_URL=https://<ref>.supabase.co \
  -e SUPABASE_ANON_KEY=<anon-key> \
  -e TEST_USER_EMAIL=load-bot@example.com \
  -e TEST_USER_PASSWORD=<pwd> \
  -e MODE=smoke \
  scripts/load-test.js
```

Load against staging with writes:

```
k6 run \
  -e SUPABASE_URL=https://<staging-ref>.supabase.co \
  -e SUPABASE_ANON_KEY=<staging-anon-key> \
  -e TEST_USER_EMAIL=load-bot@example.com \
  -e TEST_USER_PASSWORD=<pwd> \
  -e MODE=load \
  -e WRITE=true \
  scripts/load-test.js
```

### 5. Reading the output

The script emits both the standard k6 metrics and four custom ones:

| Metric | Meaning |
| --- | --- |
| `phase_auth_login_ms` | Distribution of the `/auth/v1/token` call latency |
| `phase_list_circles_ms` | Latency of the `GET /rest/v1/circles?status=in.(...)` query |
| `phase_eligibility_ms` | Latency of the `check_circle_eligibility` RPC |
| `phase_eligibility_ok` | Rate at which the eligibility RPC returned 200 + array body |
| `write_ops` | Count of phase-3 calls into process-contribution (0 when `WRITE=false`) |

SLO thresholds (in `options.thresholds`):

- `http_req_failed`: <1% error rate
- `http_req_duration`: p(95) < 1500ms
- `checks{phase:read}` / `checks{phase:auth}`: each > 99% pass

Threshold breaches surface in the summary table at the end of the run
and exit k6 with a non-zero code -- safe to wire into CI.

### 6. Per-phase notes

- **Auth.** Each VU authenticates once on its first iteration and reuses
  the access token thereafter. k6's `setup()` doesn't share state with
  VUs, so we don't pre-mint tokens there.
- **Read circles.** Hits PostgREST directly with a status filter; if any
  row comes back, the VU picks one at random and probes
  `check_circle_eligibility` (read-only RPC -- safe on prod).
- **Write phase (WRITE=true only).** Hits `process-contribution` with a
  stub payload. The EF will likely 4xx because the payload is
  synthetic; we accept any non-5xx response. The point is to measure
  the EF's latency under VU pressure, not data correctness.
- **Profile read.** Anchors the per-user RLS path so a misconfigured
  policy fails the run loudly.

### 7. Limitations

- The script doesn't include the full "create circle -> 6 contribution
  cycles -> advance -> swap -> withdraw" journey because most of those
  flows mutate state in ways that would corrupt a shared environment.
  When that long-form journey is needed, fork this script into a
  separate file (e.g. `load-test-end-to-end.js`) that runs against an
  isolated test project and uses unique generated identifiers per VU.
- Edge Function cold starts are real and will skew the first iteration
  of any VU. Either warm up with a 5-VU smoke run first, or discard
  the first 30s of metrics when interpreting results.
