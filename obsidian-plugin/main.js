/*
 * Open from Zotero: companion to the Zotero plugin "Open in Obsidian".
 *
 * Obsidian's own obsidian://open link always opens the note in a new tab (or in
 * place of the current note), even when the note is already open. This adds
 * obsidian://open-from-zotero?vault=…&file=<vault-relative path>, which:
 *
 *   - if the note is open anywhere (any tab, any window, including background
 *     tabs that haven't loaded yet), switches to that tab and brings its window
 *     to the front; with several, the one used most recently;
 *   - otherwise opens it in a new tab.
 *
 * The other way round (switched OFF, see OPEN_IN_ZOTERO_MENU below): right-click a
 * literature note in the file explorer (left sidebar) → "Open in Zotero" opens its
 * PDF in Zotero. It opens the same
 * zotero://open-pdf link as the note's own "Open PDF" link, the same way Obsidian
 * opens that link, so it behaves identically. Only shown for notes whose PDF
 * property holds such a link; notes without a PDF, and other notes, get nothing.
 *
 * Read-only: it never creates or changes a note.
 */

const { Plugin, TFile, Notice, normalizePath } = require("obsidian");

// "Open in Zotero" in a literature note's file-explorer menu. Built and working, but
// switched off on 2026-09-30; the code is kept. Set to true to bring it back.
const OPEN_IN_ZOTERO_MENU = false;

// The zotero://open-pdf URL in a note's PDF property, e.g.
// PDF: "[Open PDF](zotero://open-pdf/library/items/ABCD1234)", or null.
const PDF_LINK = /\((zotero:\/\/open-pdf\/[^)\s]+)\)/;

function pdfURL(frontmatter) {
  const value = frontmatter && frontmatter.PDF;
  const m = typeof value === "string" && value.match(PDF_LINK);
  return m ? m[1] : null;
}

module.exports = class OpenFromZotero extends Plugin {
  onload() {
    this.registerObsidianProtocolHandler("open-from-zotero", (params) => {
      this.openNote(params.file).catch((e) => {
        console.error(e);
        new Notice("Open from Zotero: " + e);
      });
    });

    if (OPEN_IN_ZOTERO_MENU) this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source) => {
      if (source !== "file-explorer-context-menu" || !(file instanceof TFile) || file.extension !== "md") return;
      const cache = this.app.metadataCache.getFileCache(file);
      const url = pdfURL(cache && cache.frontmatter);
      if (!url) return;
      menu.addItem((item) => item
        .setTitle("Open in Zotero")
        .setIcon("book-open")
        .setSection("open")
        .onClick(() => window.open(url, "_blank")));   // as Obsidian opens the note's link
    }));
  }

  // Every leaf showing this file. getViewState() also covers deferred (not yet
  // loaded) background tabs, whose view has no file yet.
  leavesFor(file) {
    const found = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const st = leaf.getViewState();
      if (st.type === "markdown" && st.state && st.state.file === file.path) found.push(leaf);
    });
    return found.sort((a, b) => (b.activeTime || 0) - (a.activeTime || 0));
  }

  async openNote(path) {
    const file = path && this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) {
      new Notice(`Open from Zotero: there's no note at ${path}`);
      return;
    }
    const leaf = this.leavesFor(file)[0];
    if (!leaf) {
      await this.app.workspace.getLeaf("tab").openFile(file, { active: true });
      return;
    }
    await this.app.workspace.revealLeaf(leaf);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    // The link brings Obsidian forward, which can put the main window on top of
    // the note's own window. Raise that window now and once more just after.
    const raise = () => {
      const win = leaf.getContainer && leaf.getContainer().win;
      const ew = win && win.electronWindow;
      if (ew) {
        if (ew.isMinimized()) ew.restore();
        ew.focus();
      }
      else if (win) {
        win.focus();
      }
    };
    raise();
    window.setTimeout(raise, 150);
  }
};
