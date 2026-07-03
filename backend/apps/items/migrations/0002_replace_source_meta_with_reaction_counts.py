from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="item",
            name="rating",
        ),
        migrations.RemoveField(
            model_name="item",
            name="review_count",
        ),
        migrations.AddField(
            model_name="item",
            name="not_recommend_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="item",
            name="recommend_count",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
