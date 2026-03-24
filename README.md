# Cisco UCCE CLI

[![npm version](https://img.shields.io/npm/v/cisco-ucce.svg)](https://www.npmjs.com/package/cisco-ucce)
[![CI](https://github.com/sieteunoseis/cisco-ucce/actions/workflows/release.yml/badge.svg)](https://github.com/sieteunoseis/cisco-ucce/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/cisco-ucce.svg)](https://nodejs.org)
[![Skills](https://img.shields.io/badge/skills.sh-cisco--ucce--cli-blue)](https://skills.sh/sieteunoseis/cisco-ucce)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-orange?logo=buy-me-a-coffee)](https://buymeacoffee.com/automatebldrs)

Read-only CLI for monitoring and troubleshooting Cisco Unified Contact Center Enterprise (UCCE) 12.6. Covers 5 API services across the full UCCE solution stack.

| API                   | What you can do                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| **AW Config/Status**  | Agents, skill groups, call types, precision queues, teams, inventory, system status             |
| **Finesse**           | Live agent states, queue stats with sparklines, teams, reason codes                             |
| **CVP**               | Version, server topology, call server properties                                                |
| **Diagnostic Portal** | Processes, services, alarms, traces, logs, performance — across PGs, Routers, AW, CUIC, Finesse |
| **VVB**               | Active calls with sparkline monitoring                                                          |

## Installation

```bash
npm install -g cisco-ucce
```

Or run without installing:

```bash
npx cisco-ucce --help
```

### AI Agent Skills

```bash
npx skills add sieteunoseis/cisco-ucce
```

## Requirements

- Node.js >= 18
- Network access to UCCE infrastructure (AW, Finesse, CVP, PG, VVB servers)
- HTTP Basic Auth credentials for each API service
- Self-signed certificates are common — use the `--insecure` flag

## Quick Start

```bash
# 1. Add a cluster
cisco-ucce config add prod

# 2. Edit the config with your hosts and credentials
#    Config location: ~/.cisco-ucce/config.json
cisco-ucce config show

# 3. Test connectivity
cisco-ucce config test

# 4. Run a health check
cisco-ucce doctor
```

## Cluster Configuration

The config file at `~/.cisco-ucce/config.json` (0600 permissions) groups servers by API service with per-service credentials:

```json
{
  "activeCluster": "prod",
  "clusters": {
    "prod": {
      "aw": {
        "hosts": ["aw-a.example.com", "aw-b.example.com"],
        "username": "<your-aw-user>",
        "password": "<your-password>"
      },
      "finesse": {
        "hosts": ["fin-a.example.com", "fin-b.example.com"],
        "username": "<your-finesse-user>",
        "password": "..."
      },
      "cvpOps": {
        "host": "cvpops.example.com",
        "port": 8111,
        "username": "<your-cvp-api-user>",
        "password": "..."
      },
      "cvpCallServers": {
        "hosts": ["cvp1a.example.com", "cvp1b.example.com"],
        "port": 8111
      },
      "diagnosticPortal": {
        "hosts": [
          { "host": "pg1a.example.com", "port": 7890 },
          { "host": "pg1b.example.com", "port": 7890 },
          { "host": "rgr-a.example.com", "port": 7890 },
          { "host": "aw-a.example.com", "port": 8443 },
          { "host": "cuic-a.example.com", "port": 8443 }
        ],
        "username": "<domain\\your-admin-user>",
        "password": "..."
      },
      "vvb": {
        "hosts": ["vvb1a.example.com", "vvb1b.example.com"],
        "username": "<your-vvb-user>",
        "password": "..."
      },
      "insecure": true
    }
  }
}
```

**Auth precedence:** CLI flags > env vars (`CISCO_UCCE_USERNAME` / `CISCO_UCCE_PASSWORD`) > config file.

**ss-cli integration (optional):** Passwords containing `<ss:ID:field>` placeholders are resolved at runtime via [ss-cli](https://github.com/sieteunoseis/ss-cli) if installed.

**CVP call servers** use AW credentials for the `/cvp-orm/rest/` API.

## Commands

### System Health

```bash
# Health check across all services
cisco-ucce doctor

# AW system-wide status (all components, connections, credentials)
cisco-ucce status
```

### Agent & Queue Monitoring

```bash
# All Finesse agent states
cisco-ucce finesse users

# Live queue stats by ID
cisco-ucce finesse queue 205001

# Live queue monitoring with sparklines (polls every 5s)
cisco-ucce finesse queue 205001 --watch
cisco-ucce finesse queue 205001 --watch 10   # custom interval

# Teams, reason codes, wrap-up reasons
cisco-ucce finesse teams
cisco-ucce finesse reason-codes --category NOT_READY
cisco-ucce finesse wrapup-reasons
cisco-ucce finesse phonebooks
```

### AW Configuration

All AW config resources support `list` and `get <id>`:

```bash
cisco-ucce agent list
cisco-ucce agent get 5000
cisco-ucce skillgroup list
cisco-ucce calltype list
cisco-ucce precisionqueue list
cisco-ucce attribute list
cisco-ucce expandedcallvariable list
cisco-ucce mediaroutingdomain list
cisco-ucce bucketinterval list
cisco-ucce dialednumber list
cisco-ucce peripheralgateway list
cisco-ucce department list              # list only, no get
cisco-ucce inventory list               # full machine inventory
cisco-ucce inventory get 5000
cisco-ucce agentteam list
```

Pagination: `--page N --page-size N`. Without these flags, auto-paginates all records.

### CVP

```bash
cisco-ucce cvp version                          # CVP version info
cisco-ucce cvp servers                           # All CVP nodes and roles
cisco-ucce cvp properties --host cvp1a.example.com  # Call server config
```

### Diagnostic Portal

Runs on PGs (port 7890), Routers (port 7890), AW/CUIC/Finesse (port 8443). Use `--host` to target a specific server, `--host all` for all configured hosts.

```bash
# Server health
cisco-ucce diag list-processes --host pg1a.example.com
cisco-ucce diag list-services --host pg1a.example.com
cisco-ucce diag version --host all
cisco-ucce diag alarms --host all

# Network
cisco-ucce diag netstat --host pg1a.example.com
cisco-ucce diag ipconfig --host pg1a.example.com --args "/all"
cisco-ucce diag traceroute --host pg1a.example.com
cisco-ucce diag ping --host pg1a.example.com

# Performance
cisco-ucce diag perf --host pg1a.example.com
cisco-ucce diag perf-counter --host pg1a.example.com

# Trace & log collection
cisco-ucce diag trace-components --host pg1a.example.com
cisco-ucce diag trace-files "Peripheral Gateway 1A/opc" --hours 24
cisco-ucce diag download-trace "Peripheral Gateway 1A/opc" "trace-file.zip" -o ./traces/

cisco-ucce diag log-components --host pg1a.example.com
cisco-ucce diag log-files "EventLog" --hours 12
cisco-ucce diag download-log "EventLog" "System.evtx.xml" -o ./logs/

# Configuration
cisco-ucce diag config-categories --host pg1a.example.com
cisco-ucce diag config-category "Category Name" --host pg1a.example.com
cisco-ucce diag license --host pg1a.example.com
```

### VVB

```bash
cisco-ucce vvb active-calls                      # First VVB
cisco-ucce vvb active-calls --host all           # All VVBs
cisco-ucce vvb active-calls --watch              # Sparkline monitoring
```

### Config Management

```bash
cisco-ucce config add <name>      # Create skeleton config
cisco-ucce config use <name>      # Switch active cluster
cisco-ucce config list            # Show all clusters
cisco-ucce config show            # Show active cluster config
cisco-ucce config remove <name>   # Delete a cluster
cisco-ucce config test            # Test connectivity
```

## Global Flags

| Flag                | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `--format <fmt>`    | Output format: `table` (default), `json`, `toon`, `csv` |
| `--host <host>`     | Override target host                                    |
| `--username <user>` | Override config username                                |
| `--password <pass>` | Override config password                                |
| `--cluster <name>`  | Use specific cluster                                    |
| `--insecure`        | Skip TLS verification                                   |
| `--no-audit`        | Disable audit logging                                   |
| `--debug`           | Enable debug logging                                    |

## Output Formats

```bash
# Table (default)
cisco-ucce finesse teams

# JSON (pipe-friendly)
cisco-ucce agent list --format json | jq '.[] | select(.agentTeamName == "Sales")'

# CSV (spreadsheets, reporting)
cisco-ucce skillgroup list --format csv > skillgroups.csv

# Monitor queue depth
watch -n 30 'cisco-ucce finesse queue 205001 --format json | jq .callsInQueue'
```

## Audit Trail

All API calls are logged to `~/.cisco-ucce/audit.jsonl` (never logs credentials). 10MB auto-rotation.

## Giving Back

If you found this helpful, consider:

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/automatebldrs)

## License

MIT
