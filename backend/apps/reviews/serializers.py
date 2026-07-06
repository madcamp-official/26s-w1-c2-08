from rest_framework import serializers

from .models import Review, ReviewComment, ReviewCommentReaction, ReviewReaction


class ReviewSerializer(serializers.ModelSerializer):
    comments_count = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "item",
            "author",
            "title",
            "content",
            "like_count",
            "dislike_count",
            "comments_count",
            "user_reaction",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "like_count",
            "dislike_count",
            "comments_count",
            "user_reaction",
            "created_at",
            "updated_at",
        )

    def get_user_reaction(self, obj):
        user_id = self.context.get("user_id")
        if not user_id:
            return None

        reaction = obj.reactions.filter(user_id=user_id).first()
        if reaction is None:
            return None
        return reaction.reaction

    def get_comments_count(self, obj):
        return obj.comments.count()


class ReviewCommentSerializer(serializers.ModelSerializer):
    user_reaction = serializers.SerializerMethodField()

    class Meta:
        model = ReviewComment
        fields = (
            "id",
            "review",
            "author",
            "content",
            "like_count",
            "dislike_count",
            "user_reaction",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "review",
            "like_count",
            "dislike_count",
            "user_reaction",
            "created_at",
            "updated_at",
        )

    def get_user_reaction(self, obj):
        user_id = self.context.get("user_id")
        if not user_id:
            return None

        reaction = obj.reactions.filter(user_id=user_id).first()
        if reaction is None:
            return None
        return reaction.reaction


class ReviewCreateSerializer(serializers.ModelSerializer):
    user_id = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Review
        fields = ("item", "user_id", "title", "content")

    def validate(self, attrs):
        if self.instance is None:
            item = attrs.get("item")
            author = self._resolve_author(attrs.get("user_id"))

            if item is not None:
                if item.created_by_id == author.id:
                    raise serializers.ValidationError(
                        {"detail": "본인이 등록한 아이템에는 리뷰를 작성할 수 없습니다."}
                    )

                if Review.objects.filter(item=item, author=author).exists():
                    raise serializers.ValidationError(
                        {"detail": "이미 이 아이템에 리뷰를 작성했습니다."}
                    )

        return attrs

    def create(self, validated_data):
        validated_data["author"] = self._resolve_author(validated_data.pop("user_id", None))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("user_id", None)
        return super().update(instance, validated_data)

    def _resolve_author(self, user_id):
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            return request.user

        if not user_id:
            raise serializers.ValidationError({"user_id": ["This field is required."]})

        return self._get_user(user_id)

    def _get_user(self, user_id):
        try:
            return self.Meta.model._meta.get_field("author").remote_field.model.objects.get(id=user_id)
        except self.Meta.model._meta.get_field("author").remote_field.model.DoesNotExist:
            raise serializers.ValidationError({"user_id": ["Invalid user_id."]})


class ReviewCommentCreateSerializer(serializers.ModelSerializer):
    user_id = serializers.CharField(write_only=True)

    class Meta:
        model = ReviewComment
        fields = ("user_id", "content")

    def create(self, validated_data):
        user_id = validated_data.pop("user_id")
        validated_data["author"] = self._get_user(user_id)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("user_id", None)
        return super().update(instance, validated_data)

    def _get_user(self, user_id):
        try:
            return self.Meta.model._meta.get_field("author").remote_field.model.objects.get(id=user_id)
        except self.Meta.model._meta.get_field("author").remote_field.model.DoesNotExist:
            raise serializers.ValidationError({"user_id": ["Invalid user_id."]})


class ReviewReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewReaction
        fields = (
            "id",
            "review",
            "user",
            "reaction",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "review", "user", "created_at", "updated_at")


class ReviewCommentReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewCommentReaction
        fields = (
            "id",
            "comment",
            "user",
            "reaction",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "comment",
            "user",
            "created_at",
            "updated_at",
        )


class ReviewReactionToggleSerializer(serializers.Serializer):
    user_id = serializers.CharField()
    reaction = serializers.ChoiceField(choices=ReviewReaction.Reaction.choices)


class ReviewCommentReactionToggleSerializer(serializers.Serializer):
    user_id = serializers.CharField()
    reaction = serializers.ChoiceField(choices=ReviewCommentReaction.Reaction.choices)
