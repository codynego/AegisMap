from django.contrib import admin

from .models import Alert, AlertRule


admin.site.register(AlertRule)
admin.site.register(Alert)
