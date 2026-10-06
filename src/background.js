"use strict";

const MENU_FOLDER = "rdm-folder-pane";
const MENU_TOOLS = "rdm-tools-menu";

browser.menus.create({
  id: MENU_FOLDER,
  title: browser.i18n.getMessage("menuLabel"),
  contexts: ["folder_pane"],
});

browser.menus.create({
  id: MENU_TOOLS,
  title: browser.i18n.getMessage("menuLabel"),
  contexts: ["tools_menu"],
});

// Returns the ids of the folders the menu was invoked on.
async function getTargetFolderIds(info, tab) {
  const ids = [];
  const add = folder => {
    if (folder && folder.id && !ids.includes(folder.id)) {
      ids.push(folder.id);
    }
  };

  if (info.menuItemId == MENU_FOLDER) {
    for (const folder of info.selectedFolders || []) {
      add(folder);
    }
    add(info.selectedFolder);
    if (!ids.length && info.selectedAccount) {
      const account = await browser.accounts.get(info.selectedAccount.id, false);
      add(account && account.rootFolder);
    }
  }

  // Tools menu, or a folder pane click that carried no folder information.
  if (!ids.length) {
    const query = { active: true };
    if (tab && tab.windowId !== undefined) {
      query.windowId = tab.windowId;
    } else {
      query.lastFocusedWindow = true;
    }
    for (const mailTab of await browser.mailTabs.query(query)) {
      add(mailTab.displayedFolder);
    }
  }
  return ids;
}

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId != MENU_FOLDER && info.menuItemId != MENU_TOOLS) {
    return;
  }
  let folderIds = [];
  try {
    folderIds = await getTargetFolderIds(info, tab);
  } catch (e) {
    console.error("Remove Duplicate Messages: could not determine folders", e);
  }
  // The review window does all the work, so every search is independent.
  await browser.windows.create({
    url: "review/review.html#" + encodeURIComponent(JSON.stringify(folderIds)),
    type: "popup",
    width: 1100,
    height: 700,
    allowScriptsToClose: true,
  });
});
