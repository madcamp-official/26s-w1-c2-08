from django.db import migrations


def rebuild_review_foreign_keys(apps, schema_editor):
    if schema_editor.connection.vendor != "sqlite":
        return

    cursor = schema_editor.connection.cursor()

    existing_tables = {
        row[0]
        for row in cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }

    required_tables = {
        "reviews_review",
        "reviews_reviewcomment",
        "reviews_reviewreaction",
        "reviews_reviewcommentreaction",
        "accounts_user",
        "items_item",
    }
    if not required_tables.issubset(existing_tables):
        return

    review_fk_targets = cursor.execute(
        "PRAGMA foreign_key_list(reviews_review)"
    ).fetchall()
    if any(target[2] == "accounts_user" for target in review_fk_targets):
        return

    auth_user_exists = "auth_user" in existing_tables
    if auth_user_exists:
        cursor.execute(
            """
            INSERT OR IGNORE INTO accounts_user (id, password, is_active, is_staff, is_superuser, last_login)
            SELECT username, password, is_active, is_staff, is_superuser, last_login
            FROM auth_user
            WHERE id IN (
                SELECT author_id FROM reviews_review
                UNION
                SELECT author_id FROM reviews_reviewcomment
                UNION
                SELECT user_id FROM reviews_reviewreaction
                UNION
                SELECT user_id FROM reviews_reviewcommentreaction
            )
            """
        )

    cursor.execute("PRAGMA foreign_keys = OFF")

    cursor.execute(
        """
        CREATE TABLE reviews_review_new (
            id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
            title varchar(255) NOT NULL,
            content text NOT NULL,
            like_count integer unsigned NOT NULL CHECK (like_count >= 0),
            dislike_count integer unsigned NOT NULL CHECK (dislike_count >= 0),
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            author_id varchar(30) NOT NULL REFERENCES accounts_user (id) DEFERRABLE INITIALLY DEFERRED,
            item_id bigint NOT NULL REFERENCES items_item (id) DEFERRABLE INITIALLY DEFERRED
        )
        """
    )

    if auth_user_exists:
        cursor.execute(
            """
            INSERT INTO reviews_review_new (
                id, title, content, like_count, dislike_count, created_at, updated_at, author_id, item_id
            )
            SELECT
                r.id, r.title, r.content, r.like_count, r.dislike_count, r.created_at, r.updated_at,
                au.username, r.item_id
            FROM reviews_review r
            JOIN auth_user au ON au.id = r.author_id
            """
        )
    else:
        cursor.execute(
            """
            INSERT INTO reviews_review_new (
                id, title, content, like_count, dislike_count, created_at, updated_at, author_id, item_id
            )
            SELECT
                id, title, content, like_count, dislike_count, created_at, updated_at, author_id, item_id
            FROM reviews_review
            """
        )

    cursor.execute(
        """
        CREATE TABLE reviews_reviewcomment_new (
            id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
            content text NOT NULL,
            like_count integer unsigned NOT NULL CHECK (like_count >= 0),
            dislike_count integer unsigned NOT NULL CHECK (dislike_count >= 0),
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            author_id varchar(30) NOT NULL REFERENCES accounts_user (id) DEFERRABLE INITIALLY DEFERRED,
            review_id bigint NOT NULL REFERENCES reviews_review (id) DEFERRABLE INITIALLY DEFERRED
        )
        """
    )

    if auth_user_exists:
        cursor.execute(
            """
            INSERT INTO reviews_reviewcomment_new (
                id, content, like_count, dislike_count, created_at, updated_at, author_id, review_id
            )
            SELECT
                c.id, c.content, c.like_count, c.dislike_count, c.created_at, c.updated_at,
                au.username, c.review_id
            FROM reviews_reviewcomment c
            JOIN auth_user au ON au.id = c.author_id
            """
        )
    else:
        cursor.execute(
            """
            INSERT INTO reviews_reviewcomment_new (
                id, content, like_count, dislike_count, created_at, updated_at, author_id, review_id
            )
            SELECT
                id, content, like_count, dislike_count, created_at, updated_at, author_id, review_id
            FROM reviews_reviewcomment
            """
        )

    cursor.execute(
        """
        CREATE TABLE reviews_reviewreaction_new (
            id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
            reaction varchar(20) NOT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            review_id bigint NOT NULL REFERENCES reviews_review (id) DEFERRABLE INITIALLY DEFERRED,
            user_id varchar(30) NOT NULL REFERENCES accounts_user (id) DEFERRABLE INITIALLY DEFERRED
        )
        """
    )

    if auth_user_exists:
        cursor.execute(
            """
            INSERT INTO reviews_reviewreaction_new (
                id, reaction, created_at, updated_at, review_id, user_id
            )
            SELECT
                rr.id, rr.reaction, rr.created_at, rr.updated_at, rr.review_id,
                au.username
            FROM reviews_reviewreaction rr
            JOIN auth_user au ON au.id = rr.user_id
            """
        )
    else:
        cursor.execute(
            """
            INSERT INTO reviews_reviewreaction_new (
                id, reaction, created_at, updated_at, review_id, user_id
            )
            SELECT
                id, reaction, created_at, updated_at, review_id, user_id
            FROM reviews_reviewreaction
            """
        )

    cursor.execute(
        """
        CREATE TABLE reviews_reviewcommentreaction_new (
            id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
            reaction varchar(20) NOT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            comment_id bigint NOT NULL REFERENCES reviews_reviewcomment (id) DEFERRABLE INITIALLY DEFERRED,
            user_id varchar(30) NOT NULL REFERENCES accounts_user (id) DEFERRABLE INITIALLY DEFERRED
        )
        """
    )

    if auth_user_exists:
        cursor.execute(
            """
            INSERT INTO reviews_reviewcommentreaction_new (
                id, reaction, created_at, updated_at, comment_id, user_id
            )
            SELECT
                rcr.id, rcr.reaction, rcr.created_at, rcr.updated_at, rcr.comment_id,
                au.username
            FROM reviews_reviewcommentreaction rcr
            JOIN auth_user au ON au.id = rcr.user_id
            """
        )
    else:
        cursor.execute(
            """
            INSERT INTO reviews_reviewcommentreaction_new (
                id, reaction, created_at, updated_at, comment_id, user_id
            )
            SELECT
                id, reaction, created_at, updated_at, comment_id, user_id
            FROM reviews_reviewcommentreaction
            """
        )

    cursor.execute("DROP TABLE reviews_reviewcommentreaction")
    cursor.execute("DROP TABLE reviews_reviewreaction")
    cursor.execute("DROP TABLE reviews_reviewcomment")
    cursor.execute("DROP TABLE reviews_review")

    cursor.execute("ALTER TABLE reviews_review_new RENAME TO reviews_review")
    cursor.execute("ALTER TABLE reviews_reviewcomment_new RENAME TO reviews_reviewcomment")
    cursor.execute("ALTER TABLE reviews_reviewreaction_new RENAME TO reviews_reviewreaction")
    cursor.execute("ALTER TABLE reviews_reviewcommentreaction_new RENAME TO reviews_reviewcommentreaction")

    cursor.execute(
        "CREATE INDEX reviews_rev_item_id_251ba0_idx ON reviews_review (item_id, created_at DESC)"
    )
    cursor.execute(
        "CREATE INDEX reviews_rev_author__7c13ab_idx ON reviews_review (author_id, created_at DESC)"
    )
    cursor.execute(
        "CREATE INDEX reviews_rev_like_co_3de2f7_idx ON reviews_review (like_count DESC, created_at DESC)"
    )
    cursor.execute(
        "CREATE INDEX reviews_rev_review__bb8a1c_idx ON reviews_reviewcomment (review_id, created_at)"
    )
    cursor.execute(
        "CREATE INDEX reviews_rev_author__96883a_idx ON reviews_reviewcomment (author_id, created_at DESC)"
    )
    cursor.execute(
        "CREATE INDEX reviews_rev_like_co_a911da_idx ON reviews_reviewcomment (like_count DESC, created_at DESC)"
    )
    cursor.execute(
        "CREATE UNIQUE INDEX unique_review_reaction_per_user ON reviews_reviewreaction (review_id, user_id)"
    )
    cursor.execute(
        "CREATE UNIQUE INDEX unique_review_comment_reaction_per_user ON reviews_reviewcommentreaction (comment_id, user_id)"
    )

    cursor.execute("PRAGMA foreign_keys = ON")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_alter_user_managers_user_groups_user_is_active_and_more"),
        ("reviews", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(rebuild_review_foreign_keys, migrations.RunPython.noop),
    ]
