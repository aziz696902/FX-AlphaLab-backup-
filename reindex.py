"""Standalone RAG reindex script. Run directly without the backend."""

import argparse
import logging
import sys
from datetime import date

from src.rag.indexer import build_index
from src.shared.config import Config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    stream=sys.stdout,
)

parser = argparse.ArgumentParser(description="Rebuild the RAG vector index.")
group = parser.add_mutually_exclusive_group()
group.add_argument("--days", type=int, help="Rolling window in days from today (e.g. --days 30)")
group.add_argument(
    "--date", type=str, help="Start date in YYYY-MM-DD format (e.g. --date 2026-05-10)"
)
args = parser.parse_args()

if args.date:
    start = date.fromisoformat(args.date)
    days = (date.today() - start).days
    if days < 0:
        print(f"Error: --date {args.date} is in the future.")
        sys.exit(1)
    print(f"Using date {args.date} → {days} days window")
elif args.days:
    days = args.days
else:
    days = 1
    print("No --days or --date specified, defaulting to 1 day.")

stats = build_index(data_dir=Config.DATA_DIR, chroma_dir=Config.CHROMA_DIR, days=days, evict=False)
print(f"\nDone — upserted={stats['upserted']} evicted={stats['evicted']} total={stats['total']}")
