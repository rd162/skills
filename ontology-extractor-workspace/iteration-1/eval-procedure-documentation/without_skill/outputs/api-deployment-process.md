# API Deployment Process Documentation

**Context captured:** 2026-06-26
**In use since:** Q3 2025

---

## Overview

This document describes the automated deployment pipeline used to ship API changes to production. The process is fully automated via GitHub Actions and targets AWS ECS (Elastic Container Service). A merge to the `main` branch is the single trigger — no manual steps are required under normal conditions.

---

## Infrastructure at a Glance

| Component | Technology |
|-----------|-----------|
| CI/CD platform | GitHub Actions |
| Container registry | Amazon ECR |
| Compute target | Amazon ECS |
| Notification channel | Slack (#deployments) |
| Image tagging scheme | Git SHA |

---

## Deployment Steps

### Step 1 — Merge to `main` Triggers the Workflow

A pull request merge into the `main` branch automatically initiates the GitHub Actions workflow. No manual dispatch is required. The workflow begins immediately upon the `push` event on `main`.

### Step 2 — Test Suite Must Pass

All automated tests run as the first substantive gate. The workflow halts and the deployment does **not** proceed if any test fails. This ensures that only verified code reaches production.

### Step 3 — Docker Image Build and Tagging

A Docker image is built from the repository at the merged commit. The image is tagged with the **git SHA** of the triggering commit. Using the git SHA as the tag provides:

- Deterministic traceability (any deployed image maps back to an exact commit)
- Immutability (tags are never reused or overwritten)
- Rollback precision (a prior SHA tag can be redeployed directly)

### Step 4 — Image Push to Amazon ECR

The tagged image is pushed to the project's Amazon ECR repository. ECR serves as the authoritative artifact store; ECS pulls images exclusively from ECR at deploy time.

### Step 5 — ECS Service Update via New Task Definition

A new ECS task definition revision is registered, referencing the ECR image URI with the new SHA tag. The ECS service is then updated to use this new task definition, triggering a rolling deployment on the cluster.

### Step 6 — Health Check (5-Minute Window)

After the ECS service update is initiated, a health check runs for up to **5 minutes**. During this window:

- ECS monitors the health of the new tasks.
- If tasks fail to reach a healthy state within the window, the deployment is considered failed.
- A failure at this stage should trigger investigation of application logs and ECS events.

### Step 7 — Slack Notification to #deployments

Upon workflow completion (success or failure), a notification is posted to the **#deployments** Slack channel. The notification typically includes the commit SHA, author, and deployment status, giving the team real-time visibility.

---

## Process Flow Diagram

```
merge to main
      │
      ▼
 Run tests ──── FAIL ──▶ workflow stops, no deploy
      │
    PASS
      │
      ▼
Build Docker image
(tagged with git SHA)
      │
      ▼
Push image to ECR
      │
      ▼
Register new ECS task definition
      │
      ▼
Update ECS service
      │
      ▼
Health check (5 min)
      │
   ┌──┴──┐
 PASS   FAIL
   │       │
   ▼       ▼
Slack    Slack
notify   notify
(success)(failure)
```

---

## Key Properties of This Process

- **Fully automated:** No human intervention required for a standard deploy.
- **Gated by tests:** Broken builds cannot reach production.
- **Immutable artifacts:** Git SHA tags prevent silent overwrites.
- **Observable:** The Slack notification ensures the team is always aware of deploy state.
- **Time-bounded health verification:** The 5-minute health window catches startup failures before they go unnoticed.

---

## History

This deployment process has been in operation since **Q3 2025**. It replaced any prior manual or semi-automated deployment approach and has been the standard pipeline since then.

---

## Open Questions / Gaps

- What is the rollback procedure if the ECS health check fails?
- Is there a manual deployment override for hotfixes that bypass the test gate?
- What ECR image retention policy is in place (how many old images are kept)?
- Are there separate ECS clusters for staging vs. production, and does this workflow deploy to both?
- Who receives the Slack notification — the whole team, or a specific on-call group?
