"""baseline — core schema created by create_all() at startup

Revision ID: 0000000000
Revises:
Create Date: 2026-05-11 00:00:00.000000

This migration acts as a stamp/baseline for all tables that are created by
SQLAlchemy's Base.metadata.create_all() at application startup (main.py).

On a fresh install:
  1. Start the backend once (create_all builds all tables)
  2. Run: alembic stamp 0000000000
  3. Then run: alembic upgrade head
  (or just: alembic stamp head, since create_all already created everything)

On future schema changes, generate incremental migrations with:
  alembic revision --autogenerate -m "describe change"
"""
from typing import Sequence, Union

revision: str = '0000000000'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
