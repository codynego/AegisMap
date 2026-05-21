from django.contrib import admin

from .models import MediaAsset, PatrolUpload


admin.site.register(PatrolUpload)
admin.site.register(MediaAsset)
