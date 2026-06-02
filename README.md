# fightingspirit-journal

AUCTORITAS LAB / 조국환 변호사팀 저널 전용 정적 사이트입니다.

이 레포는 `journal.fightingspirit.kr` 배포 루트를 기준으로 구성되어 있습니다. 글 원천은 Supabase `posts` 테이블이며, 빌드 시 정적 글 페이지, 주제 허브, 태그 페이지, RSS, sitemap, llms 파일, OG 이미지를 생성합니다.

## 핵심 구조

- `index.html`: 저널 홈
- `journal.html`: 전체 글 목록
- `journal-detail.html`: 정적 페이지 생성 전 임시 폴백
- `scripts/prerender.mjs`: 정적 페이지 생성기
- `journal/`: 빌드 시 생성되는 글 HTML
- `topic/`: 빌드 시 생성되는 검색 주제 허브
- `tag/`: 빌드 시 생성되는 태그 아카이브
- `sitemap.xml`: 검색엔진 제출용 URL 목록
- `search-index.json`: 주제·태그·글 URL 구조화 목록
- `opensearch.xml`: `journal.html?q={검색어}` 기반 사이트 검색 설명
- `llms.txt`, `llms-full.txt`: AI 검색·요약 에이전트용 콘텐츠 맵

## 검색 주제 허브

현재 생성기는 다음 주제 페이지를 고정 생성합니다.

- 인테리어 하자 분쟁
- 공사대금 청구소송
- 건설 하자 분쟁
- 상가 임대차 원상회복
- 부동산 가압류
- 명도소송

각 허브는 검색어와 같은 한글 정규 URL(`topic/공사대금-청구소송.html` 등)로 생성되고, 기존 영문 slug URL은 `noindex,follow` 호환 redirect로 남깁니다. `topic/index.html`은 전체 주제 인덱스로 생성됩니다. 관련 글은 자동으로 묶어 `CollectionPage` JSON-LD, `search-index.json`, sitemap에 포함합니다.

## 빌드

```bash
npm install
npm run build
```

문법 확인:

```bash
npm run check
```

## URL 정책

정규 글 URL은 제목 기반 slug를 사용합니다.

```text
/journal/{title-slug}-{shortId}.html
```

기존 ID 기반 URL은 호환을 위해 생성하되 `noindex,follow` redirect 페이지로 둡니다.

```text
/journal/{id}.html
```

## 배포

`CNAME`은 `journal.fightingspirit.kr`로 설정되어 있습니다. GitHub Pages 또는 정적 호스팅에서 저장소 루트를 배포 루트로 사용하면 됩니다.
