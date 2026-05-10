from datetime import datetime, timezone

from src.ingestion.preprocessors.dukascopy_preprocessor import DukascopyPreprocessor

pp = DukascopyPreprocessor()
result = pp.preprocess(
    end_date=datetime(2026, 5, 5, 23, 59, 59, tzinfo=timezone.utc),
    backfill=True,
)
for key, df in result.items():
    last = str(df.index[-1]) if len(df) else "empty"
    print(f"{key}: {len(df)} rows, last={last}")
