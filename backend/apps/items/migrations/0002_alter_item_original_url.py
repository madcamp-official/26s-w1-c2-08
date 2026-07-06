from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="item",
            name="original_url",
            field=models.URLField(blank=True, null=True, unique=True),
        ),
    ]
