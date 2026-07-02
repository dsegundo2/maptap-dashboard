# MapTap Dashboard

A mobile-first, login-free dashboard for comparing public [MapTap](https://maptap.gg) player scores. It is a fully static Vite site designed for GitHub Pages.

## Product decisions

- **Small roster first:** optimized for up to 10 players. Everyone stays visible; there is no search, pagination, account, or “my stats” state.
- **Named summaries:** 30-day stats always belong to an explicitly selected player.
- **Historical leaderboards:** previous/next arrows and an accessible calendar cover the rolling 30-day window, never earlier than June 1, 2026, including partial and empty days.
- **Spoiler-safe location trails:** past days show MapTap’s five round locations on a compact world map and numbered list. Today’s locations are never shipped into the rendered view.
- **Fresh in the browser:** each page load revalidates public profiles against MapTap. A manual refresh bypasses the daily leaderboard cache URL and Share refreshes before sending the dated link.
- **Resilient on static hosting:** `public/data/scores.json` is the most recent generated fallback. A failed live request never blanks the dashboard.
- **Honest standings:** exact rank is used when MapTap publishes the player in its top list; otherwise rank and percentile use MapTap’s own public histogram method and are treated as estimates.
- **Group-specific link sharing:** Share sends the selected group/day website URL. Each dated route has a purpose-built scoreboard preview image, so Messages and social apps show the correct group instead of a generic attachment. Browsers without native sharing copy the link.

## Manage groups and players

[`public/data/groups.json`](public/data/groups.json) is the single hand-edited registry. Each group id becomes a URL path (for example `/HB` and `/SB`), and each group owns a player list:

```json
{
  "defaultGroup": "HB",
  "groups": {
    "HB": {
      "name": "HB",
      "players": {
        "PublicMapTapNickname": "Dashboard name"
      }
    }
  }
}
```

- Each player is one line: `"MapTap username": "Dashboard display name"`.
- Add a line to add someone; delete that line to remove them.
- The username on the left must exactly match the public MapTap nickname.
- Profile URLs replace spaces with underscores. For a URL such as `https://maptap.gg/u/Diego_Dad`, use the visible profile name (`Diego Dad`) as `maptapUsername`, not the underscored URL slug.
- The display name on the right is the label shown throughout the dashboard.

Each roster is validated for required fields, duplicates, and the 10-player limit. [`public/data/scores.json`](public/data/scores.json) is generated for every group and should not be edited manually. Shared users are fetched once and reused across groups. Requests are deliberately spaced by 650 ms between unique players.

After editing the registry, run `asdf exec npm run data:refresh` and `asdf exec npm run test:ui` to refresh the fallback data and confirm every enabled player appears.

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
5. The refresh job archives MapTap’s five locations for the previous 29 dates using ISO keys, including across year boundaries, in `public/data/locations.json`.
6. It stores the last successful live response in a five-minute local cache while still revalidating on load.
7. If live requests fail, the generated `scores.json` snapshot is shown with a clear status message.

No private credentials, scraping proxy, backend, or user login is required.

## GitHub Pages

[`pages.yml`](.github/workflows/pages.yml) runs on every push to `main`, hourly at minute 17, and on manual dispatch. It refreshes public data, runs lint/unit tests, generates the Open Graph PNG, builds with the repository base path, and deploys through the official Pages actions.

[`ci.yml`](.github/workflows/ci.yml) runs lint, unit tests, production build, and Chromium UI tests on pull requests and pushes to `main`.

[`release.yml`](.github/workflows/release.yml) runs Release Please on every push to `main`. Conventional Commit prefixes determine semantic versions (`fix:` patch, `feat:` minor, and `feat!:` or `BREAKING CHANGE:` major). It maintains a release pull request with generated notes; merging that pull request creates the version tag and GitHub Release automatically.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Share previews on static hosting

The build generates Open Graph images and HTML entry routes for each group and each available day in the rolling 30-day data. That lets static GitHub Pages serve group-specific link previews without a backend.
