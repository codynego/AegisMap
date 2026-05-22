from django.db import migrations, models


LEGACY_INCIDENT_TYPE_MAP = {
    "threat_activity": "suspicious_activity",
    "violence": "gunshots_heard",
    "road_blockade": "road_obstruction",
    "fire": "fire_outbreak",
    "flood": "flooding",
    "other": "suspicious_activity",
}


def forwards(apps, schema_editor):
    Incident = apps.get_model("incidents", "Incident")
    for old_value, new_value in LEGACY_INCIDENT_TYPE_MAP.items():
        Incident.objects.filter(incident_type=old_value).update(incident_type=new_value)


def backwards(apps, schema_editor):
    Incident = apps.get_model("incidents", "Incident")
    reverse_map = {}
    for old_value, new_value in LEGACY_INCIDENT_TYPE_MAP.items():
        reverse_map.setdefault(new_value, old_value)
    for new_value, old_value in reverse_map.items():
        Incident.objects.filter(incident_type=new_value).update(incident_type=old_value)


class Migration(migrations.Migration):
    dependencies = [
        ("incidents", "0002_initial"),
        ("signals", "0003_update_signal_categories"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="incident",
            name="incident_type",
            field=models.CharField(
                choices=[
                    ("suspicious_activity", "Suspicious Activity"),
                    ("road_accident", "Road Accident"),
                    ("armed_robbery", "Armed Robbery"),
                    ("kidnapping", "Kidnapping"),
                    ("fire_outbreak", "Fire Outbreak"),
                    ("road_obstruction", "Road Obstruction"),
                    ("flooding", "Flooding"),
                    ("medical_emergency", "Medical Emergency"),
                    ("gunshots_heard", "Gunshots Heard"),
                    ("unsafe_route", "Unsafe Route"),
                ],
                default="suspicious_activity",
                max_length=32,
            ),
        ),
    ]
