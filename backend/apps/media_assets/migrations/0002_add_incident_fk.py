# Generated migration to add incident FK to PatrolUpload
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('media_assets', '0001_initial'),
        ('incidents', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='patrolupload',
            name='incident',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='patrol_uploads', to='incidents.incident'),
        ),
    ]
