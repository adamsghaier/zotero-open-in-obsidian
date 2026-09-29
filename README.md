# Open in Obsidian for Zotero

Right-click a paper → **Open in Obsidian** opens its literature note in a new
Obsidian tab. It works on the paper itself, its PDF, or a note under it.

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

## Install
Download `open-in-obsidian.xpi` from the latest [release](../../releases/latest), then in
Zotero: **Tools → Plugins → ⚙ → Install Plugin From File…**. Updates arrive through
Zotero's own update check.

## Release (maintainer)
Bump `version` in `manifest.json`, commit, then run `./release.sh`.

## License
MIT, see [LICENSE](LICENSE).
