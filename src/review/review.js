"use strict";

const DELETE_CHUNK = 100;
const RENDER_CHUNK = 200;

const $ = id => document.getElementById(id);
const msg = (name, ...args) => browser.i18n.getMessage(name, args.map(String));

let prefs;
let groups = [];
let cancelled = false;
let busy = true;
let folderErrors = 0;
let renderGeneration = 0;
const accountNames = new Map();

function debug(...args) {
  if (prefs && prefs.debugInfo) {
    console.log("Remove Duplicate Messages:", ...args);
  }
}

function setStatus(text) {
  $("status").textContent = text;
}

function setProgress(value, max) {
  $("progress").max = Math.max(max, 1);
  $("progress").value = Math.min(value, Math.max(max, 1));
}

function setButtons(enabled) {
  for (const id of ["buttonDefault", "buttonSelDel", "buttonSelKeep", "buttonDelete"]) {
    $(id).disabled = !enabled;
  }
}

function finish(text) {
  busy = false;
  setButtons(false);
  $("progress").hidden = true;
  $("hint").hidden = true;
  $("buttonCancel").textContent = msg("buttonClose");
  $("buttonCancel").title = "";
  setStatus(text);
}

function folderLabel(folder) {
  const account = accountNames.get(folder.accountId);
  return (account ? account + ": " : "") + (folder.path || folder.name || "");
}

// --- Phase 1: find all folders we want to search ---------------------------

async function buildFolderList(folder, list, seen) {
  if (!folder || seen.has(folder.id)) {
    return;
  }
  seen.add(folder.id);

  const use = folder.specialUse || [];
  if (prefs.excludeTrash && use.includes("trash")) {
    return;
  }
  if (prefs.excludeSent && use.includes("sent")) {
    return;
  }
  if (prefs.excludeAllMail && use.includes("all")) {
    return;
  }

  // Virtual (saved search, unified, tag) folders only show messages that live
  // in real folders, the account root holds no messages at all.
  const searchable = !folder.isRoot && !folder.isVirtual && !folder.isUnified && !folder.isTag;

  if (searchable && !prefs.subFolderFirst) {
    list.push(folder);
  }
  let subFolders = [];
  try {
    subFolders = await browser.folders.getSubFolders(folder.id, false);
  } catch (e) {
    console.error("Remove Duplicate Messages: cannot list subfolders of", folder.path, e);
  }
  for (const subFolder of subFolders) {
    await buildFolderList(subFolder, list, seen);
  }
  if (searchable && prefs.subFolderFirst) {
    list.push(folder);
  }
}

// --- Phase 2: collect the messages of all folders --------------------------

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

// Digest of all text parts plus the names of the attachments. A message whose
// content cannot be read gets a unique digest, so it is never a duplicate.
async function bodyDigest(message) {
  try {
    const full = await browser.messages.getFull(message.id);
    const chunks = [];
    const walk = part => {
      if (typeof part.body == "string") {
        chunks.push(part.body);
      } else if (part.name) {
        chunks.push(part.contentType + "/" + part.name);
      }
      for (const child of part.parts || []) {
        walk(child);
      }
    };
    walk(full);
    return await sha256(chunks.join("\u0001"));
  } catch (e) {
    console.error("Remove Duplicate Messages: cannot read message", message.id, e);
    return "unreadable-" + message.id;
  }
}

async function scanFolder(folder, records, seenIds, counter) {
  const label = folderLabel(folder);
  let page = await browser.messages.list(folder.id);
  for (;;) {
    for (const message of page.messages) {
      if (cancelled) {
        break;
      }
      counter.done++;
      if (seenIds.has(message.id)) {
        continue;
      }
      seenIds.add(message.id);
      const digest = prefs.checkBody ? await bodyDigest(message) : "";
      records.push({
        id: message.id,
        key: rdmMessageKey(message, prefs, digest),
        size: message.size || 0,
        read: Boolean(message.read),
        author: message.author || "",
        recipients: (message.recipients || []).join(", "),
        subject: message.subject || "",
        date: message.date,
        folder: label,
      });
      if (prefs.checkBody && counter.done % 10 == 0) {
        setProgress(counter.done, counter.total);
        setStatus(msg("statusSearching", counter.done, counter.total));
      }
    }
    setProgress(counter.done, counter.total);
    setStatus(
      msg("statusSearching", counter.done, Math.max(counter.total, counter.done)) +
        " — " +
        msg("statusScanningFolder", label)
    );
    if (cancelled) {
      if (page.id) {
        await browser.messages.abortList(page.id).catch(() => {});
      }
      return;
    }
    if (!page.id) {
      return;
    }
    page = await browser.messages.continueList(page.id);
  }
}

