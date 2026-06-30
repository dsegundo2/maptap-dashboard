# MapTap Dashboard

A mobile-first, login-free dashboard for comparing public [MapTap](https://maptap.gg) player scores. It is a fully static Vite site designed for GitHub Pages.

## Product decisions

- **Small roster first:** optimized for up to 10 players. Everyone stays visible; there is no search, pagination, account, or “my stats” state.
- **Named summaries:** 30-day stats always belong to an explicitly selected player.
- **Historical leaderboards:** previous/next arrows and an accessible calendar cover the rolling 30-day window, never earlier than June 1, 2026, including partial and empty days.
- **Fresh in the browser:** each page load revalidates public profiles against MapTap. A manual refresh bypasses the daily leaderboard cache URL and Share refreshes before composing its message.
- **Resilient on static hosting:** `public/data/scores.json` is the most recent generated fallback. A failed live request never blanks the dashboard.
- **Honest standings:** exact rank is used when MapTap publishes the player in its top list; otherwise rank and percentile use MapTap’s own public histogram method and are treated as estimates.
- **Useful iMessage sharing:** the Web Share payload includes the current leader and score. GitHub Actions regenerates the static 1200×630 Open Graph image hourly—the closest a serverless GitHub Pages site can get to on-demand link previews.

## Manage players

[`public/data/players.json`](public/data/players.json) is the single hand-edited player registry. Add, remove, reorder, or disable players only there:

```json
[
  {
    "maptapUsername": "PublicMapTapNickname",
    "displayName": "Dashboard name",
    "enabled": true
  }
]
```

- `maptapUsername` must exactly match the public MapTap nickname.
- `displayName` is the label shown throughout the dashboard.
- Set `enabled` to `false` to temporarily hide a player, or remove the object permanently.
- `temporary` is optional metadata for entries that will be removed later.

The registry is validated for required fields, duplicates, and the 10-player limit. [`public/data/scores.json`](public/data/scores.json) is generated from this registry and should not be edited manually. Requests are deliberately spaced by 650 ms when there is more than one player.

## Local development

Node 22 is pinned in `.tool-versions`.

```bash
asdf install
asdf exec npm install
asdf exec npm run data:refresh
asdf exec npm run dev
```

## Quality checks

```bash
asdf exec npm run lint
asdf exec npm test
asdf exec npm run build
asdf exec npm run test:ui
```

The UI suite is Chromium-only and starts the local Vite server automatically. Unit tests cover MapTap history normalization, global standing math, and small-group win summaries.

## Data flow

1. The browser reads the central player registry and config JSON.
2. It calls MapTap’s public `getPublicProfile` Firebase callable for each configured nickname.
3. It reads MapTap’s public daily leaderboard JSON for global totals and score buckets.
4. It calculates local group ranking, daily wins, streaks, and named 30-day summaries.
5. It stores the last successful live response in a five-minute local cache while still revalidating on load.
6. If live requests fail, the generated `scores.json` snapshot is shown with a clear status message.

No private credentials, scraping proxy, backend, or user login is required.

## GitHub Pages

[`pages.yml`](.github/workflows/pages.yml) runs on every push to `main`, hourly at minute 17, and on manual dispatch. It refreshes public data, runs lint/unit tests, generates the Open Graph PNG, builds with the repository base path, and deploys through the official Pages actions.

[`ci.yml`](.github/workflows/ci.yml) runs lint, unit tests, production build, and Chromium UI tests on pull requests and pushes to `main`.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Static-hosting limitation

GitHub Pages cannot execute code when Apple’s link-preview crawler requests a shared URL. The shared message text is live at tap time, but the visual Open Graph card can be up to one hour old. The scheduled workflow and five-minute MapTap leaderboard cache keep that window intentionally small without introducing a server.
