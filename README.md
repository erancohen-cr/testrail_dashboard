# Test Status Reporter

Executive status dashboard and test-case review over TestRail cloud.

- **Status**: pick a project, then any mix of test plans, test runs, features and feature suites. Each selection gets a scorecard, and clicking one opens the drill-down (Plans & runs / Sections / Tests).
- **Features**: shared feature definitions (sources + suites/sections + case filters) and feature suites (groups of features). Stored in SQLite.
- **Test review**: section tree with recursive counts, case table with column chooser, sort, search, filters, expandable steps, and CSV export.
- **Settings**: by default everyone reads TestRail through the shared readonly account. A user can save their own TestRail key instead; it is kept AES-GCM encrypted in an httpOnly cookie.

## Numbers
- Plan and run cards show raw TestRail counts, matching TestRail's own pages.
- Feature, feature-suite and Overall cards de-duplicate by case, keeping the test with the most recent result.
- Progress = executed / total, where executed means anything except Untested.

## Run
```bash
cp .env.example .env.local   # fill in TESTRAIL_RO_EMAIL, TESTRAIL_RO_KEY, APP_SECRET
npm install
npm run dev
npm test                     # aggregation checks
```
Requires Node ≥ 22.13 (uses the built-in `node:sqlite`).

## Docker
```bash
docker build -t testrail-dashboard .
docker run -p 3000:3000 --env-file .env.local -v trd-data:/app/data testrail-dashboard
```
Serve it over HTTPS, or set `INSECURE_COOKIES=1` for plain http on an internal host.

TestRail responses are cached in memory for `CACHE_TTL_S` seconds (default 300) per user, endpoint and params. **Refresh results** bypasses the cache.
