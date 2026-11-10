const lessons = [
  { title: "A world made of blocks", icon: "🧱", body: "Minecraft is a sandbox: you choose what to build, explore, and discover. The landscape is made of blocks, from dirt and stone to trees and water. <strong>Break blocks to collect materials, then place blocks to shape your world.</strong> Survival asks you to gather supplies and stay alive; Creative gives you free building supplies and flight.", question: "How do you collect your first wood?", answers: ["Break a tree’s log blocks", "Wait for a crafting table to appear", "Place dirt beside water"], correct: 0, tip: "Logs are your first building material. Break a tree’s logs to collect them." },
  { title: "Move, look, and build", icon: "🧭", body: "On the default keyboard controls, <strong>W A S D</strong> moves you, the mouse looks around, and <strong>Space</strong> jumps. Hold Shift to sneak carefully near edges. Hold the left mouse button to break a block; right-click to place a block or use an item. Press E to open your inventory. Number keys 1–9 select your hotbar slots. Controls can be changed in the game settings.", question: "Which default control places a block?", answers: ["E", "Right-click", "Space"], correct: 1, tip: "Right-click places the selected block or uses the item you are holding." },
  { title: "Turn resources into tools", icon: "🪓", body: "Press E and use the inventory’s 2 × 2 crafting grid: <strong>one log makes four planks; four planks make a crafting table.</strong> Place the table and right-click it to use its 3 × 3 grid. Two planks stacked vertically make sticks. Three planks across the top and two sticks down the center make a wooden pickaxe. Mine stone with it, then use cobblestone to craft stronger stone tools.", question: "What unlocks the 3 × 3 crafting grid?", answers: ["A bed", "A chest", "A crafting table"], correct: 2, tip: "A crafting table opens the bigger grid needed for tools such as pickaxes." },
  { title: "Survive your first night", icon: "🌙", body: "In Survival, hearts show your health and drumsticks show hunger. Running and other activities use food; <strong>keep your hunger high to help health regenerate.</strong> Darkness lets many hostile mobs spawn. Before night, build an enclosed shelter and light it with torches. One coal or charcoal above a stick crafts torches. A bed made from three wool over three planks lets you sleep when conditions allow and sets your respawn point when used successfully.", question: "What is a good first-night plan?", answers: ["Explore dark caves without supplies", "Build a shelter, add light, and bring food", "Throw away your wood"], correct: 1, tip: "Shelter, light, and food help keep you safe while you prepare for the next day." },
  { title: "Mine smart, keep your gear", icon: "⛏️", body: "Different blocks need different tools. <strong>Stone pickaxes can collect iron ore; iron pickaxes can collect diamond ore.</strong> A wooden pickaxe will not collect everything it can break. Smelt iron ore in a furnace with fuel to make iron ingots. Tools wear out, so carry spares. Dig a staircase instead of straight down, watch for lava, and store spare resources in a chest: dying can drop your carried items.", question: "Which pickaxe can collect diamond ore?", answers: ["Wooden pickaxe", "Stone pickaxe", "Iron pickaxe"], correct: 2, tip: "Use an iron pickaxe or better to collect diamonds from diamond ore." },
  { title: "Choose your adventure", icon: "🛏️", body: "You are ready to play. In <strong>Loop Troop survival</strong>, gather materials, craft tools, and build your camp. In <strong>Bedwars</strong>, teams usually defend their bed while collecting resources and attacking other teams’ beds. Losing your bed means you can no longer respawn; server rules can vary. Be a good teammate: share supplies, respect builds, and keep personal information private. Finish below to open the world picker. It will be your default on future visits.", question: "What is your bed’s main role in Bedwars?", answers: ["It lets your team respawn while it survives", "It makes all tools unbreakable", "It automatically wins the match"], correct: 0, tip: "Protect your bed: your team’s respawns depend on it." },
];
const key = 'loop-troop-minecraft-course-v1';
const $ = id => document.getElementById(id);
let state = { lesson: 0, completed: false };
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && Number.isInteger(saved.lesson) && saved.lesson >= 0 && saved.lesson < lessons.length && typeof saved.completed === 'boolean') state = saved;
} catch {}
function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); } catch {
    document.querySelector('.course-footer > span').textContent = 'Storage unavailable: progress lasts for this visit.';
  }
}
function render(focus = false) {
  $('course').hidden = state.completed;
  $('pick').hidden = !state.completed;
  if (state.completed) {
    document.title = 'Loop Troop — choose a world';
    if (focus) $('pick').querySelector('button').focus();
    return;
  }
  const lesson = lessons[state.lesson];
  document.title = `Loop Troop — ${lesson.title}`;
  $('lesson-list').replaceChildren(...lessons.map((item, index) => {
    const li = document.createElement('li');
    li.textContent = item.title;
    if (index === state.lesson) li.setAttribute('aria-current', 'step');
    return li;
  }));
  $('lesson-count').textContent = `LESSON ${state.lesson + 1} / ${lessons.length}`;
  $('lesson-progress').value = state.lesson + 1;
  $('lesson-title').textContent = lesson.title;
  $('lesson-icon').textContent = lesson.icon;
  $('lesson-body').innerHTML = lesson.body;
  $('lesson-question').textContent = lesson.question;
  $('lesson-feedback').textContent = '';
  $('lesson-next').disabled = true;
  $('lesson-next').textContent = state.lesson === lessons.length - 1 ? 'Finish & choose a world →' : 'Next lesson →';
  $('lesson-back').disabled = state.lesson === 0;
  $('lesson-answers').replaceChildren(...lesson.answers.map((answer, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = answer;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      for (const option of $('lesson-answers').children) option.setAttribute('aria-pressed', String(option === button));
      const correct = index === lesson.correct;
      $('lesson-feedback').textContent = (correct ? 'Correct! ' : 'Try again. ') + lesson.tip;
      $('lesson-next').disabled = !correct;
    });
    return button;
  }));
  if (focus) $('lesson-title').focus();
}
function resetGame() {
  document.dispatchEvent(new Event('learn:reset-game'));
  if (document.pointerLockElement) document.exitPointerLock?.();
}
function finish() {
  resetGame();
  state.completed = true;
  save();
  render(true);
}
function restart() {
  resetGame();
  state = { lesson: 0, completed: false };
  save();
  render(true);
}
$('lesson-next').addEventListener('click', () => {
  if ($('lesson-next').disabled) return;
  if (state.lesson === lessons.length - 1) return finish();
  state.lesson++;
  save();
  render(true);
});
$('lesson-back').addEventListener('click', () => {
  if (state.lesson === 0) return;
  state.lesson--;
  save();
  render(true);
});
$('course-skip').addEventListener('click', finish);
function shortcut(event) {
  if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key !== 'q' && key !== 'm') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.repeat) return;
  if (key === 'q') restart();
  else finish();
}
window.addEventListener('keydown', shortcut, true);
// The game has its own document, so install the shortcuts there as well.
$('game').addEventListener('load', () => {
  try { $('game').contentWindow.addEventListener('keydown', shortcut, true); } catch {}
});
render();
