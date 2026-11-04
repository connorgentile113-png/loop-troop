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

No dependencies: the site is static HTML/CSS/JS and the API is plain Node functions,
so there is nothing to `npm install` and no build step.

## Deploy to Vercel

```bash
npx vercel --prod
```

Vercel serves the files in the project root and turns `api/*.js` into Node serverless
functions automatically. `vercel.json` sets a 10s function limit and basic security headers.

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
api/quests.js       GET catalog
api/run.js          POST run code (+ gentle rate limit)
dev/server.js       local server that mirrors Vercel routing
tests/              node:test suite
```

## Education World (`/learn`)

A separate page (not linked from the quest app) that walks a camper through joining a shared
Eaglercraft world: pick a name (saved in this browser only), copy the server address, then open
the client in a new tab. Nothing is loaded from the Eaglercraft host until that button is pressed,
and the page has its own `noindex` tag.

The client is hosted by the Eaglercraft project and sends `X-Frame-Options: DENY`, so it cannot be
embedded in an iframe and it cannot be pre-filled with a name or a server address. Campers type
their name in the client and paste the address under Multiplayer → Direct Connect.

The server address is set in one place — the `wss://looptroop.eagler.host` text in `learn.html` — if
it ever moves. Verified: that host completes a WebSocket handshake on 443 (plain HTTPS on it only
redirects to the hosting provider's page, which is expected).

A relay on Vercel is not an option: Vercel Functions cannot hold a long-lived WebSocket, since the
connection closes at the function's maximum duration, and they have no raw TCP egress. If a network
blocks `eagler.host`, the fix is an allowlist on that network, or a relay on a host that supports
persistent connections.

### The client ships with the site

`/learn` is not a wrapper around somebody else's page: the client is served from this deployment at
`/mc/eaglercraft`, and the page makes **no requests to any third party** (no CDN, no font host, no
analytics). The launch options in that file prefill the camper's name from `?name=` and point the
client at `wss://looptroop.eagler.host`, with the relay list emptied.

`mc/eaglercraft.html` is built, not hand-edited:

```bash
node scripts/build-client.mjs              # downloads the official 1.8.8 zip (~13 MB)
node scripts/build-client.mjs some.zip     # or use a file you already have
```

It patches the official single-file build (33 MB) to (1) set Education World as the server,
(2) turn off analytics and the update/redirect services, (3) repoint the vendor's default relays at
our own server, and (4) fail the build if any third-party host survives. Rebuild it when the
upstream build changes; the output is committed because Vercel serves it as a static file.

Verified with headless Chrome against the local build: page loads, the WebGL canvas is live, the
options above are applied, and no request outside `loop-troop.vercel.app` is made.

## Notes for teachers

- Progress lives in the browser, so clearing site data resets it. There is no classroom
  dashboard and no data leaves the device beyond the code being run.
- The rate limit (90 runs/minute per IP) is per warm function instance, which is plenty for a
  class and keeps a runaway script from hammering the function.
- Sandboxing is layered (no globals, no dynamic code, timeout), but this is a teaching tool,
  not a security boundary for hostile code.
