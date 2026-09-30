/*
 * Open in Obsidian
 *
 * Right-click a paper → Open in Obsidian opens its literature note in a new
 * Obsidian tab. The note is <citekey>.md (the Better BibTeX citekey), the name the
 * Zotero Integration plugin and the pipeline give it.
 *
 * Nothing is configured: the vaults come from Obsidian's own registry
 * (obsidian.json), and the note is looked for in each vault's root and top-level
 * folders. The folder it's found in is remembered, so later lookups are one check.
 *
 * If the vault has the companion Obsidian plugin "Open from Zotero" switched on
 * (obsidian-plugin/ in this repo), the link goes through it instead: a note that's
 * already open, in any tab or window, is brought to the front rather than opened
 * again. Without it, the note always opens in a new tab.
 *
 * Read-only: it never writes into a vault, and it only launches a link for a note
 * that exists, so Obsidian never gets asked for a file it would have to make up.
 * If the paper has a citekey but no note yet (just added, or held as a duplicate),
 * the menu item is greyed out as "No Obsidian note yet".
 */

var menuID = null;
const FTL = "open-in-obsidian.ftl";
const PREF = "extensions.open-in-obsidian.noteDir";

function log(msg) {
  Zotero.debug("OpenInObsidian: " + msg);
}

// The citekey for the selection: a paper, or the paper a PDF / child note belongs to.
function citekeyFor(items) {
  if (!items || items.length !== 1) return null;
  let item = items[0];
  if (!item.isRegularItem()) item = item.parentItem;
  if (!item || !item.isRegularItem()) return null;
  return item.getField("citationKey") || null;
}

function home() {
  return Services.dirsvc.get("Home", Ci.nsIFile).path;
}

// Where Obsidian keeps its list of vaults on this system.
function registryPath() {
  if (Zotero.isMac) return PathUtils.join(home(), "Library", "Application Support", "obsidian", "obsidian.json");
  if (Zotero.isWin) return PathUtils.join(Services.dirsvc.get("AppData", Ci.nsIFile).path, "obsidian", "obsidian.json");
  return PathUtils.join(home(), ".config", "obsidian", "obsidian.json");
}

function exists(path) {
  try {
    return Zotero.File.pathToFile(path).exists();
  }
  catch (e) {
    return false;
  }
}

// Every vault Obsidian knows about, as {id, path}. Synchronous: it runs while the
// context menu is opening.
function vaults() {
  let file = registryPath();
  if (!exists(file)) return [];
  try {
    let registry = JSON.parse(Zotero.File.getContents(file)).vaults || {};
    return Object.entries(registry).map(([id, v]) => ({ id, path: v.path })).filter(v => v.path && exists(v.path));
  }
  catch (e) {
    Zotero.logError(e);
    return [];
  }
}

function vaultPaths() {
  return vaults().map(v => v.path);
}

function subfolders(dir) {
  let out = [];
  try {
    let entries = Zotero.File.pathToFile(dir).directoryEntries;
    while (entries.hasMoreElements()) {
      let f = entries.nextFile;
      if (f && !f.leafName.startsWith(".") && f.isDirectory()) out.push(f.path);
    }
  }
  catch (e) {
    Zotero.logError(e);
  }
  return out;
}

function isInside(path, dir) {
  let rel = PathUtils.normalize(path);
  let base = PathUtils.normalize(dir);
  return rel === base || rel.startsWith(base + (Zotero.isWin ? "\\" : "/"));
}

// Absolute path of the paper's note, or null if there isn't one in any vault.
function findNote(citekey) {
  let name = citekey + ".md";
  let vaults = vaultPaths();
  let cached = Zotero.Prefs.get(PREF, true);
  if (cached && vaults.some(v => isInside(cached, v)) && exists(PathUtils.join(cached, name))) {
    return PathUtils.join(cached, name);
  }
  for (let vault of vaults) {
    for (let dir of [vault, ...subfolders(vault)]) {
      let path = PathUtils.join(dir, name);
      if (exists(path)) {
        if (dir !== cached) Zotero.Prefs.set(PREF, dir, true);
        return path;
      }
    }
  }
  return null;
}

const COMPANION = "open-from-zotero";

