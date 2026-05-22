import json
from pathlib import Path
from uuid import uuid4

from django.test import TestCase

from apps.geofences.models import Geofence, GeofenceType
from apps.geofences.services import import_geofences_from_dataset


class GeofenceImportServiceTests(TestCase):
    def make_temp_file(self, suffix: str, contents: str) -> Path:
        temp_dir = Path(__file__).resolve().parent / "_testdata"
        temp_dir.mkdir(exist_ok=True)
        path = temp_dir / f"{uuid4().hex}{suffix}"
        path.write_text(contents, encoding="utf-8")
        self.addCleanup(lambda: path.exists() and path.unlink())
        return path

    def test_import_bemis_csv_creates_school_geofences(self):
        csv_path = self.make_temp_file(
            ".csv",
            "school_name,latitude,longitude,description\n"
            "Government Primary School,9.0765,7.3986,School near city gate\n",
        )

        summary = import_geofences_from_dataset("bemis", csv_path)

        self.assertEqual(summary["created"], 1)
        geofence = Geofence.objects.get(name="Government Primary School")
        self.assertEqual(geofence.geofence_type, GeofenceType.SCHOOL)
        self.assertEqual(geofence.radius_meters, 2000)
        self.assertEqual(geofence.metadata["import_dataset"], "bemis")

    def test_import_osm_geojson_infers_highway_and_stores_geometry(self):
        geojson_path = self.make_temp_file(
            ".geojson",
            json.dumps(
                {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "properties": {
                                "name": "Lekki-Epe Expressway",
                                "highway": "primary",
                                "description": "Major monitored corridor",
                            },
                            "geometry": {
                                "type": "LineString",
                                "coordinates": [
                                    [3.5000, 6.4500],
                                    [3.6000, 6.4700],
                                ],
                            },
                        }
                    ],
                }
            ),
        )

        summary = import_geofences_from_dataset("osm", geojson_path)

        self.assertEqual(summary["created"], 1)
        geofence = Geofence.objects.get(name="Lekki-Epe Expressway")
        self.assertEqual(geofence.geofence_type, GeofenceType.HIGHWAY)
        self.assertEqual(geofence.radius_meters, 2500)
        self.assertEqual(geofence.boundary["type"], "LineString")
        self.assertIsNotNone(geofence.centroid_latitude)
        self.assertIsNotNone(geofence.centroid_longitude)

    def test_dry_run_does_not_write_records(self):
        csv_path = self.make_temp_file(
            ".csv",
            "name,lat,lng\n"
            "Kachia Village,10.0000,7.9000\n",
        )

        summary = import_geofences_from_dataset("grid3_settlements", csv_path, dry_run=True)

        self.assertEqual(summary["created"], 1)
        self.assertEqual(Geofence.objects.count(), 0)
