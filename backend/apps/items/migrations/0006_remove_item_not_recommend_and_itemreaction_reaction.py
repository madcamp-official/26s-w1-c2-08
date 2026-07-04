from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0005_item_image_file"),
        ("items", "0005_star_star_unique_user_item_star"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="item",
            name="not_recommend_count",
        ),
        migrations.RemoveField(
            model_name="itemreaction",
            name="reaction",
        ),
    ]
