# cisco-ucce CLI Design Spec

## Overview

CLI-only tool for monitoring and troubleshooting Cisco Unified Contact Center Enterprise. Read-only operations across 7 APIs spanning the full UCCE solution stack: AW, Finesse, CVP, PG, VVB, and LiveData. No write operations. CUIC does not expose a public REST API — skip.

## APIs

| API | Server | Port | Base Path | Purpose |
|---|---|---|---|---|
| Configuration API | AW | 443 | `/unifiedconfig/config/` | Agents, skill groups, call types, teams, precision queues, attributes |
| Status API | AW | 443 | `/unifiedconfig/config/status` | System-wide health validation across all components |
| Finesse API | Finesse | 443 | `/finesse/api/` | Live agent states, active calls/dialogs, queue stats, system info |
| CVP OAMP REST | CVP | 8111 | `/cvp-config/`, `/cvp-orm/rest/` | CVP version, config properties, server sync |
| Diagnostic Portal | PG | 7890 | `/icm-dp/rest/DiagnosticPortal/` | PG-level diagnostics, agent/trunk status |
| VVB Admin API | VVB | 443 | `/adminapi/` | Active calls, VVB stats |
| LiveData REST | LiveData | 12005 | TBD (explore in lab) | Real-time agent/call statistics |

## Authentication

- **Configuration/Status API (AW):** HTTP Basic Auth, domain-qualified username (`user@domain.com`)
- **Finesse API:** HTTP Basic Auth
- **CVP OAMP:** HTTP Basic Auth
- **Diagnostic Portal (PG):** HTTP Basic Auth
- **VVB Admin API:** HTTP Basic Auth

## Cluster Configuration

Stored at `~/.cisco-ucce/config.json` (0600 permissions). Supports single-side (lab) and full A/B side deployments with multiple PGs.

### Single-side (lab/small)

```json
{
  "activeCluster": "lab",
  "clusters": {
    "lab": {
      "aw": "ucce-aw.lab.local",
      "finesse": "finesse.lab.local",
      "cvp": ["cvp1a.lab.local"],
      "pg": ["pg1a.lab.local"],
      "vvb": ["vvb1a.lab.local"],
      "livedata": ["ld1a.lab.local"],
      "username": "admin@lab.local",
      "password": "secret",
      "insecure": true
    }
  }
}
```

### Full deployment (A/B sides, multiple PGs)

```json
{
  "activeCluster": "prod",
  "clusters": {
    "prod": {
      "sideA": {
        "aw": ["aw-a1.prod.local"],
        "rogger": "rogger-a.prod.local",
        "pg": ["pg-a1.prod.local", "pg-a2.prod.local", "pg-a3.prod.local"]
      },
      "sideB": {
        "aw": ["aw-b1.prod.local"],
        "rogger": "rogger-b.prod.local",
        "pg": ["pg-b1.prod.local", "pg-b2.prod.local", "pg-b3.prod.local"]
      },
      "finesse": ["finesse-a.prod.local", "finesse-b.prod.local"],
      "cvp": ["cvp1a.prod.local", "cvp1b.prod.local"],
      "vvb": ["vvb1a.prod.local", "vvb1b.prod.local"],
      "livedata": ["ld1a.prod.local", "ld1b.prod.local"],
      "username": "admin@prod.local",
      "password": "<ss:22010:password>",
      "insecure": true
    }
  }
}
```

### Auth Precedence

CLI flags > env vars (`CUCCE_HOST`, `CUCCE_USERNAME`, `CUCCE_PASSWORD`) > config file.

ss-cli placeholder support for credentials.

## Command Structure

Resource-grouped, read-only.

### Agent Commands (Config API)

```bash
cisco-ucce agent list
cisco-ucce agent list --page 1 --page-size 50
cisco-ucce agent get <id>
cisco-ucce agent search --team "Sales"
cisco-ucce agent search --skill-group "Billing"
```

### Skill Group Commands (Config API)

```bash
cisco-ucce skill-group list
cisco-ucce skill-group get <id>
```

### Call Type Commands (Config API)

```bash
cisco-ucce call-type list
cisco-ucce call-type get <id>
```

### Precision Queue Commands (Config API)

```bash
cisco-ucce precision-queue list
cisco-ucce precision-queue get <id>
```

### Team Commands (Config API)

```bash
cisco-ucce team list
cisco-ucce team get <id>
```

### Attribute Commands (Config API)

```bash
cisco-ucce attribute list
cisco-ucce attribute get <id>
```

### Call Variable Commands (Config API)

```bash
cisco-ucce call-variable list
cisco-ucce call-variable get <id>
```

### Media Routing Domain Commands (Config API)

```bash
cisco-ucce media-routing-domain list
cisco-ucce media-routing-domain get <id>
```

### Bucket Interval Commands (Config API)

```bash
cisco-ucce bucket-interval list
cisco-ucce bucket-interval get <id>
```

