from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0007_merge_20260704_1229"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="item",
            name="items_item_recomme_c8c8f5_idx",
        ),
        migrations.RemoveIndex(
            model_name="item",
            name="items_item_categor_c3d8aa_idx",
        ),
        migrations.RemoveField(
            model_name="item",
            name="recommend_count",
        ),
        migrations.DeleteModel(
            name="ItemReaction",
        ),
    ]
