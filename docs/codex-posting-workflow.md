# 저널업로더

저널업로더는 대시보드 클릭 자동화 대신 Codex나 Claude Code가 초안을 검증하고 Supabase `posts` payload를 만드는 발행 루트다. 목표는 단순 업로드가 아니라 검색 질의에 걸릴 문서 구조를 일관되게 만드는 것이다.

## 클라우드 관리자 인계

실제 운영 배포원은 `kukhwancho-netizen/another-pipe`이다. 어느 클라우드 Codex/Claude Code 세션이든 "저널에 올려줘" 요청을 받으면 우선 `another-pipe`를 pull하고, 그 레포의 `AGENTS.md`, `CLAUDE.md`, `docs/auctoritas-codex-posting-workflow.md`를 읽는다.

이 레포의 저널업로더는 호환용이다. 실제 공개 배포까지 책임지는 기본 루트는 `another-pipe`이다.

`SUPABASE_SERVICE_ROLE_KEY`는 레포, 문서, 로그에 남기지 않는다. 클라우드 실행 환경의 secret 또는 세션 환경변수로만 제공한다.

실행 별칭은 다음을 기본으로 쓴다.

- 준비/검증: `npm run journal:uploader`
- DB 등록/예약: `npm run journal:uploader:publish`
- 기존 호환 명령: `npm run posts:prepare`, `npm run posts:publish`

## 결론

- 이미지는 제외한다.
- 본문은 기본적으로 `<h2>`, `<h3>`, `<p>`, `<strong>`만 쓰는 semantic HTML로 저장한다.
- 기존 plain text 글도 계속 렌더링되지만, 신규 Codex 발행 글은 검색대상성을 위해 HTML 구조를 쓴다.
- `작성: 조국환 변호사팀 | AUCTORITAS LAB`은 자동으로 붙인다.
- 직접 예약은 `status=published`와 미래 `publish_at` 조합을 쓴다.
- 정적 빌드는 미래 글의 상세 페이지와 OG를 미리 만들고, 목록·feed·sitemap·search-index에는 공개 시점 전까지 숨긴다.

## 초안 형식

```md
## 초안 #1
제목:
요약:
분류: CIVIL
검색질의: 공사대금 청구소송 하자 항변, 공사대금 상계, 기성고 감정
태그: #태그1, #태그2, #태그3, #태그4, #태그5, #태그6, #태그7, #태그8
본문:
첫 문단입니다.

중간 제목입니다.

본문 문단입니다.

자주 묻는 질문

질문 문장

답변 문장
```

분류는 `PRECEDENT`, `CIVIL`, `ADMIN`, `FAMILY` 중 하나다. 생략하면 태그와 본문으로 추론하고, 그래도 애매하면 `CIVIL`을 쓴다.

## 검색대상성 규칙

- 제목에는 주 검색질의가 자연스럽게 들어가야 한다.
- 요약은 60~170자 권장이다.
- 본문 초반 320자 안에 주 검색질의 또는 핵심 쟁점이 들어가야 한다.
- 본문은 최소 3개 이상의 `<h2>` 섹션을 갖는 것이 좋다.
- FAQ는 `<h2>자주 묻는 질문</h2>` 아래 질문을 `<h3>`, 답변을 `<p>`로 만든다.
- 태그는 최소 8개를 권장하며, 검색질의와 실무 쟁점을 섞는다.
- 불필요한 `<div>`, `<span>`, 인라인 스타일은 쓰지 않는다.

## 준비만 하기

```powershell
npm run journal:uploader -- work/drafts.md --base-date 2026-06-03
```

결과는 `work/prepared-posts.json`에 저장된다. 태그가 8개 미만이거나 제목·본문이 비면 실패한다. 검색 구조 문제는 `warnings`로 표시된다. 경고까지 실패로 보고 싶으면 `--strict-seo`를 붙인다.

### 오늘 바로 공개하기

사용자가 "예약 없이 오늘 올려"라고 하면 예약 슬롯을 잡지 말고 모든 글을 오늘 날짜의 즉시 공개 글로 준비한다.

```powershell
npm run journal:uploader:publish -- work/drafts.md --publish-today --strict-seo
```

이 모드는 `date`를 오늘로 두고 `publish_at`을 비워서 공개 저널 목록, sitemap, search-index에 바로 들어가게 한다.

### 오늘 10분 간격으로 예약하기

사용자가 "오늘 10분 간격 예약"을 요청하면 오늘 남은 시간 안에서 현재 시각 이후의 10분 단위 슬롯으로 배정한다.

```powershell
npm run journal:uploader:publish -- work/drafts.md --today-interval 10 --strict-seo
```

첫 시각을 직접 정해야 하면 아래처럼 쓴다.

```powershell
npm run journal:uploader:publish -- work/drafts.md --today-interval 10 --today-start 13:00 --strict-seo
```

### 공개 저널 기준으로 빈날 채우기

예약 배치는 관리자 화면의 마지막 예약일이 아니라 공개 저널에 실제로 보이는 글의 날짜별 개수를 기준으로 잡는다. 미래 예약글은 공개 저널에 아직 보이지 않으므로 빈날 계산에서 제외한다.

```powershell
npm run journal:uploader:publish -- work/drafts.md --fill-visible-gaps --strict-seo
```

이 모드는 오늘부터 공개 글이 3개 미만인 날짜를 먼저 채우고, 05:10 / 07:10 / 09:10 순서로 배정한다.

## 바로 DB에 예약 등록하기

서비스 롤 키는 절대 커밋하지 말고 환경변수로만 둔다.

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY='...'
npm run journal:uploader:publish -- work/drafts.md --base-date auto
```

`--base-date auto`는 Supabase에서 가장 늦은 `publish_at`을 읽고 그 다음 날부터 하루 3개씩 배정한다.

## 예약 시간

- 1번째 글: 05:10
- 2번째 글: 07:10
- 3번째 글: 09:10
- 4번째 글부터 다음 날짜로 넘어간다.

## 발행 후 배포

DB에 넣은 뒤에는 한 번 빌드와 배포를 돌린다.

```powershell
npm run build
npm run audit
git add -A
git commit -m "Schedule journal posts"
git push origin main
```

미래 글은 상세 페이지와 OG만 미리 생성되고, 목록·RSS·sitemap·검색 인덱스에는 공개 시점 전까지 들어가지 않는다.
