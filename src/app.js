import { arcadeQuestions } from "./arcade-data.js";
import { burstConfetti, play, setMuted } from "./fx.js";
import * as Progress from "./progress.js";
import {
  arcadeView,
  esc,
  footerView,
  headerView,
  homeView,
  loadErrorView,
  loadingView,
  notFoundView,
  playgroundView,
  questView,
  questsView,
  xpChipMarkup,
} from "./views.js";

const STARTER_PLAYGROUND = `// Welcome to the playground!
// Change anything. Break anything. Press Run.

const snacks = ["pretzel", "mango", "cookie"];

for (const snack of snacks) {
  console.log("I brought a", snack);
}

console.log("Total snacks:", snacks.length);
`;

const SNIPPETS = {
  loop: `const laps = 5;

for (let lap = 1; lap <= laps; lap++) {
  console.log("Lap " + lap + " done!");
}

console.log("Water break 💧");
`,
  fizz: `for (let n = 1; n <= 15; n++) {
  if (n % 15 === 0) console.log("FizzBuzz");
  else if (n % 3 === 0) console.log("Fizz");
  else if (n % 5 === 0) console.log("Buzz");
  else console.log(n);
}
`,
  dice: `function roll(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

for (let i = 0; i < 5; i++) {
  console.log("🎲", roll(6));
}
`,
  pattern: `for (let row = 1; row <= 5; row++) {
  console.log("🛸".repeat(row));
}

console.log("\\nLoop complete!");
`,
};

const state = {
  route: parseRoute(),
  quests: [],
  tracks: [],
  loading: true,
  loadError: null,
  progress: Progress.loadProgress(),
  playCode: STARTER_PLAYGROUND,
  arcade: { index: 0, score: 0, streak: 0, answered: null, done: false },
  running: false,
};

setMuted(state.progress.muted);

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [section, id] = raw.split("/");
  if (section === "quest" && id) return { name: "quest", id };
  if (["quests", "arcade", "playground"].includes(section)) return { name: section };
  return { name: "home" };
}

function questById(id) {
  return state.quests.find((quest) => quest.id === id) || null;
}

function nextQuestId(id) {
  const index = state.quests.findIndex((quest) => quest.id === id);
  return index >= 0 && index < state.quests.length - 1 ? state.quests[index + 1].id : null;
}

async function loadQuests() {
  state.loading = true;
  state.loadError = null;
  render();
  try {
    const response = await fetch("/api/quests", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("The quest map did not arrive.");
    const data = await response.json();
    state.quests = data.quests;
    state.tracks = data.tracks;
  } catch {
    state.loadError = "We could not load the quests. Check your connection and try again.";
  } finally {
    state.loading = false;
    render();
  }
}

function mainView() {
  if (state.loading) return loadingView();
  if (state.loadError) return loadErrorView(state.loadError);
  switch (state.route.name) {
    case "quests":
      return questsView(state);
    case "quest": {
      const quest = questById(state.route.id);
      return quest ? questView(state, quest) : notFoundView();
    }
    case "arcade":
      return arcadeView(state);
    case "playground":
      return playgroundView(state);
    default:
      return homeView(state);
  }
}

function render() {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `${headerView(state)}<main class="main" id="main">${mainView()}</main>${footerView()}`;
  mountEditors();
}

/* ------------------------------- editors -------------------------------- */

let draftTimer = null;

function saveProgressSoon() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => Progress.saveProgress(state.progress), 300);
}

function updateGutters() {
  for (const [editorId, gutterId] of [
    ["editor", "gutter"],
    ["play-editor", "play-gutter"],
  ]) {
    const editor = document.getElementById(editorId);
    const gutter = document.getElementById(gutterId);
    if (editor && gutter) {
      gutter.textContent = editor.value
        .split("\n")
        .map((_, index) => index + 1)
        .join("\n");
    }
  }
}

function mountEditors() {
  const questEditor = document.getElementById("editor");
  if (questEditor) {
    questEditor.addEventListener("input", () => {
      updateGutters();
      if (state.route.name !== "quest") return;
      state.progress.drafts[state.route.id] = questEditor.value;
      saveProgressSoon();
    });
    questEditor.addEventListener("keydown", editorKeys);
  }

  const playEditor = document.getElementById("play-editor");
  if (playEditor) {
    state.playCode = playEditor.value;
    playEditor.addEventListener("input", () => {
      state.playCode = playEditor.value;
      updateGutters();
    });
    playEditor.addEventListener("keydown", editorKeys);
  }
  updateGutters();
}

function editorKeys(event) {
  if (event.key === "Tab") {
    event.preventDefault();
    const area = event.target;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    area.value = `${area.value.slice(0, start)}  ${area.value.slice(end)}`;
    area.selectionStart = area.selectionEnd = start + 2;
    area.dispatchEvent(new Event("input"));
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    if (event.target.id === "editor") runQuest();
    else runPlayground();
  }
}

/* -------------------------------- running -------------------------------- */

async function postRun(payload) {
  let response;
  try {
    response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Could not reach the Code Machine. Check your connection and press run again.");
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new Error("The Code Machine sent back something strange. Try once more.");
  }
  if (!response.ok) throw new Error(data.error || "The Code Machine hit a snag.");
  return data;
}