async function scan(folderIds) {
  setStatus(msg("statusCollecting"));

  for (const account of await browser.accounts.list(false)) {
    accountNames.set(account.id, account.name);
  }

  const folders = [];
  const seen = new Set();
  for (const id of folderIds) {
    try {
      await buildFolderList(await browser.folders.get(id, false), folders, seen);
    } catch (e) {
      folderErrors++;
      console.error("Remove Duplicate Messages: cannot access folder", id, e);
    }
  }
  if (prefs.reverseSearch) {
    folders.reverse();
  }
  debug("folders to search", folders.map(folderLabel));

  const counter = { done: 0, total: 0 };
  for (const folder of folders) {
    try {
      const info = await browser.folders.getFolderInfo(folder.id);
      counter.total += info.totalMessageCount || 0;
    } catch (e) {
      // Only needed for the progress bar.
    }
  }

  const records = [];
  const seenIds = new Set();
  for (const folder of folders) {
    if (cancelled) {
      break;
    }
    try {
      await scanFolder(folder, records, seenIds, counter);
    } catch (e) {
      // If we could not process the folder, we proceed with the next one.
      folderErrors++;
      console.error("Remove Duplicate Messages: cannot read folder", folder.path, e);
    }
  }
  return { folders, records };
}

// --- Phase 3: review -------------------------------------------------------

function countToDelete() {
  let n = 0;
  for (const group of groups) {
    for (const record of group) {
      if (record.del) {
        n++;
      }
    }
  }
  return n;
}

function updateSummary() {
  const total = groups.reduce((sum, group) => sum + group.length, 0);
  $("groupsInfo").textContent = msg("statusGroups", groups.length, total);
  $("toDelete").textContent = msg("statusToDelete", countToDelete());
}

function updateRow(row, record) {
  row.classList.toggle("del", record.del);
  row.querySelector("button.flag").textContent = msg(record.del ? "flagDel" : "flagKeep");
}

function makeRow(record) {
  const row = document.createElement("tr");
  const cell = (text, className) => {
    const td = document.createElement("td");
    td.textContent = text;
    td.title = text;
    if (className) {
      td.className = className;
    }
    row.append(td);
    return td;
  };

  const flag = document.createElement("button");
  flag.className = "flag";
  flag.addEventListener("click", () => {
    if (busy) {
      return;
    }
    record.del = !record.del;
    updateRow(row, record);
    updateSummary();
  });
  cell("").append(flag);

  cell(record.author);
  cell(record.recipients, "recipient");

  const subject = document.createElement("a");
  subject.className = "subject";
  subject.textContent = record.subject || "—";
  subject.addEventListener("click", () => {
    browser.messageDisplay
      .open({ messageId: record.id, location: "tab" })
      .catch(e => console.error("Remove Duplicate Messages: cannot open message", e));
  });
  const subjectCell = cell("");
  subjectCell.title = record.subject;
  subjectCell.append(subject);

  cell(record.folder);
  cell(record.date ? new Date(record.date).toLocaleString() : "");
  cell(String(record.size));

  updateRow(row, record);
  return row;
}

// Renders the table in slices to keep the window responsive.
async function render() {
  const generation = ++renderGeneration;
  const table = $("messages");
  for (const body of Array.from(table.tBodies)) {
    body.remove();
  }
  table.hidden = false;
  setButtons(false);

  for (let i = 0; i < groups.length; i++) {
    const body = document.createElement("tbody");
    for (const record of groups[i]) {
      body.append(makeRow(record));
    }
    table.append(body);
    if (i % RENDER_CHUNK == RENDER_CHUNK - 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (generation != renderGeneration) {
        return;
      }
    }
  }
  updateSummary();
  setButtons(!busy);
}

