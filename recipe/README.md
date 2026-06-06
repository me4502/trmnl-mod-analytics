# Setup in TRMNL dashboard

Use the Recipe **Polling** strategy.

## Polling URL

```txt
https://trmnl-mod-analytics.maddy.tech/api/{{ provider | default: "modrinth" | url_encode }}/summary?project_ids={{ project_ids | url_encode }}
```

If you're deploying this yourself, replace the hostname with your own worker URL.

## Polling headers

```txt
authorization={{ api_key }}&user-agent=trmnl-mod-analytics
```

While this is a generic field, the instructions vary per platform.

### Modrinth

The api key (PAT) provided is expected to have the PAYOUTS_READ scope.

## Returned JSON shape

```json
{
  "ok": true,
  "projects": [],
  "totals": {
    "downloads": 0,
    "projects": 0
  },
  "revenue": {
    "requested": false,
    "balanceUsd": null,
    "lastMonthUsd": null,
    "allTimeUsd": null,
    "unavailableReason": "Add a Modrinth PAT with PAYOUTS_READ to show revenue"
  },
  "generatedAt": "2026-06-05T12:14:00.000Z"
}
```
