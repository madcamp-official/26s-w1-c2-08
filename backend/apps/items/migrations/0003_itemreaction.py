import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0002_replace_source_meta_with_reaction_counts"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ItemReaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reaction", models.CharField(choices=[("recommend", "Recommend"), ("not_recommend", "Not Recommend")], max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reactions", to="items.item")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="item_reactions", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-updated_at", "-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="itemreaction",
            constraint=models.UniqueConstraint(fields=("item", "user"), name="unique_item_reaction_per_user"),
        ),
    ]
