# AUCTORITAS Journal Lens Product Design

## 목적

`AUCTORITAS Journal Lens`는 `journal.fightingspirit.kr`을 별도 사이트처럼 운영하되, GA4 속성은 기존 `fightingspirit.kr`과 통합해 보는 저널 성과 화면이다.

목표는 세 가지다.

- 저널 글이 검색, AI, 레퍼럴에서 발견되는지 확인한다.
- 방문자가 글을 실제로 읽는지 확인한다.
- 저널이 본사이트 권위와 상담 의도 흐름에 기여하는지 확인한다.

## Product Design 브리프

Product Design 플러그인에는 아래 브리프를 넣어 화면 탐색과 프로토타입을 시작한다.

```text
Design a product concept for "AUCTORITAS Journal Lens".

Context:
We run a legal journal at journal.fightingspirit.kr. It is tracked inside the existing GA4 property for fightingspirit.kr. We want analytics to stay unified, but we need a dedicated view for journal performance.

Goal:
Help the operator understand whether journal articles are being discovered, read, and contributing to brand authority or consultation intent.

Primary user:
A law firm operator who checks performance weekly in 10 minutes.

Design needs:
1. A weekly dashboard for journal performance
2. A comparison between journal.fightingspirit.kr and the main website
3. A table of top journal articles
4. A source breakdown: Google organic, Naver, ChatGPT/AI, referral, direct
5. Signals for authority: engaged sessions, average engagement time, scroll, outbound clicks to main site
6. A simple weekly decision flow: keep, update, expand, or retire topics
7. A clean dashboard wireframe and product rationale

Constraints:
Use one GA4 property. Separate journal traffic with hostname = journal.fightingspirit.kr.
Do not create a separate analytics product unless there is a strong reason.
```

## Explore Options

Product Design에서 먼저 비교할 방향은 세 가지다. 지금 만든 프로토타입은 1안에 가깝다.

| Option | Direction | When To Use | Risk |
| --- | --- | --- | --- |
| 1. Operator Lens | GA 데이터를 10분 안에 판단하는 운영 대시보드 | 매주 검색 유입, 독서 품질, 본사이트 이동을 빠르게 판단할 때 | 너무 내부 운영 지표에 치우치면 콘텐츠 개선 힌트가 약해질 수 있음 |
| 2. Authority Map | 주제별 권위 축적과 글 묶음을 보는 콘텐츠 지도 | AI/검색이 특정 사안에서 브랜드를 얼마나 인식할지 판단할 때 | GA 지표만으로 권위 판단을 과장할 수 있음 |
| 3. Article Review Desk | 개별 글의 제목, 구조, FAQ, 내부 링크를 점검하는 편집 화면 | 새 글을 올리기 전 검색대상성과 신뢰 신호를 점검할 때 | 화면이 편집 체크리스트처럼 좁아질 수 있음 |

Recommended first move: build Option 1 as the main weekly dashboard, then add Option 3 as a per-article drilldown. Option 2 should become a quarterly review layer after enough article and query data accumulates.

## Improvement Pass 1

이번 개선은 `Operator Lens`를 더 권위 판단 도구처럼 보이게 만드는 데 집중한다.

| Improvement | Why It Matters | Prototype Change |
| --- | --- | --- |
| Weekly Verdict | 숫자만 보는 화면이면 사용자가 무엇을 해야 할지 늦게 판단한다. | 상단에 이번 주 판정과 Discoverability, Read Depth, Handoff, Next Move 점수를 추가한다. |
| Topic Surface | 검색대상성은 글 단위뿐 아니라 주제 묶음 단위로 판단해야 한다. | 부동산, 인테리어 공사, 행정 부담금 주제를 별도 표면으로 묶고 채널별 신호를 표시한다. |
| Action Reason | Expand, Refresh, Link, Observe가 왜 나왔는지 보이지 않으면 운영자가 신뢰하기 어렵다. | Top Articles 테이블에 Reason 컬럼을 추가해 추천 액션의 근거를 함께 보여준다. |
| Less Beige Dashboard Tone | 운영 도구가 한 가지 색감으로 읽히면 지표 위계가 약해진다. | 배경/라인을 더 중립적으로 바꾸고, 신호 색상만 green, blue, gold, red로 남긴다. |

## UI QA Pass

Product Design QA에서 확인한 화면 품질 기준은 다음과 같다.

| Area | Finding | Fix |
| --- | --- | --- |
| Desktop score cards | `DISCOVERABILITY` 라벨이 좁은 카드에서 살짝 빡빡했다. | 점수 라벨의 글자 크기와 줄바꿈 여유를 조정했다. |
| Mobile article table | 390px 폭에서 `Top Articles` 테이블이 페이지 전체 가로 넘침을 만들었다. | 모바일에서는 테이블 행을 카드형 레이아웃으로 전환하고 각 셀에 `Article`, `Topic`, `Source`, `Views`, `Avg`, `Reason`, `Action` 라벨을 표시한다. |
| Mobile scanability | 표를 그대로 축소하면 액션의 근거가 늦게 읽힌다. | 글별 카드 안에서 `Reason`과 `Action`을 하단에 붙여 판단 흐름을 유지한다. |

## 정보 구조

### 1. Weekly Pulse

첫 화면은 10분 안에 읽히는 주간 요약이어야 한다.

- 활성 사용자
- 세션
- 자연검색 세션
- 평균 참여 시간
- 스크롤 이벤트
- 본사이트 이동 클릭

