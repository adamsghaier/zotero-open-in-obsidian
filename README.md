# Open in Obsidian for Zotero

Right-click a paper → **Open in Obsidian** opens its literature note in Obsidian:
in a new tab, or, with the companion plugin below, in the tab or window where it's already open. It works on the paper itself, its PDF, or a note under it.

The note is found by the paper's Better BibTeX citekey: `<citekey>.md`, which is the
name the [Obsidian Zotero Integration](https://github.com/mgmeyers/obsidian-zotero-desktop-connector)
plugin gives it by default.

- **Nothing to set up.** It reads Obsidian's own list of vaults and looks for the note
  in each vault's root and top-level folders (e.g. `Literature Notes/`). The folder it
  finds is remembered, so later lookups are instant.
- If the paper has a citekey but no note yet, the item is greyed out as **No Obsidian
  note yet**. It isn't shown for a selection of several items or for an item without a
  citekey.
- Read-only. It never writes into your vault, and it only opens notes that exist.

Needs Better BibTeX (for the citekey) and Obsidian installed on the same computer.
Works on macOS, Windows and Linux. Zotero 8–10.

## Already-open notes: the companion Obsidian plugin

Obsidian's own links always open a new tab, even if the note is already open. For
Obsidian to switch to the open note instead, in whichever tab or window it's in, install
the small companion plugin in `obsidian-plugin/`:

1. Copy `manifest.json` and `main.js` into `<your vault>/.obsidian/plugins/open-from-zotero/`.
2. In Obsidian: **Settings → Community plugins**, turn on **Open from Zotero**.

Open in Obsidian notices it and uses it from then on. Without it, notes open in a new
tab as before.

The companion also works the other way round: right-click a literature note in
Obsidian's file explorer → **Open in Zotero** opens its PDF in Zotero. It uses the
`zotero://open-pdf/…` link in the note's `PDF` property, so it only appears on notes
that have a PDF.

## Install
Download `open-in-obsidian.xpi` from the latest [release](../../releases/latest), then in
Zotero: **Tools → Plugins → ⚙ → Install Plugin From File…**. Updates arrive through
Zotero's own update check.

## Release (maintainer)
Bump `version` in `manifest.json`, commit, then run `./release.sh`.

## License
MIT, see [LICENSE](LICENSE).
