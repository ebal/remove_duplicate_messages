"use strict";

// Pure duplicate detection logic, free of any Thunderbird API so that it can
// be unit tested with plain Node (see test/dedupe.test.js).

const RDM_KEY_SEPARATOR = "\u0001";

function rdmHasCriteria(prefs) {
  return Boolean(
    prefs.checkMessageId ||
      prefs.checkDateInSeconds ||
      prefs.checkDate ||
      prefs.checkSubject ||
      prefs.checkAuthor ||
      prefs.checkSize ||
      prefs.checkRecipient ||
      prefs.checkBody
  );
}

// Builds the comparison key of a message (a WebExtension MessageHeader)
// depending on the user configuration. Two messages are duplicates if and
// only if their keys are equal. bodyDigest is only used with checkBody.
function rdmMessageKey(message, prefs, bodyDigest) {
  const parts = [];
  const seconds = Math.floor(new Date(message.date).getTime() / 1000);
  const list = value => (value || []).join(",").replace(/"/g, "");

  if (prefs.checkMessageId) {
    parts.push("i" + (message.headerMessageId || ""));
  }
  if (prefs.checkDateInSeconds) {
    parts.push("t" + seconds);
  }
  if (prefs.checkDate) {
    parts.push("d" + Math.round(seconds / 86400));
  }
  if (prefs.checkSubject) {
    parts.push("s" + (message.subject || "").replace(/"/g, ""));
  }
  if (prefs.checkAuthor) {
    parts.push("a" + (message.author || "").replace(/"/g, ""));
  }
  if (prefs.checkSize) {
    parts.push("z" + message.size);
  }
  if (prefs.checkRecipient) {
    parts.push("r" + list(message.recipients) + RDM_KEY_SEPARATOR + list(message.ccList));
  }
  if (prefs.checkBody) {
    parts.push("b" + bodyDigest);
  }
  return parts.join(RDM_KEY_SEPARATOR);
}

// Index of the message of a group that is kept by default.
function rdmChooseKeeper(group, preferredDelete) {
  let keep = 0;
  switch (Number(preferredDelete)) {
    case 1: {
      // Prefer to delete unread messages: keep a read one, if any.
      const read = group.findIndex(record => record.read);
      keep = read < 0 ? 0 : read;
      break;
    }
    case 2:
      // Prefer to delete smaller messages: keep the largest.
      group.forEach((record, i) => {
        if (record.size > group[keep].size) {
          keep = i;
        }
      });
      break;
    case 3:
      // Prefer to delete larger messages: keep the smallest.
      group.forEach((record, i) => {
        if (record.size < group[keep].size) {
          keep = i;
        }
      });
      break;
  }
  return keep;
}

// records: [{ key, size, read, ... }] in the order the messages were found.
// Returns an array of groups; each group is an array of at least two records
// with the kept message first. Every record gets del / delDefault set.
//
// Like the legacy add-on, "first found" means the messages found first are
// deleted and the one found last is kept.
function rdmGroupDuplicates(records, preferredDelete) {
  const byKey = new Map();
  for (const record of records) {
    const group = byKey.get(record.key);
    if (group) {
      group.push(record);
    } else {
      byKey.set(record.key, [record]);
    }
  }

  const groups = [];
  for (const found of byKey.values()) {
    if (found.length < 2) {
      continue;
    }
    const group = found.reverse();
    const keep = rdmChooseKeeper(group, preferredDelete);
    group.unshift(group.splice(keep, 1)[0]);
    group.forEach((record, i) => {
      record.del = record.delDefault = i > 0;
    });
    groups.push(group);
  }
  return groups;
}

if (typeof module != "undefined") {
  module.exports = { rdmHasCriteria, rdmMessageKey, rdmChooseKeeper, rdmGroupDuplicates };
}
