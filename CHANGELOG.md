# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/).

## [1.1.5] - 2026-11-07

### Fixed
- `--host` on subcommands (diag, vvb, cvp properties) was swallowed by the global flag, so `--host all` and `--host <name>` silently hit the first host. Unknown hosts now error and list configured hosts.
- `--no-audit` never disabled audit logging.
- Failed `<ss:ID:field>` lookups sent the literal placeholder as the password; they now fail with the Secret Server error (e.g. expired token). Field names match case-insensitively; lookups are cached per run.
- `ss-cli` no longer inherits `NODE_TLS_REJECT_UNAUTHORIZED=0` from insecure mode.
- AW commands and `status` ignored `insecure` / `--insecure`.
- Exit code is now 1 when any host fails under `--host all`, on Diagnostic Portal `ReturnCode` errors, and on `config test` failures.
- TLS, empty-body, HTML and invalid XML/JSON responses produce clear errors instead of "fetch failed" / null crashes.
- AW auto-pagination advances by returned count (servers that cap page size no longer skip records); `--page 0` is rejected.
- Diag downloads default to the file's base name, refuse to overwrite without `--force`, map HTTP errors, and don't save XML error replies as files.
- `--version` reported 1.0.0.
- `doctor` / `config test` handle object-style host entries.

### Changed
- Audit log records failures with status/error; audit file is created 0600.
- `config add` skeleton defaults to `insecure: false`.
- Warn when `--password` is passed on the command line.
- AW, `status` and Finesse commands accept `--host` (e.g. B side).
- Node >= 20 required (commander 14).
- Removed unused `update-notifier` dependency and no-op `--debug` flag.
- CI runs tests on Node 20/22/24; releases are gated on tests.
