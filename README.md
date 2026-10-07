# Remove Duplicate Messages

Thunderbird add-on that finds duplicate messages in the selected folders and
moves the duplicates to the trash after a review.

This is a MailExtension rewrite of the legacy XUL add-on *Remove Duplicate
Messages 0.1.14* by Thorsten W. Schmidt, which stopped working when
Thunderbird dropped XUL overlays. It targets Thunderbird 128 and later and is
tested against **Thunderbird 153.4.0 ESR**.

## Build

Only Docker is required.

```sh
./build.sh
```

This writes `dist/remove_duplicate_messages-<version>-tb.xpi` and
`dist/SHA256SUMS`. The build is reproducible: the base image is pinned by
digest and the archive uses fixed timestamps, permissions and file order, so
the same commit always produces a byte-identical `.xpi`.

The build also runs the syntax checks, the unit tests and verifies that
`src/_locales` matches what `tools/convert-locales.js` generates from the
legacy translations.

## Install

Download the `.xpi` from the
[latest release](https://github.com/ebal/remove_duplicate_messages/releases/latest)
or build it yourself. Then in Thunderbird: *Add-ons and Themes* → gear icon →
*Install Add-on From File…* and pick the `.xpi`.

## Usage

- Right-click a folder (or several selected folders, or an account) in the
  folder pane → **Remove Duplicate Messages...**
- or use *Tools* → **Remove Duplicate Messages...** for the folder currently
  displayed.

A review window opens, searches the folders including their subfolders and
lists every group of duplicates. One message per group is marked `KEEP`, the
others `DEL`. Click a flag to toggle it, click a subject to open the message.
**Delete Selected** moves the `DEL` messages to the trash after a
confirmation.

The comparison criteria are configured in the add-on options (*Add-ons and
Themes* → *Remove Duplicate Messages* → *Options*).

## Differences from 0.1.14

- The settings start from the same defaults as before; the old values under
  `extensions.removeduplicates.*` cannot be read by a MailExtension and are
  not migrated.
- Progress is shown in the review window instead of the status bar, and the
  window always opens (the *Always show duplicate messages dialog* option is
  gone).
- *Compare line count* became *Compare message size*: Thunderbird no longer
  exposes the line count to add-ons.
- *Prefer to delete unanswered* is gone: the "replied" flag is not available
  to add-ons (and the old implementation of it never worked).
- *Compare message body* hashes all text parts plus the attachment names.
  A message whose content cannot be read is never treated as a duplicate.
- New option *Ignore the Gmail 'All Mail' folder* (on by default), because
  every Gmail message also lives in that folder.
- Virtual folders (saved searches, unified folders, tags) are skipped.
- The never implemented *Erase Selected* button was removed.
- `de-AT`, `de-CH` and `de-LI` now use the `de` translation. Strings that are
  new in this version are English only.

## Tests

```sh
node --test test/*.test.js   # unit tests of the duplicate detection
./test/e2e/run.sh            # end-to-end test, needs ./build.sh first
```

The end-to-end test downloads Thunderbird 153.4.0 ESR into a Docker image
(checksum verified), installs the built `.xpi` into a fresh profile with
known duplicates and drives the real add-on over Marionette: menu click,
search, body comparison, deletion and a final search that finds nothing.

## Release

Releases are built by GitHub Actions (`.github/workflows/build.yml`). Bump
`version` in `src/manifest.json`, commit, then push a matching tag:

```sh
git tag v0.2.0
git push origin main v0.2.0
```

The workflow builds the `.xpi` in Docker, runs the end-to-end test and
attaches the `.xpi` and `SHA256SUMS` to a new GitHub release. Because the
build is reproducible, the checksum matches a local `./build.sh` of the same
commit.

## Layout

| Path | Content |
| --- | --- |
| `src/` | the MailExtension |
| `tools/convert-locales.js` | converts the legacy locale files to `src/_locales` |
| `test/` | unit tests and the end-to-end test |
| `legacy/` | extracted content of the original 0.1.14 `.xpi`, for reference |
| `remove_duplicate_messages-0.1.14-tb.xpi` | the original add-on |
