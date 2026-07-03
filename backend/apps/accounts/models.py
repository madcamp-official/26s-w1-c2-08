from django.db import models

class User(models.Model):
    id = models.CharField(max_length=30, primary_key=True)
    password = models.CharField(max_length=128)

    def __str__(self):
        return self.id
