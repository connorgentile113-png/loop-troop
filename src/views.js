import { arcadeQuestions } from "./arcade-data.js";
import { badgesFor, doneCount, levelFor, levelProgress, xpFor } from "./progress.js";

export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const activeTab = (state) => {
  if (state.route.name === "quest") return "quests";
  return state.route.name;
};

export function xpChipMarkup(state) {
  const xp = xpFor(state.quests, state.progress);
  const level = levelFor(xp);
  return `
    <span class="xp-emoji" aria-hidden="true">${level.emoji}</span>
    <span class="xp-text"><b>${xp} XP</b><small>${esc(level.title)}</small></span>`;
}

export function headerView(state) {
  const cleared = doneCount(state.quests, state.progress);
  const total = state.quests.length;
  const tab = activeTab(state);
  const link = (name, label, extra = "") =>
    `<a class="tab ${tab === name ? "is-active" : ""}" href="#/${name === "home" ? "" : name}">${label}${extra}</a>`;

  return `
  <header class="topbar">
    <a class="brand" href="#/">
      <span class="brand-mark" aria-hidden="true">🌀</span>
      <span class="brand-name">Loop<em>Troop</em></span>
    </a>
    <nav class="tabs" aria-label="Main navigation">
      ${link("home", "Basecamp")}
      ${link("quests", "Quests", `<span class="tab-count">${cleared}/${total}</span>`)}
      ${link("arcade", "Bug Hunt")}
      ${link("playground", "Playground")}
    </nav>
    <div class="topbar-right">
      <button class="sound-toggle" data-action="mute" aria-pressed="${!state.progress.muted}"
        title="${state.progress.muted ? "Turn sound on" : "Turn sound off"}">
        ${state.progress.muted ? "🔇" : "🔊"}<span class="sr-only">Toggle sound</span>
      </button>
      <div class="xp-chip" id="xp-chip" title="Experience points">${xpChipMarkup(state)}</div>
    </div>
  </header>`;
}

export function footerView() {
  return `
  <footer class="footer">
    <p><b>Loop Troop</b> — real code, small missions, zero setup.</p>
    <p class="small muted">Your code runs in a sandboxed Node.js process. Progress saves in this browser only.</p>
  </footer>`;
}

function trackCard(state, track) {
  const list = state.quests.filter((quest) => quest.track === track.id);
  const cleared = list.filter((quest) => state.progress.done[quest.id]).length;
  return `
    <a class="track-card track-${track.color}" href="#/quests">
      <span class="track-emoji" aria-hidden="true">${track.emoji}</span>
      <h3>${esc(track.name)}</h3>
      <p>${esc(track.blurb)}</p>
      <div class="track-foot"><span class="pill">${cleared}/${list.length} cleared</span><span aria-hidden="true">→</span></div>
    </a>`;
}

