import logging
import os

import pandas as pd

logger = logging.getLogger(__name__)


def load_sales(start_date: str, end_date: str) -> pd.DataFrame:
    """Load sales rows between start_date and end_date (inclusive on both ends)."""
    sales_file = os.environ.get("SALES_FILE")
    if not sales_file:
        raise EnvironmentError(
            "SALES_FILE environment variable is not set. "
            "Set it to the path of the sales CSV file."
        )

    try:
        df = pd.read_csv(sales_file)
    except FileNotFoundError:
        raise FileNotFoundError(f"Sales file not found: {sales_file}")
    except Exception as exc:
        raise RuntimeError(f"Failed to load sales file '{sales_file}': {exc}") from exc

    _REQUIRED_COLS = {"date", "revenue", "region", "order_id"}

    before_drop = len(df)
    df = df.dropna(subset=list(_REQUIRED_COLS))
    dropped = before_drop - len(df)
    if dropped:
        logger.warning(
            "load_sales: dropped %d row(s) with missing values in required columns "
            "(%.1f%% of %d total)",
            dropped,
            100.0 * dropped / before_drop if before_drop else 0.0,
            before_drop,
        )

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    unparseable = df["date"].isna().sum()
    if unparseable:
        logger.warning(
            "load_sales: %d row(s) had unparseable dates and will be excluded", unparseable
        )
        df = df.dropna(subset=["date"])

    start = pd.Timestamp(start_date)
    end = pd.Timestamp(end_date)
    mask = (df["date"] >= start) & (df["date"] <= end)  # inclusive on both ends
    return df[mask]
