"use strict";

// Same defaults as the legacy add-on (extensions.removeduplicates.*).
const RDM_DEFAULT_PREFS = {
  checkMessageId: true,
  checkDateInSeconds: true,
  checkDate: false,
  checkSubject: true,
  checkAuthor: true,
  checkSize: false,
  checkBody: false,
  checkRecipient: false,
  reverseSearch: false,
  // 0: first found, 1: unread, 2: smaller, 3: larger
  preferredDelete: 0,
  subFolderFirst: false,
  excludeTrash: true,
  excludeSent: true,
  excludeAllMail: true,
  autodelete: false,
  debugInfo: false,
};

async function rdmLoadPrefs() {
  return browser.storage.local.get(RDM_DEFAULT_PREFS);
}

async function rdmSavePrefs(prefs) {
  await browser.storage.local.set(prefs);
}

// Fills in every element carrying data-i18n / data-i18n-title.
function rdmLocalizeDocument() {
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = browser.i18n.getMessage(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-title]")) {
    el.title = browser.i18n.getMessage(el.dataset.i18nTitle);
  }
}