// True if the companion plugin is installed and switched on in this vault.
function hasCompanion(vaultPath) {
  let config = PathUtils.join(vaultPath, ".obsidian");
  let enabled = PathUtils.join(config, "community-plugins.json");
  if (!exists(PathUtils.join(config, "plugins", COMPANION, "main.js")) || !exists(enabled)) return false;
  try {
    return JSON.parse(Zotero.File.getContents(enabled)).includes(COMPANION);
  }
  catch (e) {
    Zotero.logError(e);
    return false;
  }
}

// The link for a note. Through the companion when the vault has it: vault ID plus
// the vault-relative path. Otherwise Obsidian's own open: path= lets Obsidian pick
// the vault itself, and paneType=tab keeps the current note open.
function noteURL(path) {
  let vault = vaults().find(v => isInside(path, v.path));
  if (vault && hasCompanion(vault.path)) {
    let rel = PathUtils.normalize(path).slice(PathUtils.normalize(vault.path).length + 1).replace(/\\/g, "/");
    return `obsidian://${COMPANION}?vault=${encodeURIComponent(vault.id)}&file=${encodeURIComponent(rel)}`;
  }
  return "obsidian://open?path=" + encodeURIComponent(path) + "&paneType=tab";
}

//
// Zotero.launchURL() hands non-web links to Gecko's external-protocol service,
// which asks "Open this link with Obsidian?" every time. Launching through the
// scheme's handler with the system default, the way Zotero opens web links in the
// browser, skips that question. Nothing is saved to Zotero's settings: the other
// obsidian:// links in Zotero still ask as before. If this fails, it falls back to
// launchURL, so the note still opens (after the question).
function openNote(path) {
  let url = noteURL(path);
  log("opening " + url);
  try {
    if (!Zotero.isWin) Zotero.Utilities.Internal.Environment.clearMozillaVariables();
    let svc = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
    let handler = svc.getProtocolHandlerInfo("obsidian");
    handler.preferredAction = Ci.nsIHandlerInfo.useSystemDefault;
    handler.launchWithURI(Services.io.newURI(url), null);
  }
  catch (e) {
    Zotero.logError(e);
    Zotero.launchURL(url);
  }
}

function install() {}
function uninstall() {}

function onMainWindowLoad({ window }) {
  window.MozXULElement.insertFTLIfNeeded(FTL);
}

function onMainWindowUnload({ window }) {
  window.document.querySelector(`link[href="${FTL}"]`)?.remove();
}

function startup({ id }) {
  if (!Zotero.MenuManager) {
    log("Zotero.MenuManager not found; doing nothing");
    return;
  }
  menuID = Zotero.MenuManager.registerMenu({
    menuID: "open-in-obsidian",
    pluginID: id,
    target: "main/library/item",
    menus: [{
      menuType: "menuitem",
      l10nID: "open-in-obsidian-menuitem",
      l10nArgs: '{"found": "yes"}',
      onShowing: (event, context) => {
        let citekey = null, found = false;
        try {
          citekey = citekeyFor(context.items);
          found = !!(citekey && findNote(citekey));
        }
        catch (e) {
          Zotero.logError(e);
        }
        context.setVisible(!!citekey);
        context.setEnabled(found);
        context.setL10nArgs(JSON.stringify({ found: found ? "yes" : "no" }));
      },
      onCommand: (event, context) => {
        let win = context.menuElem?.ownerGlobal || Zotero.getMainWindow();
        try {
          let citekey = citekeyFor(context.items);
          let path = citekey && findNote(citekey);
          if (path) {
            openNote(path);
          }
          else {
            Services.prompt.alert(win, "Open in Obsidian", `There's no Obsidian note for ${citekey} yet.`);
          }
        }
        catch (e) {
          Zotero.logError(e);
          Services.prompt.alert(win, "Open in Obsidian", "Couldn't open the note: " + e);
        }
      },
    }],
  });
  for (let win of Zotero.getMainWindows()) {
    onMainWindowLoad({ window: win });
  }
  log("active");
}

function shutdown() {
  if (menuID) Zotero.MenuManager.unregisterMenu(menuID);
  menuID = null;
  for (let win of Zotero.getMainWindows()) {
    onMainWindowUnload({ window: win });
  }
}
