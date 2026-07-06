# Screenshot Guide — App Store + Play Store Submission

Both stores now surface **your first three screenshots** in search
results, so put the strongest surfaces there. Aim for **5–8 screenshots
per device size**.

---

## Shot list — priority order (both stores)

| # | Screen | Route | Notes / captions |
|---|---|---|---|
| 1 | Home / Dashboard | `HomeScreen` | Show a positive XnScore + at least one active circle. Caption: "Save with people you trust." |
| 2 | Circle detail (payout imminent) | `CircleDetailScreen` | Include the countdown chip. Caption: "Your turn in 2 cycles." |
| 3 | Create circle wizard (step 2) | `CreateCircleScreen` | The step where you set amount + cycle length — visual and self-explanatory. Caption: "Set the amount. Invite your people. Start." |
| 4 | Group chat inside a circle | `GroupChatScreen` | With a couple of system messages ("Alice joined") + a user message. Caption: "Chat lives with the money." |
| 5 | Wallet | `WalletScreen` | With a balance, a recent contribution, and the "Withdraw to bank" row visible. Caption: "Top up. Withdraw. See every cent." |
| 6 | 2FA / Security | `SecuritySettingsScreen` or `TwoFactorAuthScreen` | Enrolment QR + code entry. Caption: "Real 2FA. Real sessions." |
| 7 | Trips list | `EventsScreen` or `MyTripsScreen` | A short list of upcoming events / trips with cover images. Caption: "Save toward a shared trip." |
| 8 | Dream detail | `PostDetailScreen` (a dream post) | Someone else cheering your dream. Caption: "Cheered on by your community." |

Optional / skip if time-boxed:
- Admin dashboard (`AdminHub`) — only if pitching to elders/organizers.
- Withdraw to bank flow (`WithdrawToBankScreen`) — repeats #5 in most cases.

**Onboarding / welcome** is intentionally NOT on the list. Screenshots
should surface value, not friction. Save "Welcome" for the intro video
if you make one.

---

## Required resolutions (2026 store requirements)

### iOS — App Store Connect

Apple requires screenshots for the **6.9″ iPhone** (Pro Max) OR the
**6.5″ iPhone** as of 2026. Uploading 6.5″ auto-scales for smaller
sizes; you do NOT need to upload every device size.

| Size | Resolution | Devices covered |
|---|---|---|
| **6.9″ iPhone Pro Max** (recommended primary) | 1290 × 2796 px, portrait | iPhone 15/16 Pro Max |
| 6.5″ iPhone | 1242 × 2688 px, portrait | iPhone 11 Pro Max, XS Max |
| 5.5″ iPhone | 1242 × 2208 px, portrait | iPhone 8 Plus (still required by App Store Review, though rarely displayed) |
| 12.9″ iPad Pro | 2048 × 2732 px, portrait | if `ios.supportsTablet: true` — required at submission |

### Android — Play Console

| Asset | Resolution / constraints |
|---|---|
| Phone screenshots | 16:9 or 9:16 aspect. Minimum 320 px, maximum 3840 px on each side. Recommended: **1080 × 1920 portrait**. |
| 7″ tablet | Recommended 1200 × 1920 portrait |
| 10″ tablet | Recommended 1600 × 2560 portrait |
| Feature graphic (banner shown above the description) | 1024 × 500 landscape |
| Hi-res app icon | 512 × 512, 32-bit PNG with alpha |

Play requires **at least 2 phone screenshots** at minimum, but the
store algorithm rewards decks with **8 screenshots**.

---

## How to capture

### iOS Simulator (macOS, Xcode installed) — recommended

```bash
# Boot the simulator in one terminal.
open -a Simulator
xcrun simctl list devices  # find your device UDID

# Grab a screenshot straight to disk (retina-clean, no bezel).
xcrun simctl io booted screenshot ~/Desktop/tandaxn-home.png
```

Fastest way to hit multiple sizes: run the Expo dev client on the
6.9″, 6.5″, and 5.5″ simulators in sequence — same script, different
simulator booted.

### Android Emulator (Android Studio installed)

```bash
# List running AVDs.
adb devices

# Capture screenshot.
adb exec-out screencap -p > ~/Desktop/tandaxn-home.png
```

Or press the **camera icon** on the emulator toolbar.

### Physical device

- **iOS:** press **Side + Volume Up** simultaneously. Screenshots land
  in Photos → Screenshots album.
- **Android:** press **Power + Volume Down** for ~1 second. Screenshots
  land in `Pictures/Screenshots/`.

Physical-device screenshots include your battery indicator, cell
carrier, and time — **normalize these before uploading** (see below).

---

## Pre-flight checklist for every screenshot

- [ ] Time in the status bar shows **9:41** (Apple's convention).
      Trick: in Simulator use `xcrun simctl status_bar booted override --time 09:41` to force it.
- [ ] Battery reads **100 %**, cell signal is **full bars**, Wi-Fi is
      shown, no Bluetooth icon.
      Trick: `xcrun simctl status_bar booted override --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4 --dataNetwork wifi`.
- [ ] No red badges / debug indicators.
- [ ] Only **seed data** — no real member names, no real emails, no
      personal amounts. Use accounts under a `@tandaxn.dev` domain
      and lorem-ipsum message bodies.
- [ ] Dark mode is intentional (either capture BOTH themes, or pick
      light-only for consistency).
- [ ] Same locale across all screenshots (English for the primary
      deck; a separate French deck if you want to localize the store
      listing).

---

## Text overlays (optional but recommended)

Both stores let you upload plain-render screenshots or design-overlaid
screenshots. Overlaid decks convert better. Suggested pattern:

```
┌───────────────────────────────────┐
│                                   │
│    "Save with people you trust."  │  ← 32 pt heading
│    Rotating circles for groups.   │  ← 16 pt subhead
│                                   │
│    ┌───────────────────────────┐  │
│    │                           │  │
│    │      screenshot           │  │
│    │                           │  │
│    └───────────────────────────┘  │
│                                   │
└───────────────────────────────────┘
```

Colors: navy gradient background (`#0A2342 → #143654`) matching the
in-app hero, with the teal accent (`#00C6AE`) for CTAs / underlines.

Tools that don't require design skill:
- **Fastlane Frameit** — free CLI that frames raw screenshots with
  device bezels + captions from a `Framefile.json`.
- **Screenshot.rocks** — free web app; drag-drop, download PNGs.
- **Figma** — if you already use it, a $0 solution with reusable
  templates.

---

## After capture — normalize + upload

1. Rename files by shot number: `01-home.png`, `02-circle-detail.png`,
   … so the store shows them in the intended order.
2. Verify each PNG opens at the exact resolution above.
3. For iOS: upload via App Store Connect → your app → Screenshots.
4. For Play: upload via Play Console → Store presence → Main store
   listing → Graphics.

Keep the raw PNGs under `docs/store/screenshots/YYYY-MM-DD/` in this
repo so future you (or your marketing hire) has the source.
