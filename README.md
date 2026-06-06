# TRMNL Mod Analytics

A TRMNL Recipe, powered by a small Cloudflare Worker microservice, for analytics for mod creators.

Currently supports the following mod platforms:

- Modrinth

## Data shown

- Current total downloads across selected projects.
- Per-project download
- Payout, last-month USD revenue, and all-time USD revenue.

## Authentication

Project totals are public and do not require a token. Revenue requires a raw Modrinth Personal Access Token with `PAYOUTS_READ`. This is not stored in the worker.

## Deployment

Deploy to Cloudflare Workers:

```bash
yarn deploy
```

## TRMNL Setup

See [recipe/README.md](./recipe/README.md) for instructions on setting up the Recipe in the TRMNL dashboard.
