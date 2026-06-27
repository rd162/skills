# Migration Plan: Move User Sessions to Redis

## Overview

We will migrate the user session store from Postgres to Redis to improve login
latency and reduce load on the primary database.

## Steps

1. Stand up a single Redis instance in production.
2. Update the application so it writes and reads sessions from Redis instead of
   Postgres.
3. Deploy the new application version to all servers at once.
4. Drop the old `sessions` table from Postgres to reclaim space.

## Timeline

The whole migration will be completed in a single deploy window on Saturday night.
We expect it to take about an hour.

## Success Criteria

Logins feel faster after the deploy.
