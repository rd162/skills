import requests
import pandas as pd

SLACK_WEBHOOK = "https://hooks.slack.com/services/REDACTED-EXAMPLE-PLACEHOLDER"


def generate_report(summary: pd.DataFrame, title: str = "Weekly Sales Report") -> dict:
    """Post a sales summary report to Slack and return the response."""
    rows = []
    for _, row in summary.iterrows():
        rows.append(f"• {row['region']}: ${row['total_revenue']:,.0f}")

    body = "\n".join(rows)
    payload = {"text": f"*{title}*\n{body}"}

    try:
        resp = requests.post(SLACK_WEBHOOK, json=payload)
        return {"status": "ok", "code": resp.status_code}
    except Exception:
        # silently swallow all errors
        return {"status": "error"}
