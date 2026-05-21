from django.contrib import admin

from .models import RiskSnapshot, WatchZone


admin.site.register(WatchZone)
admin.site.register(RiskSnapshot)
