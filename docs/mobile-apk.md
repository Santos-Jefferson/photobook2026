# Run Photobook on a phone

Two ways — pick one.

## Option 1 — Install as an app (no build, recommended)

The app is a PWA, so any phone can "install" it from the browser:

**Android (Chrome):** open the deployed URL →
`https://photobook.use.eks.mcap.sip.dev.cloud.synchronoss.net` → menu (⋮) →
**Install app** / **Add to Home screen**. It launches full-screen with its own icon
and reaches the APIs exactly like the browser.

**iOS (Safari):** open the URL → Share → **Add to Home Screen**.

Nothing to build; it always runs the latest deployed version.

## Option 2 — Build an `.apk` (Capacitor WebView → deployed URL)

This produces a real installable `.apk`. The shell is a WebView that loads the
**deployed URL** (`capacitor.config.json` → `server.url`), so the app and all
`/api/*` + Genius calls are served by the cluster — nothing is bundled offline.

**Prerequisites:** Android Studio (or the Android SDK + a JDK 17) and `adb`.

```bash
# from the repo root
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap add android          # generates the android/ project (uses capacitor.config.json)
npx cap sync android

# build a debug APK
cd android
./gradlew assembleDebug
#  -> android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on a connected device:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or open `android/` in **Android Studio** → Run ▶ to deploy to your device directly.

### Notes
- Because `server.url` points at the live site, you don't rebuild the APK when the
  app changes — just redeploy the cluster. (To ship a fully offline bundle instead,
  remove `server.url` and make the client call absolute API URLs.)
- The device must be able to reach the deployed host and the Genius API (same as the
  browser).
- To change the app id / name, edit `capacitor.config.json` before `npx cap add`.
