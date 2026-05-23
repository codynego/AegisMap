from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="role",
            field=models.CharField(
                choices=[
                    ("regular_user", "Regular User"),
                    ("community_reporter", "Community Reporter"),
                    ("trusted_verifier", "Trusted Verifier"),
                    ("analyst", "Analyst"),
                    ("admin", "Admin"),
                ],
                default="regular_user",
                max_length=32,
            ),
        ),
    ]
