import test from "node:test";
import assert from "node:assert/strict";
import { checkPassword, hasUnlock, isConfigured, readCookie, setUnlockCookie } from "../lib/gate.js";

const withPassword = (password, run) => {
  const previous = process.env.LEARN_PASSWORD;
  process.env.LEARN_PASSWORD = password;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.LEARN_PASSWORD;
    else process.env.LEARN_PASSWORD = previous;
  }
};

const fakeRes = () => {
  const headers = {};
  return {
    headers,
    setHeader(key, value) {
      headers[key.toLowerCase()] = value;
    },
  };
};

test("nothing unlocks until a password is configured", () => {
  withPassword("", () => {
    assert.equal(isConfigured(), false);
    assert.equal(checkPassword("anything"), false);
    assert.equal(hasUnlock({ headers: {} }), false);
  });
});

test("only the exact configured password unlocks", () => {
  withPassword("WakeUpMyDev123", () => {
    assert.equal(checkPassword("WakeUpMyDev123"), true);
    assert.equal(checkPassword("wakeupmydev123"), false);
    assert.equal(checkPassword(" WakeUpMyDev123"), false);
    assert.equal(checkPassword(""), false);
    assert.equal(checkPassword(undefined), false);
  });
});

test("the unlock cookie is HttpOnly and stops working when the password changes", () => {
  withPassword("WakeUpMyDev123", () => {
    const res = fakeRes();
    setUnlockCookie(res);
    const header = res.headers["set-cookie"];
    assert.match(header, /HttpOnly/);
    const cookie = header.split(";")[0];

    assert.equal(hasUnlock({ headers: { cookie } }), true);
    assert.equal(hasUnlock({ headers: { cookie: `${cookie}extra` } }), false);
    assert.equal(hasUnlock({ headers: {} }), false);

    withPassword("aDifferentPassword", () => {
      assert.equal(hasUnlock({ headers: { cookie } }), false);
    });
  });
});

test("cookies are read from a realistic header", () => {
  const req = { headers: { cookie: "a=1; lt_unlock=abc123; theme=dark" } };
  assert.equal(readCookie(req, "lt_unlock"), "abc123");
  assert.equal(readCookie(req, "missing"), "");
  assert.equal(readCookie({ headers: {} }, "lt_unlock"), "");
});
