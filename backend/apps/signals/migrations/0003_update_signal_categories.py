from django.db import migrations, models


LEGACY_CATEGORY_MAP = {
    "tip": "suspicious_activity",
    "suspicious_movement": "suspicious_activity",
    "abnormal_sighting": "suspicious_activity",
    "camp_indicator": "suspicious_activity",
    "road_threat": "unsafe_route",
    "fire_smoke": "fire_outbreak",
    "flood": "flooding",
    "violence": "gunshots_heard",
    "other": "suspicious_activity",
}


def forwards(apps, schema_editor):
    Signal = apps.get_model("signals", "Signal")
    for old_value, new_value in LEGACY_CATEGORY_MAP.items():
        Signal.objects.filter(category=old_value).update(category=new_value)


def backwards(apps, schema_editor):
    Signal = apps.get_model("signals", "Signal")
    reverse_map = {}
    for old_value, new_value in LEGACY_CATEGORY_MAP.items():
        reverse_map.setdefault(new_value, old_value)
    for new_value, old_value in reverse_map.items():
        Signal.objects.filter(category=new_value).update(category=old_value)


class Migration(migrations.Migration):
    dependencies = [
        ("signals", "0002_signalingestionjob"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="signal",
            name="category",
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
