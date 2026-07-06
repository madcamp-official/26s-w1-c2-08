from django.db import migrations


def backfill_description(apps, schema_editor):
    Item = apps.get_model("items", "Item")
    Review = apps.get_model("reviews", "Review")

    for item in Item.objects.filter(description=""):
        registration_review = (
            Review.objects.filter(item_id=item.id)
            .order_by("created_at")
            .first()
        )

        if registration_review is None:
            continue

        item.description = registration_review.content
        item.save(update_fields=["description"])
        registration_review.delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0003_item_description"),
        ("reviews", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(backfill_description, noop_reverse),
    ]
