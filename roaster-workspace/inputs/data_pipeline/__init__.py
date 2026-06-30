"""Data pipeline: load → transform → report."""
from .loader import load_sales
from .transform import aggregate_by_region
from .report import generate_report

__all__ = ["load_sales", "aggregate_by_region", "generate_report"]
