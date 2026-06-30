import logging
import os

import requests
import pandas as pd

logger = logging.getLogger(__name__)


def generate_report(summary: pd.DataFrame, title: str = "Weekly Sales Report") -> dict:
    """Post a sales summary report to Slack and return the response."""
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        raise EnvironmentError(
            "SLACK_WEBHOOK_URL environment variable is not set."
        )

    rows = []
    for _, row in summary.iterrows():
        rows.append(f"• {row['region']}: ${row['total_revenue']:,.0f}")

    body = "\n".join(rows)
    payload = {"text": f"*{title}*\n{body}"}

    try:
        resp = requests.post(webhook_url, json=payload)
        resp.raise_for_status()
        # Slack signals application-level errors with 200 OK and a plain-text body
        if resp.text != "ok":
            logger.error(
                "generate_report: Slack rejected payload for '%s': %s", title, resp.text
            )
            return {"status": "error", "detail": resp.text}
        return {"status": "ok", "code": resp.status_code}
    except requests.HTTPError as exc:
        logger.error(
            "generate_report: Slack returned HTTP %s for '%s': %s",
            exc.response.status_code,
            title,
            exc,
        )
        return {"status": "error", "code": exc.response.status_code, "detail": str(exc)}
    except Exception as exc:
        logger.error("generate_report: failed to deliver report '%s': %s", title, exc)
        return {"status": "error", "detail": str(exc)}
