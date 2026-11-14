# swedish-news-app

A dual-language (Swedish original, English translation) aggregator of Swedish news headlines. Collects short items from the public RSS feeds of the ten most-used Swedish news sites, stores them as JSON files in a git repository, and publishes a static JSON API, RSS/Atom/JSON feeds, a NewsNow-style headline stream, and a scrolling ticker.

See [SPEC.md](SPEC.md) for the full specification and [sources.yaml](sources.yaml) for the source list.

## Development

```
npm install
npm run check          # typecheck + lint + tests
npm run cli -- sources # list configured sources
```

Requires Node 24 or newer (TypeScript runs natively, no build step for development).
