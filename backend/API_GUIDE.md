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

## Async Processing

Celery entrypoint:

- `celery -A config worker -l info`

Set `USE_ASYNC_TASKS=True` to queue signal and ingestion processing through Celery.
