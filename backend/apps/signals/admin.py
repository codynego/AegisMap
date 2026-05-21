from django.contrib import admin

from .models import Signal, SignalEvidence, SignalIngestionJob


admin.site.register(Signal)
admin.site.register(SignalEvidence)
admin.site.register(SignalIngestionJob)