export function homeView(state) {
  const { quests, progress } = state;
  const xp = xpFor(quests, progress);
  const cleared = doneCount(quests, progress);
  const level = levelFor(xp);
  const bar = levelProgress(xp);
  const nextUp = quests.find((quest) => !progress.done[quest.id]) || quests[quests.length - 1];
  const badges = badgesFor(quests, progress);
  const earned = badges.filter((badge) => badge.earned).length;

  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">🎒 Free · No sign-up · Built for middle school</p>
        <h1>Learn to code<br /><span class="marker">by playing.</span></h1>
        <p class="lede">
          Real JavaScript, tiny missions, instant feedback. Write a line, hit run,
          watch the Code Machine answer. Collect XP, unlock badges, squash bugs.
        </p>
        <div class="hero-actions">
          <a class="btn primary" href="#/quest/${nextUp.id}">
            ${cleared === 0 ? "Start your first quest" : "Keep going"} <span aria-hidden="true">→</span>
          </a>
          <a class="btn ghost" href="#/arcade">Try Bug Hunt 🐛</a>
        </div>
        <p class="hero-note small">Works on a Chromebook, tablet or phone. Nothing to install.</p>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="code-card">
          <div class="code-dots"><i></i><i></i><i></i></div>
          <pre><code><span class="c-key">while</span> (curious) {
  <span class="c-fn">learn</span>();
  <span class="c-fn">levelUp</span>(<span class="c-num">20</span>);
}
<span class="c-com">// you are here →</span></code></pre>
        </div>
        <span class="sticker s1">🐛 squashed</span>
        <span class="sticker s2">{ }</span>
        <span class="sticker s3">+20 XP</span>
        <span class="sticker s4">🌀</span>
      </div>
    </section>

    <section class="stat-row" aria-label="Your progress">
      <div class="stat"><span>Quests cleared</span><b>${cleared}<em>/${quests.length}</em></b></div>
      <div class="stat"><span>XP earned</span><b>${xp}</b></div>
      <div class="stat"><span>Your level</span><b class="stat-small">${level.emoji} ${esc(level.title)}</b></div>
      <div class="stat"><span>Bug Hunt best</span><b>${progress.arcadeBest}<em>/10</em></b></div>
    </section>

    <section class="panel crew">
      <div class="crew-name">
        <label for="crew-name">Your crew name</label>
        <input id="crew-name" maxlength="18" autocomplete="off" spellcheck="false"
          placeholder="Type a nickname (optional)" value="${esc(progress.name)}" />
        <small class="muted">Saved on this device only. No account, no email.</small>
      </div>
      <div class="crew-level">
        <div class="crew-level-top"><b>${level.emoji} ${esc(level.title)}</b><span>${xp} XP</span></div>
        <div class="bar"><i style="width:${bar.percent}%"></i></div>
        <small class="muted">${
          bar.next
            ? `${bar.toNext} XP to ${bar.next.title} ${bar.next.emoji}`
            : "Top level reached. Absolute legend."
        }</small>
      </div>
    </section>

    <section class="block">
      <div class="block-head">
        <h2>Pick a trail</h2>
        <p class="small muted">Start anywhere. Everything stays unlocked.</p>
      </div>
      <div class="track-grid">${state.tracks.map((track) => trackCard(state, track)).join("")}</div>
    </section>

    <section class="panel block">
      <div class="block-head">
        <h2>Badge shelf <span class="pill">${earned}/${badges.length}</span></h2>
        <p class="small muted">Earn them by finishing quests and messing around.</p>
      </div>
      <ul class="badge-grid">
        ${badges
          .map(
            (badge) => `
          <li class="badge ${badge.earned ? "is-earned" : "is-locked"}">
            <span class="badge-emoji" aria-hidden="true">${badge.earned ? badge.emoji : "🔒"}</span>
            <div><b>${esc(badge.name)}</b><small>${esc(badge.hint)}</small></div>
          </li>`,
          )
          .join("")}
      </ul>
    </section>

    <section class="how">
      <h2>How a quest works</h2>
      <ol class="how-list">
        <li><span>1</span><div><b>Read the mission</b><p>One tiny goal, in plain words.</p></div></li>
        <li><span>2</span><div><b>Write real code</b><p>A full editor with a run button. No drag-and-drop puzzles.</p></div></li>
        <li><span>3</span><div><b>Pass the checks</b><p>The server tests your code and tells you exactly what to fix.</p></div></li>
      </ol>
    </section>`;
}

export function questsView(state) {
  const cleared = doneCount(state.quests, state.progress);
  return `
    <section class="page-head">
      <h1>Quest map</h1>
      <p class="lede">
        ${cleared} of ${state.quests.length} cleared. Each quest takes about five minutes and ends with
        a green checklist. Stuck? Every quest has hints and an answer you can peek at.
      </p>
    </section>
    ${state.tracks
      .map((track) => {
        const list = state.quests.filter((quest) => quest.track === track.id);
        const done = list.filter((quest) => state.progress.done[quest.id]).length;
        return `
        <section class="block trail trail-${track.color}">
          <div class="block-head">
            <h2>${track.emoji} ${esc(track.name)} <span class="pill">${done}/${list.length}</span></h2>
            <p class="small muted">${esc(track.blurb)}</p>
          </div>
          <div class="quest-grid">
            ${list
              .map((quest) => {
                const isDone = Boolean(state.progress.done[quest.id]);
                return `
              <a class="quest-card ${isDone ? "is-done" : ""}" href="#/quest/${quest.id}">
                <span class="quest-emoji" aria-hidden="true">${quest.emoji}</span>
                <span class="quest-text">
                  <b>${esc(quest.title)}</b>
                  <small>${esc(quest.level)} · ${quest.xp} XP · ${quest.testCount} checks</small>
                </span>
                <span class="quest-state" aria-hidden="true">${isDone ? "✓" : "→"}</span>
              </a>`;
              })
              .join("")}
          </div>
        </section>`;
      })
      .join("")}`;
}

export function questView(state, quest) {
  const track = state.tracks.find((item) => item.id === quest.track);
  const isDone = Boolean(state.progress.done[quest.id]);
  const index = state.quests.findIndex((item) => item.id === quest.id);
  const nextQuest = state.quests[index + 1] || null;
  const draft = state.progress.drafts[quest.id];

  return `
    <a class="back" href="#/quests"><span aria-hidden="true">←</span> All quests</a>
    <header class="page-head quest-head">
      <div class="chip-row">
        <span class="track-chip">${track ? `${track.emoji} ${esc(track.name)}` : "Quest"}</span>
        <span class="pill">${esc(quest.level)}</span>
        <span class="pill">+${quest.xp} XP</span>
        <span class="pill ${isDone ? "pill-good" : ""}">${isDone ? "✓ Cleared" : "Not cleared yet"}</span>
      </div>
      <h1>${quest.emoji} ${esc(quest.title)}</h1>
      <p class="lede">${esc(quest.story)}</p>
    </header>

    <div class="quest-layout">
      <section class="editor-panel" aria-label="Code editor">
        <div class="editor">
          <div class="editor-bar">
            <i class="dot red"></i><i class="dot yellow"></i><i class="dot green"></i>
            <span class="filename">quest.js</span>
            <span class="editor-tip">⌘/Ctrl + Enter to run</span>
          </div>
          <div class="editor-body">
            <div class="gutter" id="gutter" aria-hidden="true">${(draft ?? quest.starter)
              .split("\n")
              .map((_, i) => i + 1)
              .join("\n")}</div>
            <textarea id="editor" spellcheck="false" autocapitalize="off" autocomplete="off"
              aria-label="Your JavaScript code">${esc(draft ?? quest.starter)}</textarea>
          </div>
        </div>
        <div class="editor-actions">
          <button class="btn primary" data-action="run-quest">▶ Run my code</button>
          <button class="btn ghost" data-action="reset-quest">↺ Reset</button>
          <span class="run-status small muted" id="run-status">Not run yet</span>
        </div>
        <div class="results" id="results" aria-live="polite"></div>
      </section>

      <aside class="mission">
        <div class="panel">
          <h2>🎯 Mission</h2>
          <p>${esc(quest.prompt)}</p>
        </div>
        <div class="panel">
          <h2>💡 New idea</h2>
          <p>${esc(quest.concept)}</p>
        </div>
        <div class="panel">
          <h2>✅ The checks</h2>
          <ul class="checks">
            ${quest.testList.map((test) => `<li>${esc(test)}</li>`).join("")}
          </ul>
          <p class="small muted">All of these must pass to clear the quest.</p>
        </div>
        <div class="panel">
          <h2>🆘 Need a nudge?</h2>
          ${quest.hints
            .map(
              (hint, i) => `
            <details class="hint">
              <summary>Hint ${i + 1}</summary>
              <p>${esc(hint)}</p>
            </details>`,
            )
            .join("")}
          <details class="hint reveal">
            <summary>Show me the answer</summary>
            <pre class="solution">${esc(quest.solution)}</pre>
            <p class="small muted">Reading answers is allowed. Retype it yourself, then change one number to see what happens.</p>
          </details>
        </div>
        ${
          nextQuest
            ? `<a class="next-card" href="#/quest/${nextQuest.id}">
                <small>Next up</small><b>${nextQuest.emoji} ${esc(nextQuest.title)}</b><span>→</span>
              </a>`
            : `<a class="next-card" href="#/quests"><small>You reached the end</small><b>Back to the quest map</b><span>→</span></a>`
        }
      </aside>
    </div>`;
}

export function playgroundView(state) {
  return `
    <section class="page-head">
      <h1>🧪 Playground</h1>
      <p class="lede">
        Try anything. Break things. Nothing here is graded. Write JavaScript, press run,
        and read the console — that is how everyone actually learns.
      </p>
    </section>

    <div class="snippets" role="group" aria-label="Starter snippets">
      <button class="chip-btn" data-action="snippet" data-snippet="loop">Loop a list 🔁</button>
      <button class="chip-btn" data-action="snippet" data-snippet="fizz">FizzBuzz 🔢</button>
      <button class="chip-btn" data-action="snippet" data-snippet="dice">Dice roller 🎲</button>
      <button class="chip-btn" data-action="snippet" data-snippet="pattern">Emoji tower 🛸</button>
    </div>

    <section class="editor-panel">
      <div class="editor">
        <div class="editor-bar">
          <i class="dot red"></i><i class="dot yellow"></i><i class="dot green"></i>
          <span class="filename">playground.js</span>
          <span class="editor-tip">⌘/Ctrl + Enter to run</span>
        </div>
        <div class="editor-body">
          <div class="gutter" id="play-gutter" aria-hidden="true">1</div>
          <textarea id="play-editor" spellcheck="false" autocapitalize="off" autocomplete="off"
            aria-label="Playground code">${esc(state.playCode)}</textarea>
        </div>
      </div>
      <div class="editor-actions">
        <button class="btn primary" data-action="run-play">▶ Run it</button>
        <span class="run-status small muted" id="play-status">Lines you log appear below</span>
      </div>
      <div class="results" id="play-results" aria-live="polite"></div>
    </section>

    <div class="panel tip">
      <b>Good to know</b>
      <p>
        This code runs on the server in a sandbox, so there is no <code>document</code>,
        <code>alert()</code> or network access — just JavaScript and <code>console.log()</code>.
        ${state.progress.playgroundRuns > 0 ? `<span class="pill pill-good">${state.progress.playgroundRuns} runs so far</span>` : ""}
      </p>
    </div>`;
}

export function arcadeView(state) {
  const arcade = state.arcade;
  const total = arcadeQuestions.length;

  if (arcade.done) {
    const message =
      arcade.score >= 9
        ? "Certified bug whisperer. 🏆"
        : arcade.score >= 7
          ? "Strong debugging instincts. 🧭"
          : arcade.score >= 4
            ? "Solid start — read the code line by line and try again. 🔁"
            : "Every bug hunter starts somewhere. Run it again. 🌱";
    return `
      <section class="page-head">
        <h1>🐛 Bug Hunt</h1>
        <p class="lede">Ten quick puzzles about what code really does.</p>
      </section>
      <div class="panel arcade-result">
        <span class="big-score">${arcade.score}<small>/${total}</small></span>
        <h2>${esc(message)}</h2>
        <p>Best score on this device: <b>${state.progress.arcadeBest}/${total}</b></p>
        <div class="hero-actions">
          <button class="btn primary" data-action="restart-arcade">Play again ↺</button>
          <a class="btn ghost" href="#/quests">Go to the quest map →</a>
        </div>
      </div>`;
  }

  const question = arcadeQuestions[arcade.index];
  const answered = arcade.answered;
  const isAnswered = answered !== null;

  return `
    <section class="page-head arcade-head">
      <div>
        <h1>🐛 Bug Hunt</h1>
        <p class="lede">Read the code, then pick what happens. No typing, all thinking.</p>
      </div>
      <div class="scoreboard">
        <div><small>Score</small><b>${arcade.score}</b></div>
        <div><small>Streak</small><b>${arcade.streak}🔥</b></div>
        <div><small>Question</small><b>${arcade.index + 1}/${total}</b></div>
      </div>
    </section>

    <div class="progress-strip" aria-hidden="true"><i style="width:${(arcade.index / total) * 100}%"></i></div>

    <div class="panel arcade-card">
      <span class="pill kind">${esc(question.kind)}</span>
      <pre class="arcade-code"><code>${esc(question.code)}</code></pre>
      <h2>${esc(question.question)}</h2>
      <div class="options">
        ${question.options
          .map((option, index) => {
            let klass = "";
            if (isAnswered) {
              if (index === question.answer) klass = "is-correct";
              else if (index === answered) klass = "is-wrong";
            }
            return `<button class="option ${klass}" data-action="answer" data-index="${index}" ${
              isAnswered ? "disabled" : ""
            }><span class="option-key">${String.fromCharCode(65 + index)}</span>${esc(option)}</button>`;
          })
          .join("")}
      </div>
      ${
        isAnswered
          ? `<div class="verdict ${answered === question.answer ? "good" : "bad"}">
              <b>${answered === question.answer ? "✅ Correct!" : "❌ Not quite."}</b>
              <p>${esc(question.why)}</p>
            </div>
            <button class="btn primary" data-action="next-question">
              ${arcade.index + 1 >= total ? "See my score" : "Next question"} →
            </button>`
          : `<p class="small muted">Pick an answer — you will get an explanation either way.</p>`
      }
    </div>`;
}

export function notFoundView() {
  return `
    <div class="panel center-panel">
      <h1>404 🧭</h1>
      <p class="lede">That trail is not on the map. The troop is still at basecamp.</p>
      <a class="btn primary" href="#/quests">Back to the quest map</a>
    </div>`;
}

export function loadingView() {
  return `
    <div class="center-panel loading">
      <span class="loader">🌀</span>
      <p>Loading the quest map…</p>
    </div>`;
}

export function loadErrorView(message) {
  return `
    <div class="panel center-panel">
      <h1>🚧 The Code Machine is quiet</h1>
      <p class="lede">${esc(message)}</p>
      <button class="btn primary" data-action="retry">Try again ↺</button>
    </div>`;
}
