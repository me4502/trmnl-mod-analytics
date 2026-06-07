# TRMNL Mod Analytics

A TRMNL Recipe, powered by a small Cloudflare Worker microservice, for analytics for mod creators.

Currently supports the following mod platforms:

- Modrinth
- CurseForge

## Data shown

- Current total downloads across selected projects.
- Per-project downloads.
- Payout, last-month USD revenue, and all-time USD revenue where the platform exposes it.

## Authentication

Modrinth:

- Project totals are public and do not require a token.
- Revenue requires a raw Personal Access Token with `PAYOUTS_READ`.

CurseForge:

- Download count requires a CurseForge Core API key.

## Deployment

Deploy to Cloudflare Workers:

```bash
yarn deploy
```

## TRMNL Setup

See [recipe/README.md](./recipe/README.md) for instructions on setting up the Recipe in the TRMNL dashboard.
