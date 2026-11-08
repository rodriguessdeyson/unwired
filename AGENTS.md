# unWired: working agreement

- Keep `com.rad.unwired` and raise `versionCode` from the last published build. Never commit keystores.
- The app is local-only: no account and no backend of our own. Fonts are bundled. The only network traffic besides the devices is AdMob (free tier) and Google Play Billing.
- Free with ads; a one-time `unwired_premium` purchase (price set in Play Console) removes ads and unlocks exports. IDs live in `src/app/core/monetization.config.ts` and the AdMob `APPLICATION_ID` in the manifest; both ship as Google's test IDs until replaced. No ads on the Session tab, and bottom sheets hide the native banner.
- Screens never touch a transport directly. They use `SessionStore`, which uses `SerialTransport`.
- The legacy 5-byte format, the `LS`/`DS` defaults and the import from `com.rad.unwired_preferences` protect existing firmware and users. Add a test before changing them.
- Never turn Bluetooth on or off on the user's behalf. Only `ACTION_REQUEST_ENABLE` may ask.
- Do not bind `[value]` on the terminal input: rewriting the field while typing breaks Android keyboard composition.

## Checks

```bash
npm test -- --watch=false
npx ng build
```

For native changes, also run `npx cap sync android` and `android\gradlew.bat assembleDebug` with `JAVA_HOME` set to Android Studio's `jbr`. The browser build uses simulated devices from `src/app/core/mock.ts`, so it proves nothing about Bluetooth: say so when hardware testing is still pending.
