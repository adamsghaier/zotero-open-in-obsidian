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

// Absolute paths of every vault Obsidian knows about. Synchronous: it runs while
// the context menu is opening.
function vaultPaths() {
  let file = registryPath();
  if (!exists(file)) return [];
  try {
    let vaults = JSON.parse(Zotero.File.getContents(file)).vaults || {};
    return Object.values(vaults).map(v => v.path).filter(p => p && exists(p));
  }
  catch (e) {
    Zotero.logError(e);
    return [];
  }
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

// path= lets Obsidian pick the vault itself; paneType=tab keeps the current note open.
function openNote(path) {
  log("opening " + path);
  Zotero.launchURL("obsidian://open?path=" + encodeURIComponent(path) + "&paneType=tab");
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
