from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.geofences.models import GeofenceStatus, GeofenceType
from apps.geofences.services import DATASET_PRESETS, import_geofences_from_dataset


class Command(BaseCommand):
    help = (
        "Import geofences from CSV or GeoJSON datasets such as BEMIS schools, "
        "GRID3 settlements, GRID3 health facilities, or OpenStreetMap exports."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "dataset",
            choices=sorted(DATASET_PRESETS.keys()),
            help="Dataset preset to use when inferring geofence type and default radius.",
        )
        parser.add_argument(
            "file_path",
            help="Path to a CSV or GeoJSON file on disk.",
        )
        parser.add_argument(
            "--geofence-type",
            choices=[choice for choice, _ in GeofenceType.choices],
            help="Override the geofence type for every imported record.",
        )
        parser.add_argument(
            "--radius-meters",
            type=int,
            help="Override the default radius for every imported record.",
        )
        parser.add_argument(
            "--status",
            choices=[choice for choice, _ in GeofenceStatus.choices],
            default=GeofenceStatus.ACTIVE,
            help="Status to apply to imported records. Defaults to active.",
        )
        parser.add_argument(
            "--name-field",
            help="Optional CSV/JSON field name to use as the geofence name.",
        )
        parser.add_argument(
            "--latitude-field",
            help="Optional field name for latitude when importing tabular data.",
        )
        parser.add_argument(
            "--longitude-field",
            help="Optional field name for longitude when importing tabular data.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate the file and show counts without writing records.",
        )
        parser.add_argument(
            "--no-update",
            action="store_true",
            help="Create new rows only and do not update existing records with the same name and type.",
        )

    def handle(self, *args, **options):
        file_path = Path(options["file_path"])
        try:
            summary = import_geofences_from_dataset(
                options["dataset"],
                file_path,
                geofence_type=options.get("geofence_type"),
                radius_meters=options.get("radius_meters"),
                status=options["status"],
                name_field=options.get("name_field"),
                latitude_field=options.get("latitude_field"),
                longitude_field=options.get("longitude_field"),
                dry_run=options["dry_run"],
                update_existing=not options["no_update"],
            )
        except (FileNotFoundError, ValueError) as exc:
            raise CommandError(str(exc)) from exc

        mode = "dry-run import" if options["dry_run"] else "import"
        self.stdout.write(
            self.style.SUCCESS(
                f"Geofence {mode} complete for '{summary['dataset']}': "
                f"{summary['created']} created, {summary['updated']} updated, {summary['skipped']} skipped."
            )
        )

        if summary["errors"]:
            self.stdout.write(self.style.WARNING("Skipped rows:"))
            for error in summary["errors"]:
                self.stdout.write(f"- {error}")
