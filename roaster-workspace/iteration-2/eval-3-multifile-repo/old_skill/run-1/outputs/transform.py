import pandas as pd


def aggregate_by_region(df: pd.DataFrame) -> pd.DataFrame:
    """Return total revenue and average order value per region."""
    result = df.groupby("region").agg(
        total_revenue=("revenue", "sum"),
        avg_order=("revenue", "mean"),
        order_count=("order_id", "count"),
    )
    return result.reset_index()


def top_n_products(df: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """Return the top n products by revenue."""
    ranked = df.groupby("product_id")["revenue"].sum().sort_values(ascending=False)
    return ranked.iloc[:n].reset_index()
