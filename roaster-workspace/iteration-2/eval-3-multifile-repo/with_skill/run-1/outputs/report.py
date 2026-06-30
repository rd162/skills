import os

import requests
import pandas as pd


def generate_report(
    summary: pd.DataFrame,
    title: str = "Weekly Sales Report",
    slack_webhook: str | None = None,
) -> dict:
    """Post a sales summary report to Slack and return a status dict.

    Parameters
    ----------
    summary : pd.DataFrame
        Aggregated sales data, typically produced by ``aggregate_by_region``.
        Must contain columns ``region`` and ``total_revenue``.
    title : str
        Report heading text.
    slack_webhook : str | None
        Slack incoming-webhook URL.  If *None*, the environment variable
        ``SLACK_WEBHOOK_URL`` is read.  Raises ``ValueError`` if neither
        is provided.

    Returns
    -------
    dict
        ``{"status": "ok", "code": <HTTP status code>}`` on success.
        ``{"status": "error", "message": <error text>}`` on failure
        (network error, HTTP 4xx/5xx, etc.).  The caller can always
        inspect ``status`` and ``message`` without catching exceptions.

    Raises
    ------
    ValueError
        If no webhook URL is configured.
    """
    url = slack_webhook or os.environ.get("SLACK_WEBHOOK_URL")
    if not url:
        raise ValueError(
            "No Slack webhook configured. Pass slack_webhook= or set SLACK_WEBHOOK_URL."
        )

    rows = []
    for _, row in summary.iterrows():
        rows.append(f"• {row['region']}: ${row['total_revenue']:,.2f}")

    body = "\n".join(rows)
    payload = {"text": f"*{title}*\n{body}"}

    try:
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()          # surface HTTP 4xx / 5xx to the caller
        return {"status": "ok", "code": resp.status_code}
    except requests.HTTPError as exc:
        return {"status": "error", "message": f"HTTP {exc.response.status_code}: {exc}"}
    except Exception as exc:             # network-level errors (timeout, DNS, etc.)
        return {"status": "error", "message": str(exc)}