function setBusy(isBusy, kind) {
  const button = document.querySelector(kind === "play" ? '[data-action="run-play"]' : '[data-action="run-quest"]');
  const status = document.getElementById(kind === "play" ? "play-status" : "run-status");
  if (button) {
    button.disabled = isBusy;
    button.textContent = isBusy ? "Running…" : kind === "play" ? "▶ Run it" : "▶ Run my code";
  }
  if (status && isBusy) status.textContent = "Sending your code…";
}

function pendingMarkup() {
  return `<div class="pending"><span class="loader">🌀</span><p>Sending your code to the Code Machine…</p></div>`;
}

function errorMarkup(message) {
  return `<div class="banner banner-warn"><b>⚠️ Hmm.</b><p>${esc(message)}</p></div>`;
}

function consoleMarkup(logs) {
  if (!logs || !logs.length) {
    return `<p class="small muted">Nothing printed. Use <code>console.log(...)</code> to see what your code is doing.</p>`;
  }
  return `<pre class="console-out">${logs
    .map((line) => `<span>${esc(line) || "&nbsp;"}</span>`)
    .join("")}</pre>`;
}

function checksMarkup(results) {
  if (!results || !results.length) return "";
  const allPass = results.every((result) => result.pass);
  return `
    <div class="result-block">
      <h3>${allPass ? "Every check passed 🎉" : "Checks"}</h3>
      <ul class="checks result-checks">
        ${results
          .map(
            (result) => `
          <li class="${result.pass ? "pass" : "fail"}">
            <span class="mark" aria-hidden="true">${result.pass ? "✓" : "✗"}</span>
            <span>${esc(result.description)}${result.note ? `<small>${esc(result.note)}</small>` : ""}</span>
          </li>`,
          )
          .join("")}
      </ul>
    </div>`;
}

function resultMarkup(data, quest) {
  if (!data.ok) {
    return `${errorMarkup(data.error || "Something in your code stopped it.")}
      ${data.logs && data.logs.length ? `<div class="result-block"><h3>Printed before it stopped</h3>${consoleMarkup(data.logs)}</div>` : ""}
      <p class="small muted">Read the last line of your code that ran, then check the one right after it.</p>`;
  }
  return `
    ${data.passed && quest ? successMarkup(quest) : ""}
    <div class="result-block"><h3>What your code printed</h3>${consoleMarkup(data.logs)}</div>
    ${checksMarkup(data.results)}
    ${
      quest && !data.passed
        ? `<p class="small muted">Fix one check at a time. The checks above are the same list as the mission panel.</p>`
        : ""
    }`;
}

