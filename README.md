# SAKHI – Women Safety System (Working Demo)

Project-1, B.Tech CSE (VII Sem), Medicaps University, Indore
Team: Prerna Magarde (EN23CS301781), Priyanshi Porwal (EN23CS301792), Priyanshi Singh Kaurav (EN23CS301794)
Guide: Ashish Shrivastva

This is a working web prototype of SAKHI. It shows the user's app, a trusted contact's phone,
a guardian's phone, the admin dashboard and a live backend log, all connected.

---

## How to run (choose ONE way)

### Way 1 – VS Code + Live Server (easiest)
1. Open this folder in VS Code: **File → Open Folder… → sakhi-demo**
2. VS Code will suggest the **Live Server** extension – click **Install**
   (or install "Live Server" by Ritwick Dey from the Extensions panel).
3. Right-click `index.html` → **Open with Live Server**.
4. The demo opens at `http://127.0.0.1:5500`. Any change you save reloads the page automatically.

### Way 2 – Node.js (no extension needed)
1. Install Node.js from https://nodejs.org (LTS) if you don't have it. Check with `node -v`.
2. In VS Code open the terminal: **Terminal → New Terminal**
3. Run:
   ```
   npm start
   ```
   (or `node server.js`)
4. Open `http://localhost:3000` in Chrome or Edge.
5. To stop the server press **Ctrl + C** in the terminal.

### Way 3 – Just double-click
Double-click `index.html`. Everything works except that some browsers block the
microphone and GPS for files opened this way. Use Way 1 or 2 for the presentation.

> No `npm install` is needed – the project has no dependencies.
> An internet connection is only used for the Hind font; without internet a system font is used.

---

## Project structure

```
sakhi-demo/
├── index.html        Page layout: demo controls, Priya's phone, right-side tabs
├── css/style.css     All styling (light and dark mode)
├── js/data.js        Helpers, city map of Indore (places, roads, police/hospitals), seed data
├── js/map.js         Geometry, safety score (Equation 3.1) and SVG map drawing
├── js/app.js         State, SOS engine, journey engine, all phone screens,
│                     Mummy's phone, guardian's phone, dashboard, backend log, presenter guide
├── server.js         Tiny Node.js web server (no packages needed)
└── package.json      "npm start" runs the server
```

### Where to find each feature in the code (`js/app.js`)
| Feature | Function / section |
|---|---|
| SOS (Algorithm 3.1) | `triggerSOS()`, `activateSOS()`, `resolveSOS()`, `wrongPinSilent()` |
| Offline SMS fallback | inside `activateSOS()` (`if(S.online) … else …`) and the ticker |
| Guardians within 2 km | `guardiansNotify()` |
| Journey and check-in (Algorithm 3.3) | `startJourney()`, `endJourney()`, journey part of the ticker |
| Safe route and score (Algorithm 3.2) | `computeRoutes()`, `edgeFactors()` in `js/map.js` |
| Evidence recording | `micStart()`, `micStop()` (real microphone if allowed) |
| Screens | the `SC` object (`SC.home`, `SC.sos`, `SC.route`, …) |
| Dashboard | `PG.dash` |
| Backend log | `log()` – every Firestore / Cloud Function / FCM / SMS step |

---

## How to present
Open the **Presenter guide** tab inside the demo. It has 12 steps in order, a **Show me**
button for each, what to say, and answers to likely examiner questions.

Quick order: Login → Trusted contacts → **SOS** (show Mummy's phone + Backend log) →
wrong PIN (silent mode) → offline SOS → Evidence vault → Safe route (move time slider) →
Journey + missed check-in → Report → approve in Dashboard → Guardian responds →
Cab safety, Fake call, Legal aid (Hindi) → Dashboard.

Press **Reset demo** before you start.

---

## What is real and what is simulated
**Real:** all screens and flows, SOS logic (3-second cancel, PIN stop, silent mode on wrong PIN,
offline fallback), safety score algorithm, journey timer and check-in, report moderation that
changes route scores, guardian matching within 2 km, siren/ringtone sound, fake-call voice,
microphone recording (if allowed), real GPS coordinates (optional), English/Hindi.

**Simulated:** Firebase services, push notifications, the SMS gateway and phone calls – each
step is shown in the **Backend log** tab. The city map is a simplified map of Indore.
In the final product these are implemented with Flutter, Firebase and Google Maps
as described in the SRS, SDS and project report.

---

## Tips
- Use **Chrome or Edge**, volume on (siren, ringtone and fake-call voice play real sound).
- Allow the **microphone** when asked during SOS – the recording can then be played in the Evidence Vault.
- Microphone, GPS and the shake sensor only work on `localhost` or HTTPS. On a phone opened through
  the Wi-Fi address (Way 2) they may be blocked; the demo then simulates them automatically.
- Demo data is saved in the browser. **Reset demo** clears it.
