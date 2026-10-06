"use strict";

// End-to-end test driver. Creates a Thunderbird profile with a "Local Folders"
// account containing known duplicates, installs the extension, starts
// Thunderbird headless and drives it through Marionette:
//
//   1. the folder pane menu click reaches the background script,
//   2. the review window finds the expected duplicate groups,
//   3. "Compare message body" tells apart messages with equal headers,
//   4. deleting moves exactly the marked messages to the trash.
//
// Extension pages are loaded in the parent process for this test
// (extensions.webextensions.remote = false), so that their DOM can be reached
// from the Marionette chrome context.

const assert = require("node:assert");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const THUNDERBIRD = process.env.THUNDERBIRD || "/opt/thunderbird/thunderbird";
const PORT = 2828;
const xpi = process.argv[2];

// --- profile ---------------------------------------------------------------

function mail({ id, subject, body, date = "Wed, 01 May 2024 10:00:00 +0000" }) {
  return [
    "From - Wed May 01 10:00:00 2024",
    "X-Mozilla-Status: 0001",
    "X-Mozilla-Status2: 00000000",
    `Message-ID: <${id}@example.org>`,
    `Date: ${date}`,
    "From: Alice <alice@example.org>",
    "To: Bob <bob@example.org>",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
    "",
    "",
  ].join("\n");
}

const m1 = { id: "one", subject: "First", body: "Body one" };
const m2 = { id: "two", subject: "Second", body: "Body two" };
const m2b = { ...m2, body: "A different body" };
const m3 = { id: "three", subject: "Third", body: "Body three" };

