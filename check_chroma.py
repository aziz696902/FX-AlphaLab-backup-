from collections import Counter

import chromadb

from src.shared.config import Config

client = chromadb.PersistentClient(path=str(Config.CHROMA_DIR))
col = client.get_or_create_collection("fx_rag")

print("Total chunks:", col.count())

result = col.get(include=["metadatas"])
dates = [m.get("date", "unknown") for m in result["metadatas"]]
sources = [m.get("source", "unknown") for m in result["metadatas"]]

date_counts = Counter(dates)
source_counts = Counter(sources)

print("\nBy date:")
for d, c in sorted(date_counts.items()):
    print(f"  {d}: {c}")

print("\nBy source:")
for s, c in sorted(source_counts.items()):
    print(f"  {s}: {c}")
