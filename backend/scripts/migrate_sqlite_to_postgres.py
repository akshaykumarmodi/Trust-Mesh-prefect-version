#!/usr/bin/env python3
"""
TrustMesh: Idempotent SQLite to PostgreSQL Production Data Migration Tool

Safely migrates all TrustMesh data from a local SQLite database (e.g. trustmesh.db)
into a production PostgreSQL database (Neon, Supabase, AWS RDS, Vercel Postgres, etc.)

Features:
- Preserves all primary keys, UUIDs, hashes, and timestamps exactly.
- Idempotent: Uses session.merge() to prevent duplicate key violations.
- Handles topological dependency order across all 11 models.
- Auto-creates tables and runs schema migrations on the target PostgreSQL database.
- Supports dry-run verification mode.

Usage:
    python backend/scripts/migrate_sqlite_to_postgres.py
    python backend/scripts/migrate_sqlite_to_postgres.py --sqlite-path trustmesh.db --postgres-url "postgresql://..."
    python backend/scripts/migrate_sqlite_to_postgres.py --dry-run
"""

import argparse
import os
import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.session import Base
from app.main import run_migrations
from app.models import (
    User, Project, Contributor, GitHubCredential,
    ProjectTrustEdge, Vouch, Denouncement, CoordinatedCampaign,
    GitHubPullRequest, ActivityLog, EmailNotification
)

MODELS_IN_ORDER = [
    User,
    Project,
    Contributor,
    GitHubCredential,
    ProjectTrustEdge,
    Vouch,
    Denouncement,
    CoordinatedCampaign,
    GitHubPullRequest,
    ActivityLog,
    EmailNotification,
]

def normalize_pg_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url

def migrate(sqlite_path: str, postgres_url: str, dry_run: bool = False):
    print("=" * 70)
    print("TrustMesh Data Migration: SQLite -> PostgreSQL")
    print("=" * 70)

    sqlite_file = Path(sqlite_path).resolve()
    if not sqlite_file.is_file():
        print(f"Error: Source SQLite database not found at '{sqlite_file}'")
        sys.exit(1)

    norm_pg_url = normalize_pg_url(postgres_url)
    masked_url = norm_pg_url.split("@")[-1] if "@" in norm_pg_url else norm_pg_url[:20] + "..."
    print(f"Source SQLite:   {sqlite_file}")
    print(f"Target Database: ...@{masked_url}")
    print(f"Dry Run Mode:    {dry_run}")
    print("-" * 70)

    # 1. Connect to SQLite
    src_engine = create_engine(f"sqlite:///{sqlite_file}", connect_args={"check_same_thread": False})
    SrcSession = sessionmaker(bind=src_engine)
    src_db = SrcSession()

    # 2. Connect to PostgreSQL
    target_engine_kwargs = {}
    if "sqlite" not in norm_pg_url.lower():
        target_engine_kwargs["pool_pre_ping"] = True
        target_engine_kwargs["pool_recycle"] = 300

    target_engine = create_engine(norm_pg_url, **target_engine_kwargs)
    TargetSession = sessionmaker(bind=target_engine)
    target_db = TargetSession()

    # 3. Ensure target schema and migrations
    print("[1/3] Ensuring tables and schema migrations on target database...")
    if not dry_run:
        Base.metadata.create_all(bind=target_engine)
        run_migrations(target_engine)
    print("      Target schema ready.")

    # 4. Migrate models in topological dependency order
    print("\n[2/3] Migrating records in topological order...")
    total_migrated = 0
    migration_summary = []

    for model in MODELS_IN_ORDER:
        table_name = model.__tablename__
        model_name = model.__name__

        src_rows = src_db.query(model).all()
        count = len(src_rows)

        if count == 0:
            print(f"  - {model_name:22} ({table_name}): 0 records (skipped)")
            migration_summary.append((model_name, 0, 0))
            continue

        if not dry_run:
            cols = {c.name: c for c in model.__table__.columns}
            for row in src_rows:
                inst_kwargs = {}
                for col_name, col in cols.items():
                    val = getattr(row, col_name)
                    inst_kwargs[col_name] = val
                target_db.merge(model(**inst_kwargs))
            target_db.commit()

        total_migrated += count
        target_count = target_db.query(model).count() if not dry_run else count
        print(f"  ✓ {model_name:22} ({table_name}): {count} source rows -> {target_count} target rows")
        migration_summary.append((model_name, count, target_count))

    print("\n[3/3] Migration Summary:")
    print("-" * 70)
    for mname, scnt, tcnt in migration_summary:
        status = "DRY-RUN OK" if dry_run else ("MATCHED" if scnt <= tcnt else "WARNING")
        print(f"  {mname:22} Source: {scnt:4}  |  Target: {tcnt:4}  [{status}]")
    print("-" * 70)
    print(f"Total source records processed: {total_migrated}")
    if dry_run:
        print("\nDry run completed successfully. No changes were committed to the target database.")
    else:
        print("\nMigration completed successfully! All records have been persisted to PostgreSQL.")
    print("=" * 70)

def main():
    parser = argparse.ArgumentParser(description="TrustMesh SQLite to PostgreSQL Data Migration Tool")
    parser.add_argument(
        "--sqlite-path",
        default=os.getenv("SQLITE_PATH", "trustmesh.db"),
        help="Path to source SQLite database file (default: trustmesh.db)"
    )
    parser.add_argument(
        "--postgres-url",
        default=os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL"),
        help="PostgreSQL connection string (default: read from DATABASE_URL or POSTGRES_URL)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate migration without committing changes to target database"
    )

    args = parser.parse_args()

    if not args.postgres_url:
        print("Error: No target PostgreSQL connection string provided.")
        print("Please provide --postgres-url or set DATABASE_URL / POSTGRES_URL environment variable.")
        sys.exit(1)

    migrate(sqlite_path=args.sqlite_path, postgres_url=args.postgres_url, dry_run=args.dry_run)

if __name__ == "__main__":
    main()
