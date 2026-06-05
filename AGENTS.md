# 관리자 인계: 저널업로더

이 저장소는 저널 전용 미러/정적 사이트 레포다. 실제 운영 배포원은 `kukhwancho-netizen/another-pipe`이며, 어느 클라우드 Codex/Claude Code/관리자 세션이 "저널에 올려줘", "저널업로더", "초안 발행" 요청을 받으면 우선 `another-pipe`를 pull해서 실행한다.

## 실제 운영 레포

```text
https://github.com/kukhwancho-netizen/another-pipe
```

실제 운영 레포에서 읽을 파일:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/auctoritas-codex-posting-workflow.md`

운영 레포의 `--strict-seo`는 검색 구조뿐 아니라 기존 공개 저널 글과의 유사성도 검사한다. 초안이 짧거나 구어체이면 바로 발행하지 말고, 기존 글처럼 선비적인 법률 해설문 구조로 보강한 뒤 다시 통과시킨다.

## 이 레포에서 가능한 호환 명령

이 레포에도 같은 저널업로더 스크립트가 있다.

```powershell
npm run journal:uploader -- work/drafts.md --base-date auto --strict-seo
npm run journal:uploader:publish -- work/drafts.md --today-interval 10 --strict-seo
```

다만 공개 배포까지 책임지는 기본 루트는 `another-pipe`이다.

`SUPABASE_SERVICE_ROLE_KEY`는 절대 출력하거나 커밋하지 말고, 클라우드 관리자 실행 환경의 secret/env로만 받는다.
