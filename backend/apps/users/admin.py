from django.contrib import admin

from .models import SourceProfile, UserProfile


admin.site.register(UserProfile)
admin.site.register(SourceProfile)
