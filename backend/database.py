"""SQLAlchemy database connection for iePDF.

Loads DATABASE_URL from the backend environment without logging credentials.
This module does not create tables or run migrations.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env", override=False)

_raw_database_url = os.environ.get("DATABASE_URL", "").strip()
if not _raw_database_url:
    raise RuntimeError("DATABASE_URL is not configured in the backend environment.")

_database_url: URL = make_url(_raw_database_url)
if _database_url.get_backend_name() != "postgresql":
    raise RuntimeError("DATABASE_URL must use PostgreSQL.")

engine = create_engine(
    _database_url,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"connect_timeout": 10},
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for future iePDF SQLAlchemy models."""
