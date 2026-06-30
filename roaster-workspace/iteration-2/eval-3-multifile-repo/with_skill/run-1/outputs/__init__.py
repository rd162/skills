"""Data pipeline: load → transform → report."""
from .loader import load_sales
from .transform import aggregate_by_region, top_n_products
from .report import generate_report

__all__ = ["load_sales", "aggregate_by_region", "top_n_products", "generate_report"]
