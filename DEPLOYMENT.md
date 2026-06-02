# Deployment checklist

## Current state

- Repository: `https://github.com/kukhwancho-netizen/fightingspirit-journal`
- GitHub Pages source: GitHub Actions
- Latest deployed commit: `fb9d537`
- GitHub Pages custom domain setting: `journal.fightingspirit.kr`

## Required DNS change

`journal.fightingspirit.kr` currently resolves to the old Cloudflare Pages target:

```text
journal.fightingspirit.kr CNAME another-pipe.pages.dev
```

Change it to GitHub Pages:

```text
Type: CNAME
Name: journal
Target: kukhwancho-netizen.github.io
Proxy: DNS only
TTL: Auto
```

Keep GitHub Pages custom domain as:

```text
journal.fightingspirit.kr
```

After DNS changes propagate, return to:

```text
https://github.com/kukhwancho-netizen/fightingspirit-journal/settings/pages
```

Wait until the DNS check passes, then enable **Enforce HTTPS**.

## Verification URLs

These must return `200` from `journal.fightingspirit.kr`:

```text
https://journal.fightingspirit.kr/
https://journal.fightingspirit.kr/robots.txt
https://journal.fightingspirit.kr/sitemap.xml
https://journal.fightingspirit.kr/search-index.json
https://journal.fightingspirit.kr/query-map.html
https://journal.fightingspirit.kr/journal/
https://journal.fightingspirit.kr/topic/
```

`search-index.json` should include `topics[].queryTargets`, and `query-map.html` should include the heading `검색 질의 지도`.

## Search submission

Submit these after verification:

```text
Google Search Console: https://journal.fightingspirit.kr/sitemap.xml
Naver Search Advisor: https://journal.fightingspirit.kr/sitemap.xml
```

Then request indexing for:

```text
https://journal.fightingspirit.kr/
https://journal.fightingspirit.kr/journal/
https://journal.fightingspirit.kr/topic/
https://journal.fightingspirit.kr/query-map.html
```
