# Loop Troop 🌀

Learn to code by playing. Free, interactive JavaScript quests for middle schoolers —
no sign-up, no setup, no install. Write real code in the browser, hit run, and pass the
server-side checks to earn XP and badges.

## What's inside

- **12 quests across 3 trails** — variables, strings, math, conditionals, logic, `for`/`while`
  loops, arrays, functions, debugging and a rock-paper-scissors boss quest. Every quest has
  two hints and an optional worked answer, so nobody gets stranded.
- **A real editor** with line numbers, tab support and `⌘/Ctrl + Enter` to run.
- **Server-side checks** — the browser never receives the tests. Code runs in a locked-down
  `node:vm` sandbox (no `require`, no `process`, no network, no `eval`, 3s timeout) inside a
  Vercel serverless function.
- **Bug Hunt arcade** — ten "what does this code do?" puzzles with explanations, score and streak.
- **Playground** — free-form sandbox with starter snippets.
- **XP, levels and six badges**, saved in `localStorage`. No accounts, no tracking, no cookies.

## Run it locally

```bash
npm run dev      # http://localhost:4321
npm test         # Node test runner: quest content + sandbox behaviour
```

One dependency — `ws`, for the `/game` relay. Everything else is static HTML/CSS/JS and plain Node
functions.

```bash
npm install
npm start
```

## Deploy

The live site is a Render free web service built from `github.com/connorgentile113-png/loop-troop`:

```bash
git push        # Render rebuilds main automatically
```

`dev/server.js` is the production server, not just a dev convenience: it serves the static files,
routes `/api/*` to the functions in `api/`, serves `/mc/*` without a password and relays
`/game` to the game server.

A Vercel copy still works for the quest app (`npx vercel --prod`), but it cannot host
the relay — a function cannot stream a 33 MB file or hold a WebSocket. Render is the site.

## Layout

```
index.html          app shell
src/app.js          state, routing, run/answer actions
src/views.js        HTML templates for each screen
src/progress.js     XP, levels, badges (localStorage)
src/arcade-data.js  Bug Hunt questions
src/fx.js           confetti + Web Audio chirps
lib/quests.js       quest content and the checks (server only)
lib/sandbox.js      vm runner
lib/gate.js         camp password + unlock cookie
api/quests.js       GET catalog
api/run.js          POST run code (+ gentle rate limit)
api/unlock.js       POST camp password
dev/server.js       the production server: static files, API, password gate, /game relay
tests/              node:test suite
```

## Eaglercraft (`/learn`)

The page shows a Loop Troop banner for three seconds, then automatically opens the game
covering the viewport. No password is required. The Fullscreen button requests browser fullscreen
(which requires a user gesture). The client keeps the user's saved servers and supplies Loop Troop
and Arch MC as available servers without automatically joining either.

The Node server provides two fixed destinations using the same relay implementation:

- `/game` → `wss://looptroop.eagler.host` (or `GAME_UPSTREAM`).
- `/game/arch` → `wss://arch.mc`.

Both support WebSocket and the identical HTTPS frame fallback under their respective `/http/*`
paths. The client never connects directly to either upstream. Vercel rewrites `/game/*` to the
Render service, which owns the long-lived relay connections. Neither route requires an unlock cookie.

Build the shipped client with `node scripts/build-client.mjs mc/eaglercraft.html` after changing
launch options or `lib/client-transport.js`. The vendor countdown is skipped because `/learn`
provides the banner. Analytics, external relays and updates remain disabled.

## Notes for teachers

- Progress lives in the browser, so clearing site data resets it. There is no classroom
  dashboard and no data leaves the device beyond the code being run.
- The rate limit (90 runs/minute per IP) is per warm function instance, which is plenty for a
  class and keeps a runaway script from hammering the function.
- Sandboxing is layered (no globals, no dynamic code, timeout), but this is a teaching tool,
  not a security boundary for hostile code.
