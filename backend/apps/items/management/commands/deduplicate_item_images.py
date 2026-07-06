from pathlib import Path
from uuid import uuid4

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.items.models import Item


class Command(BaseCommand):
    help = "Split shared item image_file paths into unique files per item."

    def handle(self, *args, **options):
        duplicate_groups = (
            Item.objects.exclude(image_file="")
            .exclude(image_file__isnull=True)
            .values("image_file")
            .annotate(item_count=Count("id"))
            .filter(item_count__gt=1)
        )

        rewritten_count = 0

        for group in duplicate_groups:
            shared_path = group["image_file"]
            items = list(Item.objects.filter(image_file=shared_path).order_by("id"))
            if not default_storage.exists(shared_path):
                self.stdout.write(
                    self.style.WARNING(f"missing file skipped: {shared_path} ({len(items)} items)")
                )
                continue

            file_bytes = default_storage.open(shared_path, "rb").read()
            extension = Path(shared_path).suffix.lower() or ".png"

            for item in items:
                unique_path = default_storage.save(
                    f"items/{uuid4().hex}{extension}",
                    ContentFile(file_bytes),
                )
                item.image_file.name = unique_path
                item.save(update_fields=["image_file", "updated_at"])
                rewritten_count += 1
                self.stdout.write(f"item #{item.id} -> {unique_path}")

        if rewritten_count == 0:
            self.stdout.write(self.style.SUCCESS("no duplicated item images found"))
            return

        self.stdout.write(self.style.SUCCESS(f"rewrote {rewritten_count} item image references"))
