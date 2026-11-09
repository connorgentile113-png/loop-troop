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
lib/world-poll.js   /learn world poll, five-minute buckets
lib/zentic.js       live zentic.org player count (status ping)
api/quests.js       GET catalog
api/run.js          POST run code (+ gentle rate limit)
api/unlock.js       POST camp password
api/worlds.js       GET /learn poll + players, POST a vote
dev/server.js       the production server: static files, API, password gate, /game relay
tests/              node:test suite
```

## Eaglercraft (`/learn`)

The page opens with a world picker instead of a banner:

- **Regular survival world** — the Loop Troop camp world, reached through our own `/game` relay.
- **Public Bedwars world with N active players** — `wss://zentic.org`, joined directly. No proxy or
  relay of ours is in that connection.

Under the buttons is a live poll of the same two worlds. A click on a world votes for it, and so do
the poll rows, so the bars move as people choose. Votes live in five-minute buckets and start from
scratch when the bucket rolls over. The player count next to the Bedwars world (and under the poll)
is a status ping to `mc.zentic.cc` from `api/worlds.js`, cached for 30 seconds. Picking a world
auto-joins it and removes the picker and the poll — from then on it is just the game, covering the
viewport, with only the Fullscreen button on top. No password is required.

The client reads `?world=survival|bedwars` and sets `joinServer` to the matching address. It keeps
the user's saved servers and offers both worlds in its own list as well.

The Node server provides one fixed destination:

- `/game` → `wss://looptroop.eagler.host` (or `GAME_UPSTREAM`).

It supports WebSocket and the identical HTTPS frame fallback under `/game/http/*`. The survival
world never connects directly to the upstream; the Zentic world is the only direct connection.
Vercel rewrites `/game/*` to the Render service, which owns the long-lived relay connections.
Neither route requires an unlock cookie.

Build the shipped client with `node scripts/build-client.mjs mc/eaglercraft.html` after changing
launch options or `lib/client-transport.js`. The vendor countdown is skipped because `/learn` has
already asked which world to open. Analytics, external relays and updates remain disabled.

## Notes for teachers

- Progress lives in the browser, so clearing site data resets it. There is no classroom
  dashboard and no data leaves the device beyond the code being run.
- The rate limit (90 runs/minute per IP) is per warm function instance, which is plenty for a
  class and keeps a runaway script from hammering the function.
- Sandboxing is layered (no globals, no dynamic code, timeout), but this is a teaching tool,
  not a security boundary for hostile code.
