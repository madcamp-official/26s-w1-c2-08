from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0004_item_category_item_items_item_recomme_c8c8f5_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="image_file",
            field=models.ImageField(blank=True, null=True, upload_to="items/"),
        ),
    ]
