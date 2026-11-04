import { test } from "node:test";
import assert from "node:assert/strict";
import {
  arcadeView,
  esc,
  headerView,
  homeView,
  loadErrorView,
  loadingView,
  notFoundView,
  playgroundView,
  questView,
  questsView,
} from "./helpers/render.js";

const quest = {
  id: "hello",
  track: "basecamp",
  title: "Say hello",
  emoji: "👋",
  level: "Start here",
  xp: 20,
  story: "A story",
  concept: "A concept",
  prompt: "A prompt",
  starter: 'console.log("");',
  hints: ["hint one", "hint two"],
  solution: 'console.log("hi");',
  testCount: 2,
  testList: ["first check", "second check"],
};

function freshState() {
  return {
    route: { name: "home" },
    quests: [quest],
    tracks: [{ id: "basecamp", name: "Brightwood Basecamp", emoji: "🏕️", blurb: "Blurb", color: "violet" }],
    progress: { name: "Sam", done: {}, drafts: {}, arcadeBest: 0, playgroundRuns: 0, muted: false },
    arcade: { index: 0, score: 0, streak: 0, answered: null, done: false },
    playCode: "console.log(1);",
  };
}

test("every screen renders without throwing or leaking undefined", () => {
  const state = freshState();
  const screens = {
    header: headerView(state),
    home: homeView(state),
    quests: questsView(state),
    quest: questView(state, quest),
    arcade: arcadeView(state),
    playground: playgroundView(state),
    notFound: notFoundView(),
    loading: loadingView(),
    loadError: loadErrorView("No connection"),
  };

  for (const [name, html] of Object.entries(screens)) {
    assert.equal(typeof html, "string", `${name} should return a string`);
    assert.ok(html.length > 120, `${name} looks too small`);
    assert.ok(!html.includes("undefined"), `${name} rendered the word undefined`);
  }
});

test("progress is reflected in the header and home screen", () => {
  const state = freshState();
  state.progress.done = { hello: true };
  state.progress.arcadeBest = 9;
  const header = headerView(state);
  assert.match(header, /20 XP/);
  assert.match(header, /1\/1/);
  const home = homeView(state);
  assert.match(home, /Quests cleared/);
  assert.match(home, /1<em>\/1<\/em>/);
  assert.match(home, /is-earned/);
  assert.match(home, /Basecamp Boss/);
});

test("arcade renders the question, the answer state and the final score", () => {
  const state = freshState();
  const question = arcadeView(state);
  assert.match(question, /data-action="answer"/);
  assert.match(question, /What prints\?/);

  state.arcade.answered = 0;
  const answered = arcadeView(state);
  assert.match(answered, /is-correct|is-wrong/);
  assert.match(answered, /Next question/);

  state.arcade = { index: 0, score: 7, streak: 3, answered: null, done: true };
  const finished = arcadeView(state);
  assert.match(finished, /7<small>\/10/);
  assert.match(finished, /Play again/);
});

test("camper code is escaped before it reaches the page", () => {
  const state = freshState();
  state.progress.drafts = { hello: '</textarea><script>alert(1)</script>' };
  const html = questView(state, quest);
  assert.ok(!html.includes("<script>"), "raw script tag should not survive");
  assert.ok(html.includes("&lt;/textarea&gt;"));
  assert.equal(esc('<b>"x"</b>'), "&lt;b&gt;&quot;x&quot;&lt;/b&gt;");
});
