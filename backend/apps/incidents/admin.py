from django.contrib import admin

from .models import Incident, Pattern, SignalCluster


admin.site.register(SignalCluster)
admin.site.register(Pattern)
admin.site.register(Incident)
