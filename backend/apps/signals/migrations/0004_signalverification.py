from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("signals", "0003_update_signal_categories"),
    ]

    operations = [
        migrations.CreateModel(
            name="SignalVerification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("response", models.CharField(choices=[("confirm", "Confirm"), ("deny", "Deny"), ("unsure", "Unsure")], max_length=16)),
                ("weight", models.DecimalField(decimal_places=2, default=1, max_digits=6)),
                ("distance_meters", models.PositiveIntegerField(blank=True, null=True)),
                ("note", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("signal", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="verification_events", to="signals.signal")),
                ("source_profile", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="verification_events", to="users.sourceprofile")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="signal_verifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="signalverification",
            constraint=models.UniqueConstraint(fields=("signal", "user"), name="unique_signal_verification_per_user"),
        ),
    ]
