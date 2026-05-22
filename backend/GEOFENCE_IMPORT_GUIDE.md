# Geofence Import Guide

Use the `import_geofences` management command to bulk-load geofences from trusted datasets.

## Supported dataset presets

- `bemis`
  Creates `school` geofences with a default radius of `2000m`.
- `grid3_settlements`
  Creates `village` geofences with a default radius of `1500m`.
- `grid3_settlement_extents`
  Creates `village` geofences with a default radius of `1500m`.
- `grid3_health`
  Creates `facility` geofences with a default radius of `2000m`.
- `grid3_roads`
  Creates `highway` geofences with a default radius of `2500m`.
- `osm`
  Infers geofence type from OSM-style fields such as `amenity`, `place`, `highway`, and `man_made`.
- `custom`
  Creates `custom` geofences unless you override the type.

## Expected input formats

- `CSV`
  Good for tabular exports from BEMIS or cleaned spreadsheets.
- `GeoJSON` / `JSON FeatureCollection`
  Good for OSM exports and most GRID3 vector layers.

The importer looks for common name and coordinate fields automatically:

- names: `name`, `school_name`, `facility_name`, `settlement_name`, `title`
- latitude: `centroid_latitude`, `latitude`, `lat`, `y`
- longitude: `centroid_longitude`, `longitude`, `lng`, `lon`, `x`

For GeoJSON, if no explicit latitude/longitude fields exist, the importer derives the centroid from the feature geometry and stores the geometry in the geofence `boundary` field.

## Command examples

```bash
python manage.py import_geofences bemis data/bemis_schools.csv
python manage.py import_geofences grid3_settlements data/grid3_settlements.geojson
python manage.py import_geofences grid3_settlement_extents data/grid3_settlement_extents.geojson
python manage.py import_geofences grid3_health data/grid3_health_facilities.geojson
python manage.py import_geofences grid3_roads data/grid3_roads.geojson
python manage.py import_geofences osm data/osm_corridors.geojson --dry-run
python manage.py import_geofences custom data/checkpoints.csv --geofence-type facility --radius-meters 1000
```

## Useful flags

- `--dry-run`
  Validate the file and preview counts without writing to the database.
- `--geofence-type`
  Force every imported row to a specific type.
- `--radius-meters`
  Override the default radius for every imported row.
- `--name-field`
  Use a custom field name for geofence names.
- `--latitude-field` / `--longitude-field`
  Use custom coordinate field names for CSV-style imports.
- `--no-update`
  Create only new records instead of updating records that match by `name + geofence_type`.

## Recommended operational workflow

1. Load schools from BEMIS.
2. Load settlements and roads from GRID3.
3. Enrich missing schools, facilities, and corridors from OSM exports.
4. Run with `--dry-run` first for every new dataset.
5. Review imported geofences on the Live Intelligence map before enabling alert actions broadly.
