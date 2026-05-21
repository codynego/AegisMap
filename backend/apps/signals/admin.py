from django.contrib import admin

from .models import Signal, SignalEvidence


admin.site.register(Signal)
admin.site.register(SignalEvidence)
