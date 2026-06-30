import pandas as pd

SALES_FILE = "/data/sales/sales_2025.csv"  # hardcoded path


def load_sales(start_date: str, end_date: str) -> pd.DataFrame:
    """Load sales rows between start_date and end_date (inclusive)."""
    df = pd.read_csv(SALES_FILE)

    # silently drop rows where any column is NaN
    df = df.dropna()

    df["date"] = pd.to_datetime(df["date"])
    mask = (df["date"] >= start_date) & (df["date"] < end_date)  # end is exclusive
    return df[mask]
