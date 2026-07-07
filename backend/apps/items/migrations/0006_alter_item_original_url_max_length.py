from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0005_item_change_request"),
    ]

    operations = [
        migrations.AlterField(
            model_name="item",
            name="original_url",
            field=models.URLField(max_length=2048, blank=True, null=True, unique=True),
        ),
    ]
