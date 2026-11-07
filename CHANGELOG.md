# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/).

## [1.2.0] - 2026-11-07

### Added
- `agent show <id|name|login>`: team, skill groups (warns when an agent is only in a `.Default` group), attributes, live Finesse state, and the Finesse queues the agent counts toward.
- `skillgroup members <id|name> [--live]`: agents in a skill group, optionally with live Finesse state; prints the Finesse queue ID.
- `finesse team <id|name>`: team roster with live state (works where AW `agentteam` returns 403).
- `finesse queue <name>`: look up queue stats by skill group name (Finesse queue ID = skill group peripheral number).
- AW `get` accepts an exact name/login; `list --filter <text>` uses AW server-side search. Ambiguous or partial matches list candidates instead of guessing.
- `doctor` checks every AW/Finesse host, proves Finesse admin login on the primary, reports Finesse/CTI status and non-OK AW components, checks Secret Server, and supports `--format json`.
- Per-service hints on 401/403 (e.g. CVP needs ServiceabilityAdministrationUserRole; Finesse admin APIs are primary-only).

### Changed
- AW rows keep nested data: `firstName`, `lastName`, `userName` (from person) and `skillGroups` / other named lists.
- Finesse nested fields render as text instead of `[object Object]`; epoch `*Time` fields become ISO timestamps.
- A single wide record prints as key/value rows; table/CSV columns are the union of all rows.
- Unknown `--format` values are rejected.
- Diagnostic Portal "No … available" replies (e.g. no alarms) are treated as empty results, not errors.
- README and skill updated for UCCE 15.

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
