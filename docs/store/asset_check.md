# App Icon + Splash Screen — Audit Report

Ran a raw PNG header read over `assets/` on 2026-07-05.

| File | Size | Bytes | Verdict |
|---|---|---|---|
| `assets/icon.png` | **1024 × 1024** | 22,380 | ✅ Matches Apple + Expo requirement (1024 opaque PNG). |
| `assets/adaptive-icon.png` | **1024 × 1024** | 17,547 | ✅ Matches Android adaptive-icon foreground requirement. |
| `assets/splash-icon.png` | **1024 × 1024** | 17,547 | ✅ Matches Expo's new-splash requirement (used by `expo-splash-screen`). |
| `assets/favicon.png` | **48 × 48** | 1,466 | ⚠ Small. Web / PWA typically want at least 192 × 192; Play Console recommends 512 × 512. Not a submission blocker but produces a blurry Chrome tab / Vercel-artifact tab. |

## Concerns / to-do

1. **Adaptive icon foreground vs background.**
   `app.json` currently references `assets/adaptive-icon.png` as the
   foreground and uses `#ffffff` (pure white) as the background. That
   works, but on white-themed Android launcher backgrounds the app
   icon can look "faded" because the safe zone is only the inner 66 %
   of the 1024 square. Verify visually on a Pixel device or check
   against the [Adaptive icon Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html).
   If the current icon uses more than 66% of the canvas, redraw the
   foreground so all critical detail fits inside the inner 660×660 zone.

2. **Splash image sizing.**
   With `resizeMode: "contain"` and a 1024×1024 splash, the image
   renders comfortably centered on all devices. No action.

3. **Favicon upgrade.**
   Recommend replacing `assets/favicon.png` with a 512×512 export
   *(same "Xn" mark as the icon)* so the web deployment picks up a
   crisper Vercel-tab icon. Not a store-submission item; can ship
   after launch.

4. **Missing store-listing assets** (not in-app; will be generated later):
   - App Store: 1024×1024 marketing icon (rounded corners; App Store
     Connect crops it automatically from the same asset).
   - Play Console: 512×512 hi-res icon.
   - Feature graphic (Play Console only): 1024×500 landscape banner.
   - Screenshots — see [screenshot_guide.md](./screenshot_guide.md).

## Generating store-listing assets

Recommended workflow — no design tool required:

```bash
# From assets/icon.png (1024x1024), produce the App Store 1024 (unchanged)
# and the Play Store 512 hi-res:
npx sharp assets/icon.png -o dist/app_store_icon_1024.png --resize 1024x1024
npx sharp assets/icon.png -o dist/play_hi_res_512.png     --resize 512x512
```

Or use `eas build:configure` to have EAS auto-generate the store-icon
sizes from the 1024 source when preparing a build.
