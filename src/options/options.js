"use strict";

// Preferences are saved as soon as a control changes.
async function init() {
  rdmLocalizeDocument();
  const prefs = await rdmLoadPrefs();
  const saved = document.getElementById("saved");
  let savedTimer;

  for (const [name, value] of Object.entries(prefs)) {
    const el = document.getElementById(name);
    if (!el) {
      continue;
    }
    if (el.type == "checkbox") {
      el.checked = value;
    } else {
      el.value = String(value);
    }
    el.addEventListener("change", async () => {
      await rdmSavePrefs({
        [name]: el.type == "checkbox" ? el.checked : Number(el.value),
      });
      saved.hidden = false;
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => (saved.hidden = true), 1500);
    });
  }
}

init();
