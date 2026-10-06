#!/usr/bin/env node
// Converts the legacy XUL locale files (DTD + .properties) of
// Remove Duplicate Messages 0.1.14 into WebExtension _locales/*/messages.json.
//
// The legacy files contain several appended revisions of every string; the
// last definition wins, exactly as it did for the XUL parser. Strings that
// were never translated (identical to en-US) or whose placeholders do not
// match en-US are dropped, so Thunderbird falls back to the default locale.
//
// Usage: node tools/convert-locales.js legacy/locale src/_locales
"use strict";

const fs = require("fs");
const path = require("path");

const LOCALES = {
  "en-US": "en",
  "de-DE": "de",
  "de-LU": "lb",
  "es-ES": "es",
  "fr-FR": "fr",
  "it-IT": "it",
  "ja-JP": "ja",
  "nl-NL": "nl",
  "pt-BR": "pt_BR",
  "ru-RU": "ru",
  "ua-UA": "uk",
};

// legacy key -> new message name
const KEYS = {
  "removeduplicates.title": "extensionName",
  "removeduplicates.description": "extensionDescription",
  "removeduplicates.popupmenuname": "menuLabel",
  "removeduplicatesPrefs.title": "optionsTitle",
  "removeduplicatesPrefs.descsettings": "optionsCompareLegend",
  "removeduplicatesPrefs.captionsettings": "optionsSettingsLegend",
  "removeduplicatesPrefs.compmessageid": "prefCheckMessageId",
  "removeduplicatesPrefs.compdateinseconds": "prefCheckDateInSeconds",
  "removeduplicatesPrefs.compdate": "prefCheckDate",
  "removeduplicatesPrefs.compsubject": "prefCheckSubject",
  "removeduplicatesPrefs.compauthor": "prefCheckAuthor",
  "removeduplicatesPrefs.compbody": "prefCheckBody",
  "removeduplicatesPrefs.comprecipient": "prefCheckRecipient",
  "removeduplicatesPrefs.reversesearch": "prefReverseSearch",
  "removeduplicatesPrefs.preferetodelete": "prefPreferredDelete",
  "removeduplicatesPrefs.firstfound": "preferFirstFound",
  "removeduplicatesPrefs.unreadmail": "preferUnread",
  "removeduplicatesPrefs.smallmail": "preferSmaller",
  "removeduplicatesPrefs.largemail": "preferLarger",
  "removeduplicatesPrefs.email": "prefPreferredDeleteSuffix",
  "removeduplicatesPrefs.checksubfolderfirst": "prefSubFolderFirst",
  "removeduplicatesPrefs.autodelete": "prefAutodelete",
  "removeduplicatesPrefs.excludeTrashcan": "prefExcludeTrash",
  "removeduplicatesPrefs.excludeSentfolder": "prefExcludeSent",
  "removeduplicatesPrefs.printdebuginfo": "prefDebugInfo",
  "showduplicatemessages.title": "reviewTitle",
  "showduplicatemessages.caption": "reviewCaption",
  "showduplicatemessages.flag": "colFlag",
  "showduplicatemessages.subject": "colSubject",
  "showduplicatemessages.sender": "colSender",
  "showduplicatemessages.recipient": "colRecipient",
  "showduplicatemessages.folder": "colFolder",
  "showduplicatemessages.date": "colDate",
  "showduplicatemessages.buttonDefault": "buttonDefault",
  "showduplicatemessages.buttonSelDel": "buttonSelDel",
  "showduplicatemessages.buttonSelNoDel": "buttonSelKeep",
  "showduplicatemessages.buttonDel": "buttonDelete",
  "showduplicatemessages.buttonCancel": "buttonCancel",
  "tooltip.buttonDefault": "tooltipDefault",
  "tooltip.buttonSelDel": "tooltipSelDel",
  "tooltip.buttonSelKeep": "tooltipSelKeep",
  "tooltip.buttonDelete": "tooltipDelete",
  "tooltip.buttonCancel": "tooltipCancel",
  "removeduplicates.searchduplicates": "statusSearching",
  "removeduplicates.noduplicates": "statusNoDuplicates",
  "showduplicatemessages.totalconfirm": "confirmDelete",
  "showduplicatemessages.todelete": "statusToDelete",
};

