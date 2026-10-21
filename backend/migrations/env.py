from logging.config import fileConfig
import os
import sys
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import make_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env", override=False)

from models import Base  # noqa: E402

target_metadata = Base.metadata


def get_database_url() -> str:
    raw_url = os.environ.get("DATABASE_URL", "").strip()
    if not raw_url:
        raise RuntimeError("DATABASE_URL is not configured.")

    url = make_url(raw_url)
    if url.get_backend_name() != "postgresql":
        raise RuntimeError("DATABASE_URL must use PostgreSQL.")

    return raw_url


def run_migrations_offline() -> None:
    context.configure(
        url=get_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # The URL is supplied from the environment; never write credentials to ini.
    section = config.get_section(config.config_ini_section) or {}
    section["sqlalchemy.url"] = get_database_url()

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
