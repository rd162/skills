import pandas as pd


def aggregate_by_region(df: pd.DataFrame) -> pd.DataFrame:
    """Return total revenue and average order value per region.

    Average order value retains full float precision (no rounding is applied).

    Parameters
    ----------
    df : pd.DataFrame
        Sales DataFrame as returned by ``load_sales``.

    Returns
    -------
    pd.DataFrame
        One row per region with columns: ``region``, ``total_revenue``,
        ``avg_order``, ``order_count``.
    """
    result = df.groupby("region").agg(
        total_revenue=("revenue", "sum"),
        avg_order=("revenue", "mean"),   # float mean — no floor division
        order_count=("order_id", "count"),
    )

    return result.reset_index()


def top_n_products(df: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """Return the top *n* products by revenue.

    Parameters
    ----------
    df : pd.DataFrame
        Sales DataFrame as returned by ``load_sales``.
    n : int
        Number of products to return.  Defaults to 10.

    Returns
    -------
    pd.DataFrame
        Exactly *n* rows (or fewer if there are fewer than *n* distinct
        products), with columns ``product_id`` and ``revenue``, sorted
        descending by ``revenue``.
    """
    ranked = df.groupby("product_id")["revenue"].sum().sort_values(ascending=False)
    return ranked.iloc[:n].reset_index()  # inclusive upper bound — returns exactly n rows
