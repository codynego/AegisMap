# AegisMap Backend API Guide

## Auth

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`

Authentication:

- session auth
- token auth with `Authorization: Token <token>`

## Core Resources

- `signals`
- `signal-evidence`
- `signal-ingestion-jobs`
- `signal-analytics/overview`
- `signal-clusters`
- `patterns`
- `incidents`
- `watch-zones`
- `risk-snapshots`
- `risk-forecasts`
- `geofences`
- `alerts`
- `alert-rules`
- `users`
- `user-profiles`
- `source-profiles`
- `audit-events`
- `patrol-uploads`
- `media-assets`

## Workflow Actions

### Signals

- `POST /api/signals/{id}/reassess/`
- `POST /api/signals/{id}/dismiss/`

### Ingestion

- `POST /api/signal-ingestion-jobs/`
- `GET /api/signal-ingestion-jobs/`
- `GET /api/signal-analytics/overview/`

### Patterns

- `POST /api/patterns/{id}/promote/`
- `POST /api/patterns/{id}/resolve/`

### Incidents

- `POST /api/incidents/{id}/monitor/`
- `POST /api/incidents/{id}/resolve/`

### Watch Zones

- `POST /api/watch-zones/{id}/evaluate/`

### Risk Forecasting

- `GET /api/risk-forecasts/`

#### Risk Forecasts

- `GET /api/risk-forecasts/` — Returns a short list of pattern-based risk forecasts computed from recent signals, incidents, and watch-zone context.
	- Query params:
		- `limit` (int) — maximum number of forecasts to return (default: 12)
		- `category` (string) — filter by forecast category (e.g., `emerging_hotspot`)
		- `min_confidence` (int) — filter forecasts with `confidence` >= value (0-100)
		- `latitude`, `longitude`, `radius_km` — optional geographic filter around a center point
	- Response: JSON array of forecasts with fields:
		- `id`, `cluster_name`, `category`, `level`, `probability` (0-100), `confidence` (0-100), `window`, `latitude`, `longitude`, `summary`, `rationale`, `timing_note`, and additional metadata.

#### Weather Intelligence

- `POST /api/weather-intelligence/` — Query weather-based context for a set of points, watch zones, or a route path.
	- Payload example:

```json
{
	"points": [{ "latitude": 9.0579, "longitude": 7.4898 }],
	"watch_zones": [],
	"route_path": []
}
```

	- Response: JSON object containing `overlays`, `incident_contexts`, `alerts`, and `route` information suitable for rendering weather overlays and advisories.
	- Notes: This endpoint calls an external weather provider configured via `WEATHER_INTELLIGENCE_BASE_URL` and may return 503 if the provider is unavailable.

### Alerts

- `POST /api/alerts/{id}/acknowledge/`
- `POST /api/alerts/{id}/resolve/`

## OpenAPI

- `GET /api/health/`
- `GET /api/schema/`
- `GET /api/docs/summary/`
- `GET /api/dashboard/summary/`

## Deployment Database Modes

### Local Development

- `DATABASE_BACKEND=sqlite`

### Production / Spatial Workloads

- `DATABASE_BACKEND=postgis`

When `postgis` is enabled, Django uses the PostGIS backend and loads `django.contrib.gis`.

## Bootstrap Utilities

- `python manage.py bootstrap_alert_rules`
- `python manage.py import_geofences bemis /path/to/schools.csv`
- `python manage.py import_geofences grid3_settlements /path/to/settlements.geojson`
- `python manage.py import_geofences grid3_settlement_extents /path/to/settlement_extents.geojson`
- `python manage.py import_geofences grid3_roads /path/to/roads.geojson`
- `python manage.py import_geofences osm /path/to/osm_export.geojson --dry-run`

## Async Processing

Celery entrypoint:

- `celery -A config worker -l info`

Set `USE_ASYNC_TASKS=True` to queue signal and ingestion processing through Celery.
