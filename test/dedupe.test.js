"use strict";

const assert = require("node:assert");
const { test } = require("node:test");
const {
  rdmHasCriteria,
  rdmMessageKey,
  rdmGroupDuplicates,
} = require("../src/common/dedupe.js");

const DEFAULTS = {
  checkMessageId: true,
  checkDateInSeconds: true,
  checkSubject: true,
  checkAuthor: true,
};

function message(overrides = {}) {
  return {
    headerMessageId: "a@example.org",
    date: new Date("2024-05-01T10:00:00Z"),
    subject: "Hello",
    author: "Alice <alice@example.org>",
    recipients: ["bob@example.org"],
    ccList: [],
    size: 1000,
    ...overrides,
  };
}

function records(list) {
  return list.map((r, i) => ({ id: i + 1, key: "k", size: 100, read: false, ...r }));
}

test("no criteria is detected", () => {
  assert.equal(rdmHasCriteria({}), false);
  assert.equal(rdmHasCriteria({ checkBody: true }), true);
});

test("identical messages share a key, different ones do not", () => {
  assert.equal(rdmMessageKey(message(), DEFAULTS), rdmMessageKey(message(), DEFAULTS));
  for (const change of [
    { headerMessageId: "b@example.org" },
    { subject: "Hello!" },
    { author: "Bob <bob@example.org>" },
    { date: new Date("2024-05-01T10:00:01Z") },
  ]) {
    assert.notEqual(rdmMessageKey(message(change), DEFAULTS), rdmMessageKey(message(), DEFAULTS));
  }
});

test("disabled criteria are ignored", () => {
  const prefs = { checkMessageId: true };
  assert.equal(
    rdmMessageKey(message({ subject: "x", size: 5 }), prefs),
    rdmMessageKey(message(), prefs)
  );
});

test("fields cannot bleed into each other", () => {
  const prefs = { checkSubject: true, checkAuthor: true };
  assert.notEqual(
    rdmMessageKey(message({ subject: "ab", author: "c" }), prefs),
    rdmMessageKey(message({ subject: "a", author: "bc" }), prefs)
  );
});

test("compare date only looks at the day", () => {
  const prefs = { checkDate: true };
  assert.equal(
    rdmMessageKey(message({ date: new Date("2024-05-01T13:00:00Z") }), prefs),
    rdmMessageKey(message({ date: new Date("2024-05-01T20:00:00Z") }), prefs)
  );
  assert.notEqual(
    rdmMessageKey(message({ date: new Date("2024-05-03T13:00:00Z") }), prefs),
    rdmMessageKey(message(), prefs)
  );
});

test("size, recipients and body are part of the key when enabled", () => {
  assert.notEqual(
    rdmMessageKey(message({ size: 1 }), { checkSize: true }),
    rdmMessageKey(message(), { checkSize: true })
  );
  assert.notEqual(
    rdmMessageKey(message({ recipients: ["x@example.org"] }), { checkRecipient: true }),
    rdmMessageKey(message(), { checkRecipient: true })
  );
  assert.notEqual(
    rdmMessageKey(message(), { checkBody: true }, "d1"),
    rdmMessageKey(message(), { checkBody: true }, "d2")
  );
});

test("unique messages are never reported", () => {
  const groups = rdmGroupDuplicates(records([{ key: "a" }, { key: "b" }, { key: "c" }]), 0);
  assert.deepEqual(groups, []);
});

test("exactly one message per group is kept", () => {
  for (const preferred of [0, 1, 2, 3]) {
    const groups = rdmGroupDuplicates(
      records([
        { key: "a", size: 1 },
        { key: "b" },
        { key: "a", size: 3, read: true },
        { key: "a", size: 2 },
        { key: "c" },
        { key: "c" },
      ]),
      preferred
    );
    assert.equal(groups.length, 2);
    for (const group of groups) {
      assert.equal(group.filter(r => !r.del).length, 1);
      assert.equal(group[0].del, false);
      assert.ok(group.every(r => r.del === r.delDefault));
    }
    assert.deepEqual(groups.map(g => g.length).sort(), [2, 3]);
  }
});

test("first found: the first found are deleted, the last found is kept", () => {
  const [group] = rdmGroupDuplicates(records([{}, {}, {}]), 0);
  assert.deepEqual(group.map(r => [r.id, r.del]), [[3, false], [2, true], [1, true]]);
});

test("unread: a read message is kept", () => {
  const [group] = rdmGroupDuplicates(records([{ read: true }, {}, {}]), 1);
  assert.equal(group.find(r => !r.del).id, 1);
  const [allUnread] = rdmGroupDuplicates(records([{}, {}]), 1);
  assert.equal(allUnread.find(r => !r.del).id, 2);
});

test("smaller / larger", () => {
  const list = () => records([{ size: 5 }, { size: 9 }, { size: 1 }]);
  assert.equal(rdmGroupDuplicates(list(), 2)[0].find(r => !r.del).id, 2);
  assert.equal(rdmGroupDuplicates(list(), 3)[0].find(r => !r.del).id, 3);
});