function successMarkup(quest) {
  const next = nextQuestId(quest.id);
  return `
    <div class="success-banner">
      <span class="success-emoji" aria-hidden="true">🎉</span>
      <div class="success-text">
        <b>Quest cleared! +${quest.xp} XP</b>
        <small>Your code passed every check. Nicely done.</small>
      </div>
      <a class="btn primary" href="${next ? `#/quest/${next}` : "#/quests"}">
        ${next ? "Next quest" : "Back to the map"} →
      </a>
    </div>`;
}

function showToast(message) {
  document.querySelectorAll(".toast").forEach((toast) => toast.remove());
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("is-leaving"), 2800);
  setTimeout(() => toast.remove(), 3400);
}

async function runQuest() {
  if (state.running || state.route.name !== "quest") return;
  const quest = questById(state.route.id);
  const editor = document.getElementById("editor");
  const box = document.getElementById("results");
  if (!quest || !editor || !box) return;
  if (!editor.value.trim()) {
    box.innerHTML = errorMarkup("The editor is empty. Start with a console.log() and see what happens.");
    return;
  }

  state.running = true;
  setBusy(true, "quest");
  box.innerHTML = pendingMarkup();

  const alreadyDone = Boolean(state.progress.done[quest.id]);
  const xpBefore = Progress.xpFor(state.quests, state.progress);
  const levelBefore = Progress.levelFor(xpBefore);

  try {
    const data = await postRun({ code: editor.value, questId: quest.id });
    box.innerHTML = resultMarkup(data, quest);
    const status = document.getElementById("run-status");
    if (status) {
      status.textContent = data.passed
        ? "All checks passed"
        : data.ok
          ? "Some checks still need work"
          : "Your code stopped early";
    }

    if (data.passed) {
      if (!alreadyDone) {
        state.progress.done[quest.id] = true;
        Progress.saveProgress(state.progress);
        const xpAfter = Progress.xpFor(state.quests, state.progress);
        const levelAfter = Progress.levelFor(xpAfter);
        const chip = document.getElementById("xp-chip");
        if (chip) chip.innerHTML = xpChipMarkup(state);
        burstConfetti(48);
        if (levelAfter.title !== levelBefore.title) {
          setTimeout(() => {
            play("level");
            showToast(`${levelAfter.emoji} Level up: ${levelAfter.title}!`);
          }, 500);
        } else {
          showToast(`+${quest.xp} XP · ${xpAfter} total`);
        }
      }
      play("win");
    } else {
      play(data.ok ? "tap" : "nope");
    }
  } catch (error) {
    box.innerHTML = errorMarkup(error.message);
    play("nope");
  } finally {
    state.running = false;
    setBusy(false, "quest");
  }
}

async function runPlayground() {
  if (state.running) return;
  const editor = document.getElementById("play-editor");
  const box = document.getElementById("play-results");
  if (!editor || !box) return;
  if (!editor.value.trim()) {
    box.innerHTML = errorMarkup("Write a line or two first — or grab a snippet above.");
    return;
  }

  state.running = true;
  setBusy(true, "play");
  box.innerHTML = pendingMarkup();

  try {
    const data = await postRun({ code: editor.value });
    box.innerHTML = data.ok
      ? `<div class="banner banner-good"><b>✅ Ran just fine.</b> <span class="small">Nothing is graded here.</span></div>
         <div class="result-block"><h3>Console</h3>${consoleMarkup(data.logs)}</div>`
      : errorMarkup(data.error || "Your code stopped early.");
    const status = document.getElementById("play-status");
    if (status) status.textContent = data.ok ? "Ran without errors" : "Stopped with an error";

    const firstRun = state.progress.playgroundRuns === 0;
    state.progress.playgroundRuns += 1;
    Progress.saveProgress(state.progress);
    if (firstRun) showToast("🧪 Badge unlocked: Tinkerer");
    play(data.ok ? "tap" : "nope");
  } catch (error) {
    box.innerHTML = errorMarkup(error.message);
  } finally {
    state.running = false;
    setBusy(false, "play");
  }
}

function resetQuest() {
  if (state.route.name !== "quest") return;
  const quest = questById(state.route.id);
  if (!quest) return;
  delete state.progress.drafts[quest.id];
  Progress.saveProgress(state.progress);
  const editor = document.getElementById("editor");
  if (editor) {
    editor.value = quest.starter;
    editor.focus();
    updateGutters();
  }
  const box = document.getElementById("results");
  if (box) box.innerHTML = "";
  const status = document.getElementById("run-status");
  if (status) status.textContent = "Not run yet";
  play("tap");
}

/* -------------------------------- arcade -------------------------------- */

function answerArcade(index) {
  if (state.arcade.answered !== null || state.arcade.done) return;
  const question = arcadeQuestions[state.arcade.index];
  const correct = index === question.answer;
  state.arcade.answered = index;
  if (correct) {
    state.arcade.score += 1;
    state.arcade.streak += 1;
    play("tap");
  } else {
    state.arcade.streak = 0;
    play("nope");
  }
  if (state.arcade.score > state.progress.arcadeBest) {
    state.progress.arcadeBest = state.arcade.score;
    Progress.saveProgress(state.progress);
  }
  const scroll = window.scrollY;
  render();
  window.scrollTo(0, Math.max(0, scroll));
}

function nextArcade() {
  if (state.arcade.answered === null) return;
  const scroll = window.scrollY;
  if (state.arcade.index + 1 >= arcadeQuestions.length) {
    state.arcade.done = true;
    state.progress.arcadeBest = Math.max(state.progress.arcadeBest, state.arcade.score);
    Progress.saveProgress(state.progress);
    if (state.progress.arcadeBest >= 8) burstConfetti(40);
  } else {
    state.arcade.index += 1;
    state.arcade.answered = null;
  }
  render();
  window.scrollTo(0, Math.max(0, scroll));
}

function restartArcade() {
  state.arcade = { index: 0, score: 0, streak: 0, answered: null, done: false };
  render();
  window.scrollTo(0, 0);
}

/* ------------------------------- wiring --------------------------------- */

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  const action = trigger.dataset.action;

  switch (action) {
    case "run-quest":
      runQuest();
      break;
    case "run-play":
      runPlayground();
      break;
    case "reset-quest":
      resetQuest();
      break;
    case "snippet": {
      const snippet = SNIPPETS[trigger.dataset.snippet];
      const editor = document.getElementById("play-editor");
      if (snippet && editor) {
        editor.value = snippet;
        state.playCode = snippet;
        updateGutters();
        editor.focus();
        play("tap");
      }
      break;
    }
    case "answer":
      answerArcade(Number(trigger.dataset.index));
      break;
    case "next-question":
      nextArcade();
      break;
    case "restart-arcade":
      restartArcade();
      break;
    case "mute": {
      state.progress.muted = !state.progress.muted;
      setMuted(state.progress.muted);
      Progress.saveProgress(state.progress);
      trigger.textContent = state.progress.muted ? "🔇" : "🔊";
      trigger.setAttribute("aria-pressed", String(!state.progress.muted));
      break;
    }
    case "retry":
      loadQuests();
      break;
    default:
      break;
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "crew-name") return;
  state.progress.name = event.target.value.slice(0, 18);
  saveProgressSoon();
});

document.addEventListener("change", (event) => {
  if (event.target.id === "crew-name") Progress.saveProgress(state.progress);
});

window.addEventListener("hashchange", () => {
  state.route = parseRoute();
  render();
  window.scrollTo(0, 0);
});

loadQuests();