판단 문장은 숫자보다 먼저 온다.

```text
이번 주 저널은 검색 유입이 늘었고, 참여 시간은 유지됐다.
다만 본사이트 이동 클릭이 약하므로 상위 글의 내부 링크를 보강한다.
```

### 2. Discovery

저널이 어디서 발견되는지 본다.

- Google organic
- Naver organic/referral
- ChatGPT/AI assistant
- Other referral
- Direct

GA4 차원 후보:

- `Session source / medium`
- `First user source / medium`
- `Default channel group`
- `Hostname`

### 3. Reading Quality

글이 단순히 열린 것인지, 읽힌 것인지 본다.

- Views
- Active users
- Average engagement time
- Engaged sessions
- Scroll events
- Engagement rate

GA4 차원 후보:

- `Page path + query string`
- `Page title`
- `Landing page + query string`

### 4. Authority Handoff

저널이 본사이트 권위와 상담 흐름으로 이어지는지 본다.

- `journal.fightingspirit.kr`에서 `www.fightingspirit.kr` 또는 `fightingspirit.kr`로 이동한 클릭
- 상담, 소개, 연락처, 변호사/팀 소개 페이지 이동
- 특정 주제 허브에서 본사이트로 이동한 흐름

필요 이벤트 후보:

- `click`
- `outbound_click`
- `scroll`
- `page_view`

## 와이어프레임

```text
+---------------------------------------------------------------+
| AUCTORITAS Journal Lens                         Last 7 days   |
+---------------------------------------------------------------+
| Summary                                                       |
| [Users] [Sessions] [Organic] [Avg engagement] [Scroll] [Clicks]|
+---------------------------------------------------------------+
| Discovery                         | Reading Quality           |
| Google organic   ####             | Avg engagement trend      |
| Naver            ##               | Scroll depth proxy        |
| ChatGPT / AI     #                | Engaged sessions          |
| Referral         ###              |                           |
+---------------------------------------------------------------+
| Authority Handoff                                            |
| Journal -> main site clicks / top destination pages           |
+---------------------------------------------------------------+
| Top Articles                                                  |
| Title | Topic | Source | Views | Users | Engagement | Action  |
+---------------------------------------------------------------+
| Weekly Decisions                                              |
| Expand | Refresh | Link better | Observe                       |
+---------------------------------------------------------------+
```

## 글별 액션 라벨

상위 글 테이블에는 운영 판단 라벨을 붙인다.

- `Expand`: 검색 유입과 참여 시간이 모두 좋다. 같은 주제의 후속 글을 만든다.
- `Refresh`: 유입은 있는데 참여 시간이 약하다. 제목, 요약, 초반 문단, FAQ를 보강한다.
- `Link`: 읽히지만 본사이트 이동이 약하다. 관련 본사이트 페이지나 상담 흐름 링크를 강화한다.
- `Observe`: 데이터가 아직 적다. 다음 주까지 유지 관찰한다.

## GA4 구현 레시피

### 기본 필터

```text
Hostname exactly matches journal.fightingspirit.kr
```

비교용 세그먼트:

```text
Hostname contains fightingspirit.kr
Hostname exactly matches journal.fightingspirit.kr
Hostname does not exactly match journal.fightingspirit.kr
```

### 맞춤 보고서 또는 탐색 보고서 구성

카드:

- Active users
- Sessions
- Views
- Average engagement time per active user
- Engaged sessions
- Event count where event name = scroll
- Event count where event name = click

표:

- Rows: `Page path + query string`, `Page title`
- Columns or filters: `Session source / medium`, `Default channel group`
- Metrics: `Views`, `Active users`, `Engaged sessions`, `Average engagement time`, `Event count`

유입 채널 표:

- Rows: `Session source / medium`
- Metrics: `Sessions`, `Active users`, `Engaged sessions`, `Views`
- Filter: `Hostname = journal.fightingspirit.kr`

본사이트 이동 표:

- Rows: `Link URL`
- Metrics: `Event count`, `Active users`
- Filter:
  - `Hostname = journal.fightingspirit.kr`
  - `Event name = click`
  - `Link URL contains fightingspirit.kr`

## 주간 점검 질문

매주 아래 순서로 본다.

1. 이번 주 저널 유입은 늘었나?
2. 자연검색 또는 AI 유입이 실제로 생겼나?
3. 많이 읽힌 글은 어느 주제인가?
4. 참여 시간은 충분한가?
5. 읽힌 글에서 본사이트로 넘어갔나?
6. 확장할 주제와 보강할 글은 무엇인가?

## 운영 출력 형식

주간 보고서는 아래 형식으로 짧게 남긴다.

```text
[AUCTORITAS Journal Lens Weekly]
- 발견성: Google organic / Naver / AI 유입 변화
- 읽힘: 상위 글과 평균 참여 시간
- 기여도: 본사이트 이동 클릭과 목적지
- 다음 액션: Expand / Refresh / Link / Observe
```

## 다음 구현 과제

- GA4 탐색 보고서에 `Journal Lens` 템플릿을 만든다.
- 저널 글 본문 하단 또는 관련 글 영역에 본사이트 목적지 링크를 더 명확히 둔다.
- 주제 허브별 성과를 보기 위해 `topic` URL별 별도 표를 만든다.
- `chatgpt.com`, `perplexity.ai`, `claude.ai` 등 AI referral을 묶어 보는 채널 그룹을 정의한다.
