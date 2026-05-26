# Ruflo integration

The `ruvnet/ruflo` repository has been cloned at:

```text
../ruflo
```

Ruflo is not a kiosk analytics data source. It is an agent orchestration, workflow, browser, and observability system. For this dashboard, Ruflo should sit around the live-only dashboard as an operations and QA layer.

## What is integrated

| Integration | File | Purpose |
|---|---|---|
| Observability bridge | `boilerplate/ruflo-observability-exporter.js` | Reads the live collector and emits a Ruflo-style `metric-snapshot` for the `observability` namespace. |
| Workflow template | `ruflo/live-dashboard-ops.workflow.json` | Defines a repeatable Ruflo workflow for collector checks, live-only audits, browser QA, and ops brief generation. |
| Local Ruflo source | `../ruflo` | Reference implementation and plugin source for workflows, browser sessions, observability, security, and agent orchestration. |

## Live-only boundary

Ruflo must not create dashboard metrics. It can:

- read the collector summary,
- store observability snapshots,
- run browser QA,
- coordinate agents for implementation and testing,
- report missing production feeds.

Ruflo must not:

- generate KPI values,
- backfill missing store, brand, payment, OMS, or device data,
- inject sample events into the dashboard,
- treat test events as production performance.

## Run the bridge

Start the collector first:

```bash
node fynd_kiosk_dashboard/boilerplate/realtime-event-server.js
```

Export the current live collector state:

```bash
node fynd_kiosk_dashboard/boilerplate/ruflo-observability-exporter.js
```

With a remote collector:

```bash
COLLECTOR_URL=https://collector.example.com node fynd_kiosk_dashboard/boilerplate/ruflo-observability-exporter.js
```

## Ruflo plugins that match this project

| Ruflo plugin | Project use |
|---|---|
| `ruflo-observability` | Store and inspect live dashboard metrics, event-rate health, API latency, failure count, and queue depth. |
| `ruflo-workflows` | Run repeatable operational checks around dashboard readiness and demo safety. |
| `ruflo-browser` | Record/replay dashboard browser QA, console-error checks, and screenshot regression checks. |
| `ruflo-security-audit` / `ruflo-aidefence` | Keep captured journey/API data masked and block PII leakage in specs. |
| `ruflo-docs` | Keep specs current as real endpoints and event contracts evolve. |

## Notes from local clone

- `gh` is not installed in this environment, so the repo was cloned with `git clone --depth 1 --filter=blob:none https://github.com/ruvnet/ruflo.git`.
- Ruflo checkout completed with case-collision warnings for duplicate `SKILL.md` and `skill.md` paths on macOS case-insensitive filesystems.
- The local Ruflo CLI source is not built yet; direct `node ruflo/bin/cli.js --help` expects built `dist` files. Use the cloned plugin/docs as integration source, or install/build Ruflo before running its CLI.
- Local smoke checks:
  - `ruflo-browser`: 13 passed, 0 failed.
  - `ruflo-workflows`: 10 passed, 1 failed because the cloned ADR status is `Accepted` while the smoke script expects `Proposed`.
  - `ruflo-observability`: 9 passed, 1 failed for the same ADR status expectation.