function setAll(value) {
  for (const group of groups) {
    for (const record of group) {
      record.del = value === undefined ? record.delDefault : value;
    }
  }
  render();
}

function confirmDelete(count) {
  return new Promise(resolve => {
    const dialog = $("confirm");
    $("confirmText").textContent = msg("confirmDelete", count);
    $("confirmYes").onclick = () => dialog.close("yes");
    $("confirmNo").onclick = () => dialog.close("no");
    dialog.addEventListener("close", () => resolve(dialog.returnValue == "yes"), { once: true });
    dialog.returnValue = "no";
    dialog.showModal();
  });
}

// --- Phase 4: delete -------------------------------------------------------

async function deleteMarked() {
  const ids = [];
  for (const group of groups) {
    for (const record of group) {
      if (record.del) {
        ids.push(record.id);
      }
    }
  }
  if (!ids.length || !(await confirmDelete(ids.length))) {
    return;
  }

  busy = true;
  cancelled = false;
  setButtons(false);
  $("progress").hidden = false;

  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < ids.length && !cancelled; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    setProgress(i, ids.length);
    setStatus(msg("statusDeleting", i, ids.length));
    try {
      // skipTrash = false: the messages are moved to the trash folder.
      await browser.messages.delete(chunk, false);
      deleted += chunk.length;
    } catch (e) {
      failed += chunk.length;
      console.error("Remove Duplicate Messages: delete failed", e);
    }
  }
  debug("deleted", deleted, "failed", failed);

  $("messages").hidden = true;
  $("summary").hidden = true;
  finish(msg("statusDeleted", deleted));
  if (failed) {
    showWarning(msg("statusDeleteErrors", failed));
  }
}

function showWarning(text) {
  $("warning").textContent = text;
  $("warning").hidden = false;
}

// --- Start -----------------------------------------------------------------

async function closeWindow() {
  try {
    const current = await browser.windows.getCurrent();
    await browser.windows.remove(current.id);
  } catch (e) {
    window.close();
  }
}

async function main() {
  rdmLocalizeDocument();
  prefs = await rdmLoadPrefs();
  document.body.classList.toggle("show-recipient", prefs.checkRecipient);

  $("buttonCancel").addEventListener("click", () => {
    if (busy && !cancelled) {
      cancelled = true;
    } else {
      closeWindow();
    }
  });
  $("buttonOptions").addEventListener("click", () => browser.runtime.openOptionsPage());
  $("buttonDefault").addEventListener("click", () => setAll());
  $("buttonSelDel").addEventListener("click", () => setAll(true));
  $("buttonSelKeep").addEventListener("click", () => setAll(false));
  $("buttonDelete").addEventListener("click", deleteMarked);

  if (!rdmHasCriteria(prefs)) {
    finish(msg("errorNoCriteria"));
    return;
  }

  let folderIds = [];
  try {
    folderIds = JSON.parse(decodeURIComponent(location.hash.slice(1)));
  } catch (e) {
    console.error("Remove Duplicate Messages: bad folder list", e);
  }

  const { folders, records } = await scan(folderIds);
  if (folderErrors) {
    showWarning(msg("statusFolderErrors", folderErrors));
  }
  if (cancelled) {
    finish(msg("statusCancelled"));
    return;
  }
  if (!folders.length) {
    finish(msg("errorNoFolders"));
    return;
  }

  groups = rdmGroupDuplicates(records, prefs.preferredDelete);
  debug("messages", records.length, "duplicate groups", groups.length);
  if (!groups.length) {
    finish(msg("statusNoDuplicates"));
    return;
  }

  busy = false;
  $("progress").hidden = true;
  setStatus("");
  if (prefs.autodelete) {
    // Skips the review, but still asks for confirmation like the legacy
    // add-on did. If it is declined, the manual review is shown instead.
    updateSummary();
    await deleteMarked();
    if ($("summary").hidden) {
      return;
    }
  }
  await render();
}

main().catch(e => {
  console.error("Remove Duplicate Messages:", e);
  finish(String(e));
});
