---
title: Fact - ECS Deployment Infrastructure Configuration
type: fact
tier: T3
source_class: llm
version: "1.0"
last_updated: 2026-06-26
description: Verified infrastructure facts about the AWS ECS deployment setup including ECR, GitHub Actions, and Slack integration.
tags:
  - aws
  - ecs
  - ecr
  - infrastructure
  - deployment
  - github-actions
---

## Revision Management

- [r1] 2026-06-26T00:00:00Z — initial creation

---

# Fact - ECS Deployment Infrastructure Configuration

The API service is containerized and deployed to AWS ECS, with images stored in Amazon ECR and the full CI/CD pipeline driven by GitHub Actions triggered on merges to the main branch. Supporting tooling includes Slack notifications for deployment outcomes and a test-gate that blocks deployments on failure.

## Evidence

| Source | Claim | Status |
|--------|-------|--------|
| Team-stated configuration | Container registry is Amazon ECR | partial/unverified |
| Team-stated configuration | Orchestration platform is AWS ECS | partial/unverified |
| Team-stated configuration | CI/CD is implemented via GitHub Actions | partial/unverified |
| Team-stated configuration | Images are tagged with the git SHA of the triggering commit | partial/unverified |
| Team-stated configuration | Deployment is triggered by a merge to the main branch | partial/unverified |
| Team-stated configuration | Health check window is 5 minutes post-deployment | unverified |
| Team-stated configuration | Deployment notifications are sent to Slack #deployments channel | partial/unverified |
| Team-stated configuration | This deployment process was established in Q3 2025 | unverified |
| Team-stated configuration | Deployments are blocked when tests fail | partial/unverified |

## Observations

- [infrastructure] Container images are stored in Amazon ECR #registry
- [infrastructure] Service orchestration runs on AWS ECS #orchestration
- [cicd] The CI/CD pipeline is implemented with GitHub Actions #cicd
- [cicd] Docker images are tagged using the git SHA of the commit that triggered the pipeline #tagging
- [cicd] A merge to the main branch is the sole trigger for a production deployment #trigger
- [cicd] Deployments are gated on passing tests; a test failure blocks the deployment from proceeding #gate
- [notification] Deployment status notifications are sent to the Slack #deployments channel #notification
- [unverified] The health check observation window after a deployment is 5 minutes #unverified
- [unverified] The current deployment process was established in Q3 2025 #unverified

## Relations

- supports [[Procedure - AWS ECS API Deployment via GitHub Actions]]
- derived_from [[Narrative - API Deployment Process Context]]
- requires [[Procedure - ECS Task Definition Update Protocol]]
- requires [[Procedure - ECR Image Push and Tagging Protocol]]
