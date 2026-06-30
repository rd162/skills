import os
import logging

import pandas as pd

logger = logging.getLogger(__name__)


def load_sales(
    start_date: str,
    end_date: str,
    sales_file: str | None = None,
) -> pd.DataFrame:
    """Load sales rows between start_date and end_date (both inclusive).

    Parameters
    ----------
    start_date : str
        ISO-format date string, e.g. ``"2025-01-01"``.  Inclusive.
    end_date : str
        ISO-format date string, e.g. ``"2025-01-31"``.  Inclusive.
    sales_file : str | None
        Path to the CSV file.  If *None*, the environment variable
        ``SALES_FILE`` is read.  Raises ``ValueError`` if neither is set.

    Returns
    -------
    pd.DataFrame
        Rows whose ``date`` column falls within [start_date, end_date].
        Rows missing values in business-critical columns (``date``,
        ``region``, ``revenue``, ``order_id``) are dropped; a warning is
        logged with the count.  Rows missing only non-critical columns are
        kept.

    Raises
    ------
    ValueError
        If no file path is configured.
    FileNotFoundError
        If the configured file does not exist.
    """
    path = sales_file or os.environ.get("SALES_FILE")
    if not path:
        raise ValueError(
            "No sales file configured. Pass sales_file= or set SALES_FILE."
        )

    df = pd.read_csv(path)

    # Drop rows missing values in critical columns only; log how many were removed.
    critical_cols = [c for c in ("date", "region", "revenue", "order_id") if c in df.columns]
    n_before = len(df)
    df = df.dropna(subset=critical_cols)
    n_dropped = n_before - len(df)
    if n_dropped:
        logger.warning(
            "load_sales: dropped %d row(s) with missing values in %s",
            n_dropped,
            critical_cols,
        )

    df["date"] = pd.to_datetime(df["date"])
    start = pd.Timestamp(start_date)
    end = pd.Timestamp(end_date)
    mask = (df["date"] >= start) & (df["date"] <= end)  # both endpoints inclusive
    return df[mask]