// Strings that did not exist in the legacy add-on (English only).
const NEW_EN = {
  prefCheckSize: "Compare message size (replaces 'line count')",
  prefExcludeAllMail: "Ignore the Gmail 'All Mail' folder for the message search",
  optionsSaved: "Saved.",
  reviewHint: "Click the flag to toggle DEL / KEEP. Click the subject to open the message.",
  colSize: "Size",
  flagDel: "DEL",
  flagKeep: "KEEP",
  statusCollecting: "Collecting folders…",
  statusScanningFolder: "Scanning $1",
  statusGroups: "Duplicate groups: $1 — messages in groups: $2",
  statusDeleting: "Deleting: $1 / $2",
  statusDeleted: "$1 messages were moved to the trash.",
  statusDeleteErrors: "$1 messages could not be deleted. See the error console for details.",
  statusCancelled: "Cancelled. No message was deleted.",
  statusFolderErrors: "$1 folders could not be read and were skipped.",
  errorNoCriteria: "No comparison criterion is enabled. Enable at least one in the add-on options.",
  errorNoFolders: "No folder to search. Select a folder first (trash and sent folders may be excluded in the options).",
  buttonClose: "Close",
  buttonOptions: "Options",
  buttonConfirmYes: "Delete",
};

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function readDtd(file) {
  const out = {};
  const text = fs.readFileSync(file, "utf8");
  const re = /<!ENTITY\s+(\S+)\s+"([^"]*)"\s*>/g;
  let m;
  while ((m = re.exec(text))) {
    out[m[1]] = decodeEntities(m[2]);
  }
  return out;
}

function readProperties(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([^#!=\s][^=\s]*)\s*=\s*(.*)$/.exec(line);
    if (m) {
      out[m[1]] = m[2]
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .trim();
    }
  }
  return out;
}

// "%S" -> "$1", "$2", ...; literal "$" -> "$$"
function toWebExt(s) {
  let n = 0;
  return s.replace(/\$/g, "$$$$").replace(/%S/g, () => "$" + ++n);
}

function placeholders(s) {
  return (s.match(/\$\d/g) || []).length;
}

function load(dir) {
  const legacy = {
    ...readDtd(path.join(dir, "removeduplicates.dtd")),
    ...readProperties(path.join(dir, "removeduplicates.properties")),
  };
  const out = {};
  for (const [oldKey, newKey] of Object.entries(KEYS)) {
    if (legacy[oldKey]) {
      out[newKey] = toWebExt(legacy[oldKey].trim());
    }
  }
  return out;
}

const [srcDir, dstDir] = process.argv.slice(2);
if (!srcDir || !dstDir) {
  console.error("usage: convert-locales.js <legacy/locale> <src/_locales>");
  process.exit(1);
}

const en = { ...load(path.join(srcDir, "en-US", "removeduplicates")), ...NEW_EN };
// The legacy menu label is fine, the legacy name carried no version.
for (const [legacyLocale, locale] of Object.entries(LOCALES)) {
  let strings = en;
  if (locale !== "en") {
    strings = load(path.join(srcDir, legacyLocale, "removeduplicates"));
    for (const key of Object.keys(strings)) {
      const untranslated = strings[key] === en[key] && key !== "extensionName";
      if (untranslated || placeholders(strings[key]) !== placeholders(en[key])) {
        delete strings[key];
      }
    }
  }
  const json = {};
  for (const key of Object.keys(strings).sort()) {
    json[key] = { message: strings[key] };
  }
  const outDir = path.join(dstDir, locale);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "messages.json"), JSON.stringify(json, null, 2) + "\n");
  console.log(`${locale}: ${Object.keys(json).length} strings`);
}