function createProfile() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rdm-profile-"));
  const mailDir = path.join(profile, "Mail", "Local Folders");
  fs.mkdirSync(mailDir, { recursive: true });
  fs.writeFileSync(path.join(mailDir, "TestA"), [m1, m2, m3, m1].map(mail).join(""));
  fs.writeFileSync(path.join(mailDir, "TestB"), [m1, m2b].map(mail).join(""));
  fs.writeFileSync(path.join(mailDir, "Trash"), "");

  const manifest = JSON.parse(
    require("node:child_process").execFileSync("node", [
      "-e",
      // Reads manifest.json out of the zip without extra dependencies.
      `const z=require("zlib"),b=require("fs").readFileSync(process.argv[1]);
       let i=b.lastIndexOf(Buffer.from("PK\\x05\\x06")),n=b.readUInt16LE(i+10),o=b.readUInt32LE(i+16);
       for(;n--;){const l=b.readUInt16LE(o+28),e=b.readUInt16LE(o+30),c=b.readUInt16LE(o+32),name=b.toString("utf8",o+46,o+46+l);
         if(name=="manifest.json"){const h=b.readUInt32LE(o+42),s=h+30+b.readUInt16LE(h+26)+b.readUInt16LE(h+28),d=b.subarray(s,s+b.readUInt32LE(o+20));
           process.stdout.write(b.readUInt16LE(o+10)?z.inflateRawSync(d):d);}
         o+=46+l+e+c;}`,
      xpi,
    ])
  );
  const id = manifest.browser_specific_settings.gecko.id;
  fs.mkdirSync(path.join(profile, "extensions"));
  fs.copyFileSync(xpi, path.join(profile, "extensions", id + ".xpi"));

  const prefs = {
    "extensions.autoDisableScopes": 0,
    "extensions.webextensions.remote": false,
    "xpinstall.signatures.required": false,
    "marionette.port": PORT,
    "app.update.enabled": false,
    "mail.shell.checkDefaultClient": false,
    "mail.provider.suppress_dialog_on_startup": true,
    "mailnews.start_page.enabled": false,
    "datareporting.policy.dataSubmissionPolicyBypassNotification": true,
    "mail.accountmanager.accounts": "account1",
    "mail.accountmanager.localfoldersserver": "server1",
    "mail.account.account1.server": "server1",
    "mail.server.server1.type": "none",
    "mail.server.server1.hostname": "Local Folders",
    "mail.server.server1.name": "Local Folders",
    "mail.server.server1.userName": "nobody",
    "mail.server.server1.directory-rel": "[ProfD]Mail/Local Folders",
  };
  fs.writeFileSync(
    path.join(profile, "user.js"),
    Object.entries(prefs)
      .map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${JSON.stringify(v)});\n`)
      .join("")
  );
  return { profile, id };
}

// --- minimal Marionette client ----------------------------------------------

class Marionette {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    this.handshake = new Promise(resolve => (this.onHandshake = resolve));
    socket.on("data", chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      for (;;) {
        const colon = this.buffer.indexOf(":");
        if (colon < 0) {
          return;
        }
        const length = Number(this.buffer.toString("utf8", 0, colon));
        if (this.buffer.length < colon + 1 + length) {
          return;
        }
        const packet = JSON.parse(this.buffer.toString("utf8", colon + 1, colon + 1 + length));
        this.buffer = this.buffer.subarray(colon + 1 + length);
        if (!Array.isArray(packet)) {
          this.onHandshake(packet);
          continue;
        }
        const [, id, error, result] = packet;
        const { resolve, reject } = this.pending.get(id);
        this.pending.delete(id);
        if (error) {
          reject(new Error(`${error.error}: ${error.message}`));
        } else {
          resolve(result);
        }
      }
    });
  }

  static async connect(port, timeout = 120000) {
    const end = Date.now() + timeout;
    for (;;) {
      try {
        const socket = await new Promise((resolve, reject) => {
          const s = net.connect(port, "127.0.0.1", () => resolve(s));
          s.once("error", reject);
        });
        const client = new Marionette(socket);
        await client.handshake;
        return client;
      } catch (e) {
        if (Date.now() > end) {
          throw new Error("Marionette did not come up: " + e.message);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  send(command, params = {}) {
    const id = this.nextId++;
    const data = JSON.stringify([0, id, command, params]);
    this.socket.write(`${Buffer.byteLength(data)}:${data}`);
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  // Runs an async function body with chrome privileges.
  async chrome(body, ...args) {
    const script = `
      const done = arguments[arguments.length - 1];
      const args = Array.prototype.slice.call(arguments, 0, -1);
      const { MailServices } = ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const waitFor = async (fn, what, timeout = 60000) => {
        for (const end = Date.now() + timeout; Date.now() < end; await sleep(100)) {
          const value = await fn();
          if (value) return value;
        }
        throw new Error("timeout waiting for " + what);
      };
      const popups = () => Array.from(Services.wm.getEnumerator("mail:extensionPopup"));
      const reviewDocument = () => {
        for (const win of popups()) {
          const browser = win.document.querySelector("browser");
          const doc = browser && browser.contentDocument;
          if (doc && doc.location.pathname == "/review/review.html" && doc.getElementById("buttonCancel")) {
            return doc;
          }
        }
        return null;
      };
      (async () => { ${body} })().then(
        value => done({ value }),
        e => done({ error: String(e) + "\\n" + (e && e.stack) })
      );`;
    const { value } = await this.send("WebDriver:ExecuteAsyncScript", { script, args });
    if (value.error) {
      throw new Error(value.error);
    }
    return value.value;
  }
}

// --- scenario ----------------------------------------------------------------

// Simulates a click on our folder pane menu entry for the Local Folders
// account and waits until the review window has finished searching.
const RUN_SEARCH = `
  const ext = WebExtensionPolicy.getByID(args[0]).extension;
  const root = MailServices.accounts.localFoldersServer.rootFolder;
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  const info = {
    menuItemId: "rdm-folder-pane",
    editable: false,
    modifiers: [],
    selectedFolders: [ext.folderManager.convert(root)],
    selectedAccount: ext.accountManager.convert(
      MailServices.accounts.findAccountForServer(root.server)
    ),
  };
  ext.emit("webext-menu-menuitem-click", info, win.gTabmail.currentTabInfo);
  const doc = await waitFor(reviewDocument, "review window");
  await waitFor(
    () => !doc.getElementById("buttonDelete").disabled || doc.getElementById("progress").hidden,
    "search to finish"
  );
  await sleep(300);
  return {
    status: doc.getElementById("status").textContent,
    warning: doc.getElementById("warning").hidden ? "" : doc.getElementById("warning").textContent,
    toDelete: doc.getElementById("toDelete").textContent,
    deleteEnabled: !doc.getElementById("buttonDelete").disabled,
    groups: Array.from(doc.getElementById("messages").tBodies, body =>
      Array.from(body.rows, row => ({
        flag: row.cells[0].textContent,
        subject: row.cells[3].textContent,
        folder: row.cells[4].textContent,
      }))
    ),
  };`;

const CLOSE_REVIEW = `
  const doc = reviewDocument();
  doc.getElementById("buttonCancel").click();
  await waitFor(() => !popups().length, "review window to close");`;

const FOLDER_COUNTS = `
  const counts = {};
  for (const folder of MailServices.accounts.localFoldersServer.rootFolder.subFolders) {
    counts[folder.name] = folder.getTotalMessages(false);
  }
  return counts;`;

async function scenario(client, id) {
  await client.send("WebDriver:NewSession", { capabilities: {} });
  await client.send("Marionette:SetContext", { value: "chrome" });
  await client.send("WebDriver:SetTimeouts", { script: 180000 });

  const info = await client.chrome(
    `await waitFor(() => Services.wm.getMostRecentWindow("mail:3pane"), "main window");
     const policy = await waitFor(() => WebExtensionPolicy.getByID(args[0]), "extension");
     await waitFor(() => policy.extension.backgroundState == "running" || !policy.extension.backgroundState, "background");
     await sleep(1000);
     return { version: Services.appinfo.version, name: policy.name, extensionVersion: policy.extension.version };`,
    id
  );
  console.log(`Thunderbird ${info.version}, "${info.name}" ${info.extensionVersion} loaded`);

  // The mbox files were written by hand, let Thunderbird index them first.
  await client.chrome(
    `const root = MailServices.accounts.localFoldersServer.rootFolder;
     for (const [name, count] of [["TestA", 4], ["TestB", 2]]) {
       const folder = root.getChildNamed(name).QueryInterface(Ci.nsIMsgLocalMailFolder);
       try {
         folder.getDatabaseWithReparse(null, null);
       } catch (e) {
         // Reparse is running.
       }
       await waitFor(() => folder.getTotalMessages(false) == count, "index of " + name);
     }`
  );

  const before = await client.chrome(FOLDER_COUNTS);
  console.log("folders before:", JSON.stringify(before));

  // 1. Default settings: message id + date + subject + author.
  let result = await client.chrome(RUN_SEARCH, id);
  console.log("default search:", JSON.stringify(result));
  assert.equal(result.warning, "");
  assert.equal(result.deleteEnabled, true);
  let shape = result.groups.map(g => g.map(r => `${r.flag} ${r.subject}`)).sort();
  assert.deepEqual(shape, [
    ["KEEP First", "DEL First", "DEL First"],
    ["KEEP Second", "DEL Second"],
  ]);
  // The message found last (TestB is searched after TestA) is the one kept.
  for (const group of result.groups) {
    assert.match(group[0].folder, /TestB$/);
  }

  // 2. Compare message body: the two "Second" messages differ.
  await client.chrome(
    `const win = reviewDocument().defaultView;
     await win.wrappedJSObject.browser.storage.local.set(Cu.cloneInto({ checkBody: true }, win));`
  );
  await client.chrome(CLOSE_REVIEW);
  result = await client.chrome(RUN_SEARCH, id);
  console.log("body search:", JSON.stringify(result));
  assert.equal(result.warning, "");
  shape = result.groups.map(g => g.map(r => `${r.flag} ${r.subject}`));
  assert.deepEqual(shape, [["KEEP First", "DEL First", "DEL First"]]);

  // 3. Back to the defaults, then delete.
  await client.chrome(
    `const win = reviewDocument().defaultView;
     await win.wrappedJSObject.browser.storage.local.set(Cu.cloneInto({ checkBody: false }, win));`
  );
  await client.chrome(CLOSE_REVIEW);
  result = await client.chrome(RUN_SEARCH, id);
  assert.equal(result.groups.length, 2);

  const status = await client.chrome(
    `const doc = reviewDocument();
     doc.getElementById("buttonDelete").click();
     await waitFor(() => doc.getElementById("confirm").open, "confirmation dialog");
     doc.getElementById("confirmYes").click();
     await waitFor(() => doc.getElementById("progress").hidden && doc.getElementById("messages").hidden, "deletion");
     return doc.getElementById("status").textContent + doc.getElementById("warning").textContent;`
  );
  console.log("after delete:", status);
  assert.match(status, /^3 /);

  const after = await client.chrome(
    `await sleep(1500); ${FOLDER_COUNTS}`
  );
  console.log("folders after:", JSON.stringify(after));
  assert.equal(after.TestA, 1, "TestA keeps only 'Third'");
  assert.equal(after.TestB, 2, "TestB keeps 'First' and 'Second'");
  assert.equal(after.Trash, before.Trash + 3, "three duplicates are in the trash");

  // 4. Nothing left to find.
  await client.chrome(CLOSE_REVIEW);
  result = await client.chrome(RUN_SEARCH, id);
  console.log("final search:", JSON.stringify(result));
  assert.deepEqual(result.groups, []);
  assert.equal(result.deleteEnabled, false);
  await client.chrome(CLOSE_REVIEW);
}

async function main() {
  assert.ok(xpi, "usage: driver.js <extension.xpi>");
  const { profile, id } = createProfile();
  const thunderbird = spawn(
    THUNDERBIRD,
    ["--headless", "--marionette", "-remote-allow-system-access", "--no-remote", "--profile", profile],
    { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MOZ_HEADLESS: "1" } }
  );
  let log = "";
  thunderbird.stdout.on("data", d => (log += d));
  thunderbird.stderr.on("data", d => (log += d));

  let failed = false;
  try {
    const client = await Marionette.connect(PORT);
    await scenario(client, id);
    console.log("E2E PASSED");
  } catch (e) {
    failed = true;
    console.error("E2E FAILED:", e);
    console.error("--- Thunderbird output (tail) ---\n" + log.split("\n").filter(l => l.trim() && !/Gtk-CRITICAL|glib warning/.test(l)).slice(-40).join("\n"));
  } finally {
    thunderbird.kill("SIGKILL");
  }
  process.exit(failed ? 1 : 0);
}

main();
