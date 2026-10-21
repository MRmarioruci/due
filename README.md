# due.

Scan a bill, get reminded before it's due, pay it from the QR code when the time comes.

- **Scan**: the camera reads payment codes exactly on the device (Swiss QR-bill, EPC/GiroCode). Gemini reads the photo for everything else: due date, description, category, and the full details when there is no code. Each field shows where it came from (**QR** or **AI**).
- **Remind**: one local notification per bill, a set number of days before it's due, moved to Friday when it would fall on a weekend. The notification has *Tomorrow* and *Paid* actions.
- **Pay**: the bill screen shows a QR code your banking app can scan: the original QR-bill or GiroCode, or a GiroCode built from printed SEPA details.
- **Stats**: what you paid per week/month/year, how often on time, how many days before the due date, and by category.

Design: [canvas](https://claude.ai/artifact/X5vyGPve69UzXvytz2rqzR).

## Run it on your Android phone

You need Node 20+ and the **Expo Go** app from the Play Store (a recent version; this project uses Expo SDK 57).

```bash
npm install
cp .env.example .env.local   # due-api address + app key
npm run dev
```

Scan the QR code in the terminal with Expo Go. Phone and computer must be on the same Wi-Fi. If the phone can't connect (guest Wi-Fi, firewall, VPN), use a tunnel instead:

```bash
npm run dev:tunnel
```

In development, **long-press the "due" logo** on the home screen to load sample bills.

Bills are read by [due-api](../due-api), which holds the Gemini key; run it locally with `npm run serve` in that repo. Without it the app still works: QR codes are read on the device and you fill in the rest.

## Development build (reminders, widget)

Expo Go can't run notifications on Android or the home-screen widget. For those, install a development build of due on the phone once:

```bash
npx eas-cli login            # your Expo account
npm run build:dev            # builds an APK in the cloud (~15 min), prints a link + QR
```

Open the link on the phone and install the APK. From then on, start the server with `npm run dev:client` and open due (not Expo Go); JavaScript changes still reload instantly. Rebuild only after adding a library with native code.

## Notes

- Everything runs in Expo Go: camera, QR scanning, local notifications, SQLite. Remote push isn't used (Expo Go doesn't support it on Android), and isn't needed: reminders are scheduled on the phone.
- The app holds no model key: it sends the photo to due-api, which rate-limits per device and calls Gemini.
- Data stays on the phone, in SQLite (`due.db`).

## Code

```
src/app/            screens (Expo Router): index, scan, review, bill/[id], stats
src/lib/payment-codes.ts   Swiss QR-bill + EPC/GiroCode parsers, GiroCode builder
src/lib/extract.ts  Gemini call; merges code + model results into a draft bill
src/lib/reminders.ts       scheduling, snooze, paid, notification actions
src/lib/store.ts    SQLite storage + useBills()
src/lib/stats.ts    stats bucketing
src/ui/             theme + small component kit
```

```bash
npm run check   # typecheck + lint + tests
```
