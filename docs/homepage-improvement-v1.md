# AUCTORITAS Journal Homepage Improvement v1

## Scope

This document is the completion contract for the first homepage improvement pass driven by Product Design and Data Analytics requirements.

The v1 goal is not a marketing redesign. It is a sober legal-journal homepage that helps three audiences:

- Readers find a legal issue by case type or natural-language question.
- Search engines and AI systems verify authority, crawl paths, and citation material.
- Operators measure which discovery routes and authority assets are being used.

## Product Design Requirements

| Requirement | v1 Evidence |
| --- | --- |
| Preserve the existing AUCTORITAS visual language | `index.html` keeps the existing masthead, restrained typography, full-width bands, square card grid, and existing CSS variables. |
| Make the first useful action issue-based, not marketing-led | `#caseFinder` exposes six practical issue paths: construction payment, interior defect, construction defect, lease restoration, real-estate provisional attachment, and eviction. |
| Support natural-language search behavior | `#searchQuestions` exposes six question cards matching likely pre-consultation searches. |
| Make authority inspectable, not merely claimed | `#authorityTitle` explains publisher/editorial authority, and `#citationPack` exposes source files that can be checked directly. |
| Keep mobile scanability | 390px Chrome capture confirms stacked cards without text overlap: `journal-homepage-citation-mobile.png`. |
| Avoid landing-page ornament | The homepage remains a dense journal surface with navigable issue, question, authority, citation, category, topic, and article sections. |

## Data Analytics Requirements

| Requirement | v1 Evidence |
| --- | --- |
| Keep GA unified with the main property | `index.html` uses `G-TC1HNLWLM6`, matching the existing unified property model. |
| Segment journal traffic by hostname | GA reports should filter `Hostname exactly matches journal.fightingspirit.kr`. |
| Measure homepage route clicks | `assets/common.js` sends `journal_home_route_click` for elements with `data-analytics-event`. |
| Measure key homepage section exposure | `assets/common.js` sends `journal_home_section_view` once per section when at least 35% enters the viewport. |
| Support route-level analysis | Homepage links include `route_type`, `route_name`, `route_topic`, and `route_query` where applicable. |
| Protect measurement from future regressions | `scripts/audit-discovery.mjs` requires the event names, analytics hooks, and Citation Pack links. |

## Event Dictionary

### `journal_home_route_click`

Sent when a measurable homepage route is clicked.

Parameters:

- `route_type`: `hero`, `case_finder`, `case_card`, `question_card`, `authority`, or `citation_pack`
- `route_name`: stable route key when the route is not topic-specific
- `route_topic`: human-readable legal topic for case/question cards
- `route_query`: natural-language question for question cards
- `page_path`
- `page_location`

Primary v1 questions:

- Which issue card is clicked most?
- Do question cards outperform topic cards?
- Does the Citation Pack get inspected?
- Do users move toward archive, query map, authority, or source files?

### `journal_home_section_view`

Sent once per measurable homepage section.

Parameters:

- `section_label`
- `page_path`
- `page_location`

Measured sections:

- `case_finder`
- `search_questions`
- `authority_strip`
- `citation_pack`

Primary v1 questions:

- Do users reach question search?
- Do users reach authority and citation material?
- Is the Citation Pack visible enough to justify its homepage position?

## GA4 v1 Exploration

Use one GA4 property and filter:

```text
Hostname exactly matches journal.fightingspirit.kr
```

Route-click table:

```text
Rows: Event name, route_type, route_name, route_topic, route_query
Metrics: Event count, Active users
Filter: Event name exactly matches journal_home_route_click
```

Section-view table:

```text
Rows: Event name, section_label
Metrics: Event count, Active users
Filter: Event name exactly matches journal_home_section_view
```

Homepage funnel approximation:

```text
Step 1: page_view where Page path = /
Step 2: journal_home_section_view where section_label = Case Finder
Step 3: journal_home_section_view where section_label = Search Questions
Step 4: journal_home_route_click
```

## Search And AI Authority Signals

The homepage now exposes both visible links and structured data for machine-readable authority.

Visible assets:

- `llms.txt`
- `llms-full.txt`
- `search-index.json`
- `.well-known/authority.json`
- `sitemap.xml`
- `feed.xml`

Structured data:

- `CollectionPage` for issue-based case finding
- `ItemList` for topic routes
- `FAQPage` for natural-language search questions
- `DataCatalog` for the Citation Pack and its datasets

## Verification Commands

Run from `fightingspirit-journal`:

```powershell
npm.cmd run check
npm.cmd run audit
git diff --check
```

Run from the live source repo `work/another-pipe-main`:

```powershell
npm.cmd run check
npm.cmd run audit
git diff --check
```

Public verification:

```powershell
curl.exe -L "https://journal.fightingspirit.kr/?v=cf7c9e9"
curl.exe -L "https://journal.fightingspirit.kr/assets/common.js?v=cf7c9e9"
```

Required public strings:

- `Citation Pack`
- `"@type": "DataCatalog"`
- `journal_home_route_click`
- `journal_home_section_view`

## v1 Completion Status

v1 is complete when all of the following are true:

- Product Design: issue paths, question paths, authority strip, Citation Pack, and mobile rendering are present.
- Data Analytics: route-click and section-view events are implemented and documented.
- SEO/AI: CollectionPage, ItemList, FAQPage, DataCatalog, llms files, search index, authority manifest, sitemap, and feed are linked.
- Audit: `npm.cmd run check`, `npm.cmd run audit`, and `git diff --check` pass in both the mirror repo and live source repo.
- Deployment: public `journal.fightingspirit.kr` serves the v1 homepage and common JS.