### Machine Inventory (Config API)

```bash
cisco-ucce inventory list
```

### Finesse Commands (Finesse API)

```bash
# Agent states
cisco-ucce finesse agents
cisco-ucce finesse agent <id>

# Queue stats
cisco-ucce finesse queues
cisco-ucce finesse queue <id>

# Active calls
cisco-ucce finesse dialogs
cisco-ucce finesse dialog <id>

# System info
cisco-ucce finesse system-info
```

### CVP Commands (CVP OAMP REST API)

```bash
cisco-ucce cvp version
cisco-ucce cvp properties
cisco-ucce cvp sync-status
```

### PG Diagnostic Commands (Diagnostic Portal API)

```bash
cisco-ucce pg diagnostics
cisco-ucce pg diagnostics --server pg-a1.prod.local
```

### VVB Commands (VVB Admin API)

```bash
cisco-ucce vvb active-calls
cisco-ucce vvb active-calls --server vvb1a.lab.local
cisco-ucce vvb stats
```

### LiveData Commands (LiveData REST API)

```bash
cisco-ucce livedata stats
cisco-ucce livedata stats --server ld1a.lab.local
```

Note: LiveData endpoints need exploration on the lab (port 12005). Socket.IO streaming available on port 12008 for future real-time watch features.

### Status Command (Status API)

```bash
cisco-ucce status
cisco-ucce status --verbose
```

### Config Commands

```bash
cisco-ucce config add <name> --aw <host> --finesse <host> --username <u> --password <p> [--insecure]
cisco-ucce config add <name> --aw <host> --finesse <host> --cvp <hosts> --pg <hosts> --vvb <hosts> --username <u> --password <p>
cisco-ucce config use <name>
cisco-ucce config list
cisco-ucce config show
cisco-ucce config remove <name>
cisco-ucce config test
```

### Doctor Command

```bash
cisco-ucce doctor
```

Checks across all configured servers:
1. Configuration — cluster config present
2. AW connectivity — hit Status API
3. Finesse — hit `/finesse/api/SystemInfo`
4. CVP — hit `/cvp-config/version` on each CVP server
5. PG — hit Diagnostic Portal on each PG
6. VVB — hit `/adminapi/vvbStats/activeCalls` on each VVB
7. LiveData — hit REST API on port 12005 on each LiveData server
8. Config file permissions (600)
9. Audit trail size

## Global Flags

```
--format table|json|toon|csv    (default: table)
--host <host>                   (override AW host)
--username <user>               (override config)
--password <pass>               (override config)
--cluster <name>                (use specific cluster)
--side <a|b>                    (target side A or B, default: a)
--insecure                      (skip TLS verification)
--no-audit                      (disable audit logging)
--debug                         (enable debug logging)
```

## XML Response Parsing

UCCE APIs return XML. We parse with xml2js and flatten:

```xml
<agents>
  <agent>
    <refURL>/unifiedconfig/config/agent/5000</refURL>
    <userName>jdoe@lab.local</userName>
    <firstName>John</firstName>
  </agent>
</agents>
```

Extract ID from refURL, flatten to JSON for table output.

## File Structure

```
cisco-ucce/
├── bin/
│   └── cisco-ucce.js
├── cli/
│   ├── index.js
│   ├── commands/
│   │   ├── config.js
│   │   ├── agent.js
│   │   ├── skill-group.js
│   │   ├── call-type.js
│   │   ├── precision-queue.js
│   │   ├── team.js
│   │   ├── attribute.js
│   │   ├── call-variable.js
│   │   ├── media-routing-domain.js
│   │   ├── bucket-interval.js
│   │   ├── inventory.js
│   │   ├── status.js
│   │   ├── finesse.js
│   │   ├── cvp.js
│   │   ├── pg.js
│   │   ├── vvb.js
│   │   ├── livedata.js
│   │   └── doctor.js
│   ├── formatters/
│   │   ├── table.js
│   │   ├── json.js
│   │   ├── toon.js
│   │   └── csv.js
│   └── utils/
│       ├── config.js          # Multi-cluster, side A/B, ss-cli
│       ├── connection.js      # Auth precedence, server resolution
│       ├── api.js             # HTTP client, XML parsing, Basic Auth
│       ├── audit.js           # JSONL audit trail
│       └── output.js          # Format dispatch
├── skills/
│   └── cisco-ucce-cli/
│       └── SKILL.md
├── .github/
│   └── workflows/
│       └── release.yml
├── package.json
└── README.md
```

## Dependencies

| Package | Purpose |
|---|---|
| `commander` | CLI framework |
| `cli-table3` | Table output |
| `@toon-format/toon` | TOON output |
| `csv-stringify` | CSV output |
| `axios` | HTTP client |
| `xml2js` | XML response parsing |
| `update-notifier` | Version check |

## Audit Trail

`~/.cisco-ucce/audit.jsonl` — same pattern. Never logs credentials. 10MB rotation.
