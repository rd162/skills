---
title: Procedure - AWS ECS API Deployment via GitHub Actions
type: procedure
tier: T3
source_class: llm
version: "1.0"
last_updated: 2026-06-26
description: Step-by-step procedure for deploying the API to AWS ECS using a GitHub Actions workflow triggered by merge to main.
tags:
  - deployment
  - aws
  - ecs
  - github-actions
  - ci-cd
  - docker
  - ecr
---

## Revision Management

- [r1] 2026-06-26T00:00:00Z — initial creation

---

# Procedure - AWS ECS API Deployment via GitHub Actions

This procedure describes the automated pipeline that builds, validates, and deploys a containerized API to AWS ECS whenever code is merged to the main branch. It encompasses the full lifecycle from trigger through post-deployment notification.

## Objective

Produce a running, health-verified ECS service revision from a merge-to-main event, with the deployed image traceable to its exact git commit and the outcome reported to the team via Slack.

## Steps

### 1. Merge to main triggers the GitHub Actions workflow

**Trigger:** A pull request is merged into the `main` branch (or a direct push to `main`).
**Action:** GitHub detects the push event and instantiates the deployment workflow defined in the repository's `.github/workflows/` directory.
**Outcome:** A new workflow run is created and begins executing on a GitHub-hosted (or self-hosted) runner.

---

### 2. Tests run and must pass

**Precondition:** Workflow runner has dependencies installed and environment variables configured.
**Action:** The CI job executes the project's test suite (unit, integration, or both, depending on workflow configuration).
**Gate:** If any test fails, the pipeline halts immediately at this stage. No Docker image is built and no deployment proceeds. The merge commit remains on main but no artifact is produced or deployed.
**Outcome:** All tests green — pipeline continues to the build stage.

---

### 3. Docker image is built and tagged with the git SHA

**Precondition:** Tests passed; Docker daemon available on the runner.
**Action:** The runner executes `docker build` against the repository's `Dockerfile`. The resulting image is tagged using the full or short git commit SHA (e.g., `my-api:a3f92c1`).
**Rationale:** SHA-based tagging makes every deployed image immutable and uniquely traceable back to the exact source commit, eliminating ambiguity in rollback or audit scenarios.
**Outcome:** A tagged Docker image exists locally on the runner.

---

### 4. Image is pushed to ECR (Amazon Elastic Container Registry)

**Precondition:** Runner has AWS credentials (typically via OIDC or stored GitHub Actions secrets) with `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, and related push permissions.
**Action:** The runner authenticates to ECR (`aws ecr get-login-password | docker login`), then pushes the SHA-tagged image to the designated ECR repository.
**Outcome:** The image is available in ECR under its SHA tag and is accessible to ECS task definitions in the same AWS account and region.

---

### 5. ECS service is updated via a new task definition

**Precondition:** Image is confirmed present in ECR; runner has ECS permissions (`ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `iam:PassRole`).
**Action:** A new ECS task definition revision is registered, referencing the newly pushed ECR image URI. The ECS service is then updated (`aws ecs update-service`) to use this new task definition revision, triggering a rolling deployment.
**Outcome:** ECS begins draining existing tasks and replacing them with tasks running the new image revision.

---

### 6. Health check runs for 5 minutes monitoring service health

**Precondition:** ECS service update has been submitted; new tasks are starting.
**Action:** The workflow polls the ECS service or the load balancer target group health status for up to 5 minutes, checking that the new tasks reach a `RUNNING` and `HEALTHY` state.
**Gate:** If tasks fail health checks within the 5-minute window, the pipeline marks the step as failed. ECS itself may initiate a rollback to the previous task definition depending on the service's deployment circuit-breaker configuration.
**Note (unverified):** The exact 5-minute duration may be configurable via workflow inputs; this value reflects observed default behavior and should be confirmed against the actual workflow file.
**Outcome:** Service is stable with healthy tasks serving traffic, or the failure is surfaced for remediation.

---

### 7. Slack notification sent to #deployments channel confirming deployment status

**Precondition:** All prior steps have completed (success or failure); a Slack webhook URL is available as a GitHub Actions secret.
**Action:** The workflow's final step posts a message to the `#deployments` Slack channel. The message includes at minimum: deployment status (success/failure), the git SHA deployed, the repository/service name, and a link to the workflow run.
**Outcome:** The team is immediately informed of the deployment result without needing to monitor the Actions UI.

---

## Observations

- [trigger] Workflow initiates on push/merge to main branch exclusively; feature branches do not trigger deployment #github-actions #trigger
- [gate] Test failure is a hard stop — no artifact is built or deployed until all tests pass #quality-gate #risk
- [design] Git SHA image tagging provides immutable traceability between running containers and source commits #ecr #auditability
- [config] ECR authentication relies on AWS credentials stored as GitHub Actions secrets or OIDC federation; credential scope must include ECR push and ECS update permissions #security #iam
- [design] ECS rolling deployment is achieved by registering a new task definition revision and calling update-service, not by in-place container replacement #ecs #zero-downtime
- [unverified] Health check window of 5 minutes is the observed default; exact value and configurability should be confirmed in the workflow YAML #health-check #duration
- [risk] If ECS deployment circuit breaker is not enabled, a failing new task definition will not auto-rollback; manual intervention would be required #ecs #rollback-risk
- [notification] Slack alerts target #deployments channel; webhook URL must be maintained as an active GitHub Actions secret #observability #slack
- [unverified] Adoption date of this pipeline is not confirmed; procedure reflects current observed state as of 2026-06-26 #provenance

## Relations

- implements [[Concept - Zero-Downtime ECS Deployment Strategy]]
- requires [[Fact - ECS Deployment Infrastructure Configuration]]
- derived_from [[Narrative - API Deployment Process Context]]
- see_also [[Procedure - ECS Rollback to Previous Task Definition]]
- see_also [[Fact - ECS Task Definition Schema and Required Fields]]
- see_also [[Fact - ECR Image Retention Policy Configuration]]
- see_also [[Fact - GitHub Actions Secrets and OIDC Configuration for AWS]]
