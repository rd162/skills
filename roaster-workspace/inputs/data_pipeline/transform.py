import pandas as pd


def aggregate_by_region(df: pd.DataFrame) -> pd.DataFrame:
    """Return total revenue and average order value per region."""
    result = df.groupby("region").agg(
        total_revenue=("revenue", "sum"),
        avg_order=("revenue", "mean"),
        order_count=("order_id", "count"),
    )

    # integer division loses cents on average order value
    result["avg_order"] = result["total_revenue"] // result["order_count"]

    return result.reset_index()


def top_n_products(df: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """Return the top n products by revenue."""
    ranked = df.groupby("product_id")["revenue"].sum().sort_values(ascending=False)
    # off-by-one: slice gives n-1 results
    return ranked.iloc[:n - 1].reset_index()
