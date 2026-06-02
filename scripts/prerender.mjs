#!/usr/bin/env node
// AUCTORITAS LAB — 빌드 타임 사전 렌더링
//
// Supabase에서 published 글을 받아 다음을 생성한다:
//   - journal/{title-slug}-{id}.html (Article JSON-LD + 본문 정적 HTML)
//   - journal/{id}.html              (기존 URL 호환용 noindex redirect)
//   - topic/{slug}.html              (검색 주제별 허브, CollectionPage JSON-LD)
//   - tag/{slug}.html                (태그별 인덱스 페이지, CollectionPage JSON-LD)
//   - feed.xml                       (RSS 2.0, 최신 30건)
//   - llms-full.txt                  (전체 본문 합본)
//   - sitemap.xml                    (글 URL + 주제/태그 페이지 URL 포함)
//   - og/{id}.png                    (글마다 OG 이미지, 1200×630)
//   - og/default.png                 (홈·about·journal용 기본 OG)
//
// 런타임: Node 20+. 의존성: satori, @resvg/resvg-js (OG 생성용).

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = 'https://journal.fightingspirit.kr';

const SB_URL = 'https://cbdyclovsybrxhpgpjbo.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZHljbG92c3licnhocGdwamJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjE5MzEsImV4cCI6MjA5NDQzNzkzMX0.kEfbLtW4ugwAYfh7NWucXbDZarpY_4fbK3Wthov_PRk';

const SERIES_LABEL = { PRECEDENT: '판례분석', CIVIL: '민사', ADMIN: '행정', FAMILY: '가사' };

const TOPIC_PAGES = [
  {
    slug: '인테리어-하자-분쟁',
    legacySlug: 'interior-defect-dispute',
    name: '인테리어 하자 분쟁',
    title: '인테리어 하자 분쟁 대응 저널',
    description: '인테리어 공사 하자, 부실시공, 하자보수, 손해배상, 공사대금 방어 쟁점을 모은 조국환 변호사팀의 실무 저널입니다.',
    keywords: ['인테리어', '하자', '부실시공', '하자보수', '손해배상', '공사대금', '상계'],
    queryTargets: ['인테리어 하자 분쟁', '인테리어 하자 소송', '인테리어 부실시공 손해배상', '인테리어 하자보수 거절', '인테리어 공사대금 하자 항변', '인테리어 하자 감정'],
    checkpoints: ['계약서와 견적서의 공사 범위 특정', '하자 사진·영상·감정자료 확보', '하자보수 요구와 대금 지급 거절의 순서', '손해배상·상계 항변의 증명 구조'],
    faq: [
      ['인테리어 하자 분쟁에서 먼저 확보할 자료는 무엇인가요?', '계약서, 견적서, 설계도면, 시공 전후 사진, 하자 부위 영상, 하자보수 요청 내역, 대금 지급 자료를 함께 정리하는 것이 출발점입니다.'],
      ['하자가 있으면 공사대금 지급을 거절할 수 있나요?', '하자의 정도, 계약 내용, 이미 완성된 공사의 가치, 하자보수 가능성에 따라 판단이 달라집니다. 지급 거절, 감액, 손해배상, 상계 주장을 구분해 검토해야 합니다.'],
      ['인테리어 하자 감정은 언제 필요하나요?', '하자 원인, 보수비, 미시공 범위, 완성도를 다투는 사건에서는 사진만으로 부족할 수 있어 감정 절차가 핵심 쟁점이 되는 경우가 많습니다.']
    ]
  },
  {
    slug: '공사대금-청구소송',
    legacySlug: 'construction-payment-lawsuit',
    name: '공사대금 청구소송',
    title: '공사대금 청구소송 실무 저널',
    description: '공사대금 청구소송, 하자 항변, 상계, 추가공사대금, 기성고 다툼과 관련한 판례·실무 쟁점을 정리합니다.',
    keywords: ['공사대금', '청구소송', '하자', '항변', '상계', '추가공사', '기성고'],
    queryTargets: ['공사대금 청구소송', '공사대금 분쟁', '공사대금 하자 항변', '공사대금 상계', '추가공사대금 청구', '기성고 공사대금 소송'],
    checkpoints: ['도급계약·견적서·정산합의의 우선순위', '추가공사 지시와 승인 자료', '하자 항변과 상계 주장의 입증자료', '기성고·완성도·감정 절차의 대응'],
    faq: [
      ['공사대금 청구소송에서 핵심 쟁점은 무엇인가요?', '계약상 공사 범위, 완성 여부, 기성고, 추가공사 합의, 하자 존재, 정산 합의가 주된 쟁점입니다. 각 쟁점마다 필요한 증거가 다릅니다.'],
      ['하자 항변과 상계는 어떻게 다릅니까?', '하자 항변은 청구된 공사대금의 지급 범위 자체를 다투는 주장이고, 상계는 별도의 손해배상채권 등을 공사대금채권과 맞세우는 구조입니다.'],
      ['추가공사대금은 어떤 자료로 입증하나요?', '추가공사 지시, 견적 변경, 메시지, 현장 사진, 자재 반입 내역, 정산서, 세금계산서 등 실제 합의와 시공을 보여주는 자료가 중요합니다.']
    ]
  },
  {
    slug: '건설-하자-분쟁',
    legacySlug: 'construction-defect-dispute',
    name: '건설 하자 분쟁',
    title: '건설 하자 분쟁 대응 저널',
    description: '건설 하자, 하자보수, 손해배상, 감정, 도급계약 분쟁에서 자주 문제 되는 법률 쟁점을 모았습니다.',
    keywords: ['건설', '하자', '하자보수', '손해배상', '감정', '도급', '부실시공'],
    queryTargets: ['건설 하자 분쟁', '건설 하자 소송', '건설 하자보수 손해배상', '건설 하자 감정', '도급계약 하자 분쟁', '부실시공 소송'],
    checkpoints: ['하자 발생 시점과 책임기간', '하자보수비 산정과 감정 신청', '사용승인·인도 이후 발견된 하자', '도급인·수급인·하수급인 책임 구분'],
    faq: [
      ['건설 하자 분쟁에서 하자보수비는 어떻게 산정하나요?', '하자의 범위, 보수 방법, 자재와 인건비, 철거·재시공 필요성, 감정 결과에 따라 산정됩니다. 단순 견적만으로는 다툼이 남을 수 있습니다.'],
      ['사용승인 후 발견된 하자도 문제 삼을 수 있나요?', '사용승인이나 인도 이후 발견된 하자라도 계약 내용, 보증기간, 하자 성격, 발견 시점에 따라 책임 추궁 가능성이 달라집니다.'],
      ['건설 하자 소송에서 감정이 중요한 이유는 무엇인가요?', '하자의 원인과 보수비는 전문 판단이 필요한 경우가 많아, 감정 결과가 손해액과 책임 범위를 가르는 핵심 자료가 될 수 있습니다.']
    ]
  },
  {
    slug: '상가-임대차-원상회복',
    legacySlug: 'lease-restoration',
    name: '상가 임대차 원상회복',
    title: '상가 임대차 원상회복 분쟁 저널',
    description: '상가 임대차 종료, 원상회복, 보증금 반환, 시설물 철거와 관련한 임대인·임차인 분쟁 쟁점을 다룹니다.',
    keywords: ['상가', '임대차', '원상회복', '보증금', '시설물', '철거', '임차인', '임대인'],
    queryTargets: ['상가 임대차 원상회복', '상가 원상회복 분쟁', '상가 보증금 원상회복 공제', '상가 시설물 철거 분쟁', '임대차 종료 원상회복', '상가 임차인 원상회복 의무'],
    checkpoints: ['임대차계약서의 원상회복 특약', '입점 전 상태와 인테리어 변경 범위', '보증금 공제와 원상회복 비용 산정', '권리금·시설물 인수와 철거 책임'],
    faq: [
      ['상가 임대차 원상회복 범위는 어떻게 정해지나요?', '계약서 특약, 입점 당시 상태, 임대인의 동의, 시설물 설치 경위, 권리금·시설 인수 약정 등을 종합해 판단합니다.'],
      ['임대인이 보증금에서 원상회복 비용을 공제할 수 있나요?', '원상회복 의무와 비용 발생이 인정되는 범위에서는 공제가 문제될 수 있지만, 비용의 필요성과 금액은 별도로 다툴 수 있습니다.'],
      ['이전 임차인의 시설을 인수한 경우에도 철거해야 하나요?', '시설 인수 약정, 임대인의 승낙, 계약 종료 시 특약에 따라 달라집니다. 인수 사실만으로 항상 철거 책임이 사라지는 것은 아닙니다.']
    ]
  },
  {
    slug: '부동산-가압류',
    legacySlug: 'real-estate-provisional-attachment',
    name: '부동산 가압류',
    title: '부동산 가압류 실무 저널',
    description: '부동산 가압류 신청, 보전처분, 담보제공, 집행해제와 관련한 실무상 판단 기준을 정리합니다.',
    keywords: ['부동산', '가압류', '보전처분', '담보제공', '집행해제', '채권', '강제집행'],
    queryTargets: ['부동산 가압류', '부동산 가압류 신청', '부동산 가압류 해제', '부동산 가압류 담보제공', '보전처분 부동산 가압류', '채권 회수 부동산 가압류'],
    checkpoints: ['피보전권리와 보전의 필요성 소명', '부동산 시가·선순위 권리 확인', '담보제공 방식과 금액 예상', '가압류 이의·취소·해제 대응'],
    faq: [
      ['부동산 가압류를 신청하려면 무엇을 소명해야 하나요?', '채권이 존재한다는 피보전권리와, 판결 전 재산 보전이 필요하다는 보전의 필요성을 자료로 소명해야 합니다.'],
      ['부동산 가압류 담보금은 어떻게 정해지나요?', '청구금액, 부동산 가치, 사안의 소명 정도, 상대방 손해 가능성 등을 고려해 법원이 담보제공 방식을 정합니다.'],
      ['이미 가압류된 부동산을 해제할 수 있나요?', '담보 제공, 이의·취소 신청, 본안 진행 상황, 채권 소멸 사유 등에 따라 해제나 취소를 검토할 수 있습니다.']
    ]
  },
  {
    slug: '명도소송',
    legacySlug: 'eviction-lawsuit',
    name: '명도소송',
    title: '명도소송·점유이전 대응 저널',
    description: '명도소송, 점유이전금지가처분, 임대차 종료, 불법점유와 관련한 소송 전략과 판례 쟁점을 모았습니다.',
    keywords: ['명도소송', '명도', '점유', '점유이전금지가처분', '임대차', '불법점유', '인도'],
    queryTargets: ['명도소송', '명도소송 절차', '점유이전금지가처분', '임대차 종료 명도소송', '차임 연체 명도소송', '불법점유 명도'],
    checkpoints: ['임대차 종료 사유와 해지 통지', '점유자 특정과 점유이전금지가처분', '차임 연체·무단점유 자료 확보', '인도 집행 전후 비용 정산'],
    faq: [
      ['명도소송 전에 점유이전금지가처분이 필요한가요?', '점유자가 바뀔 위험이 있거나 실제 점유관계가 불안정한 경우에는 본안 소송 전 가처분을 함께 검토하는 경우가 많습니다.'],
      ['차임 연체만으로 명도소송이 가능한가요?', '연체 기간과 금액, 계약 해지 통지, 임대차 종류, 갱신 여부에 따라 다릅니다. 해지 요건과 통지 자료를 먼저 확인해야 합니다.'],
      ['명도 판결 후 바로 강제집행이 가능한가요?', '판결 확정 여부, 집행문, 송달·확정증명, 점유자 특정, 현장 상황 등 집행 요건을 갖춘 뒤 강제집행 절차로 넘어갑니다.']
    ]
  }
];

const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const escXml  = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&apos;','"':'&quot;' }[c]));
const stripTags = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function uniqueList(items) {
  return [...new Set(items.map(x => String(x || '').trim()).filter(Boolean))];
}

function topicQueryTargets(topic) {
  return uniqueList([topic.name, ...(topic.queryTargets || [])]);
}

function slugifyText(value, maxLen = 86) {
  const slug = String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.slice(0, maxLen).replace(/-$/g, '');
}

function shortId(p) {
  return String(p?.id ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8) || 'article';
}

function articleSlug(p) {
  const base = slugifyText(p.title) || `article-${shortId(p)}`;
  return `${base}-${shortId(p)}`;
}

function articleUrl(p) {
  return `${SITE}/journal/${encodeURIComponent(articleSlug(p))}.html`;
}

function articleHref(p, from = 'root') {
  const file = `${encodeURIComponent(articleSlug(p))}.html`;
  if (from === 'same-dir') return `./${file}`;
  if (from === 'subdir') return `../journal/${file}`;
  return `journal/${file}`;
}

function topicUrl(topic) {
  return `${SITE}/topic/${encodeURIComponent(topic.slug)}.html`;
}

function topicHref(topic, from = 'root') {
  const file = `${encodeURIComponent(topic.slug)}.html`;
  if (from === 'subdir') return `../topic/${file}`;
  return `topic/${file}`;
}

function postSearchText(p) {
  return [
    p.title,
    p.summary,
    stripTags(p.content),
    ...normalizeTags(p.tags)
  ].join(' ').toLowerCase();
}

function scorePostForTopic(topic, p) {
  const text = postSearchText(p);
  return topic.keywords.reduce((score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

function topicPosts(topic, posts) {
  return posts
    .map(p => ({ p, score: scorePostForTopic(topic, p) }))
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map(x => x.p);
}

function matchingTopicsForPost(p) {
  return TOPIC_PAGES
    .map(topic => ({ topic, score: scorePostForTopic(topic, p) }))
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map(x => x.topic);
}

async function fetchPosts() {
  const base = `${SB_URL}/rest/v1/posts?status=eq.published`
    + `&order=publish_at.desc.nullslast,date.desc,id.desc`;
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  let r = await fetch(`${base}&select=id,title,summary,content,series,date,publish_at,updated_at,tags`, { headers });
  if (!r.ok) {
    const body = await r.text();
    if (body.includes('tags') && (body.includes('does not exist') || body.includes('column'))) {
      console.warn('tags 컬럼 없음 — fallback. migrations/20260521_add_tags.sql 실행 필요.');
      r = await fetch(`${base}&select=id,title,summary,content,series,date,publish_at,updated_at`, { headers });
      if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
      const rows = await r.json();
      return rows.map(p => ({ ...p, tags: [] }));
    }
    throw new Error(`Supabase ${r.status}: ${body}`);
  }
  return r.json();
}

function isVisiblePost(p, now = new Date()) {
  if (!p.publish_at) return true;
  const ts = Date.parse(p.publish_at);
  return Number.isNaN(ts) || ts <= now.getTime();
}

// 태그 정규화: 공백 제거, 빈 값 필터.
function normalizeTags(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(t => String(t || '').trim()).filter(Boolean);
}

// URL slug — 한국어 그대로 사용 가능 (encodeURIComponent로 안전).
// 파일명도 한글 OK (GitHub Pages가 UTF-8 파일명 지원).
function tagSlug(tag) {
  return tag.trim().replace(/\s+/g, '-');
}
function tagUrl(tag) {
  return `${SITE}/tag/${encodeURIComponent(tagSlug(tag))}.html`;
}
function tagHref(tag, fromArticle) {
  // 글 상세 페이지에서 태그 페이지로 갈 때 상대 경로
  const slug = encodeURIComponent(tagSlug(tag));
  return fromArticle ? `../tag/${slug}.html` : `./tag/${slug}.html`;
}

function discoveryLinksHtml() {
  return `<link rel="alternate" type="application/rss+xml" title="AUCTORITAS LAB 법률 저널 RSS" href="${SITE}/feed.xml">
<link rel="alternate" type="application/json" title="AUCTORITAS LAB 검색 인덱스" href="${SITE}/search-index.json">
<link rel="alternate" type="application/json" title="AUCTORITAS LAB 권위 근거 manifest" href="${SITE}/.well-known/authority.json">
<link rel="author" href="${SITE}/authority.html">
<link rel="sitemap" type="application/xml" title="Sitemap" href="${SITE}/sitemap.xml">
<link rel="search" type="application/opensearchdescription+xml" title="AUCTORITAS LAB 검색" href="${SITE}/opensearch.xml">`;
}

function navHtml() {
  return `<nav class="top" aria-label="주메뉴">
<a href="../index.html" class="logo">AUCTORITAS LAB<span class="sub">공간분쟁 전문 조국환 변호사팀</span></a>
<ul class="nav-links">
<li><a href="../index.html">HOME</a></li>
<li><a href="../journal.html">JOURNAL</a></li>
<li><a href="../authority.html">PRINCIPLES</a></li>
<li><a href="../about.html">ABOUT</a></li>
</ul>
</nav>`;
}

function footerHtml() {
  return `<footer>
<div class="ft-inner">
<div class="ft-brand">
<div class="name">AUCTORITAS<span style="color:var(--vermillion)">.</span></div>
<div class="tagline">공간분쟁 전문팀 · Legal Journal</div>
<address class="legal" style="font-style:normal">조국환 변호사팀 | AUCTORITAS LAB<br>공간분쟁 전문 변호사팀이 직접 쓰는<br>판례·실무 저널</address>
</div>
<div>
<div class="ft-h">Contact</div>
<div class="ft-line"><strong>031-546-3997</strong></div>
<div class="ft-line">031-546-3998 (FAX)</div>
<div class="ft-line"><a href="mailto:info@fightingspirit.kr">info@fightingspirit.kr</a></div>
<div class="ft-line"><a href="https://www.fightingspirit.kr" target="_blank" rel="noopener">발행팀 홈페이지 →</a></div>
</div>
<div>
<div class="ft-h">Address</div>
<div class="ft-line">경기도 수원시 영통구<br>광교중앙로 248번길 7-2<br>원희캐슬법조타운 B동 401호</div>
<div class="ft-line" style="margin-top:10px"><a href="https://instagram.com/auctoritas_journal" target="_blank" rel="noopener">@auctoritas_journal</a></div>
</div>
</div>
<div class="ft-bot">
<span>© 2026 AUCTORITAS · 공간분쟁 전문팀</span>
<span>Republic of Korea · Nationwide Practice</span>
</div>
</footer>`;
}

function recentSidebar(posts, currentId) {
  const others = posts.filter(p => p.id !== currentId).slice(0, 5);
  if (!others.length) return '<div style="font-family:var(--sans);font-size:12px;color:var(--fg-3)">다른 글이 아직 없습니다.</div>';
  return others.map((x, i) => {
    const lbl = SERIES_LABEL[x.series] || x.series || '';
    return `<a href="${articleHref(x, 'same-dir')}" class="recent-row"><div class="rn">${String(i+1).padStart(2,'0')}</div><div><div class="rc">${escHtml(lbl)}</div><div class="rt">${escHtml(x.title)}</div></div></a>`;
  }).join('');
}

function articleHtml(p, allPosts) {
  const label = SERIES_LABEL[p.series] || p.series || '';
  const pageUrl = articleUrl(p);
  const desc = p.summary || stripTags(p.content).substring(0, 160);
  const datePublished = p.publish_at || (p.date ? p.date.replace(/\./g, '-') + 'T00:00:00+09:00' : '');
  const dateModified = p.updated_at || datePublished;
  const tags = normalizeTags(p.tags);
  const relatedTopics = matchingTopicsForPost(p).slice(0, 4);
  const keywordsList = uniqueList([
    label,
    ...tags,
    ...relatedTopics.flatMap(topic => [topic.name, ...topic.keywords]),
    '공간분쟁',
    '조국환변호사',
    'AUCTORITAS'
  ]);
  const wordCount = stripTags(p.content).split(/\s+/).filter(Boolean).length;

  const articleJsonld = {
    "@type": "BlogPosting",
    "headline": p.title,
    "description": desc,
    "datePublished": datePublished,
    "dateModified": dateModified,
    "author": {
      "@type": "Person",
      "name": "조국환",
      "honorificPrefix": "변호사",
      "jobTitle": "변호사",
      "url": "https://www.fightingspirit.kr",
      "worksFor": {
        "@type": "LegalService",
        "name": "조국환 변호사팀",
        "alternateName": "AUCTORITAS LAB",
        "url": SITE,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "광교중앙로 248번길 7-2 원희캐슬법조타운 B동 401호",
          "addressLocality": "수원시 영통구",
          "addressRegion": "경기도",
          "postalCode": "16512",
          "addressCountry": "KR"
        },
        "areaServed": "KR",
        "telephone": "+82-31-546-3997",
        "email": "info@fightingspirit.kr"
      },
      "knowsAbout": ["공간분쟁","공사대금","부동산","임대차","재건축","도시정비","인허가","행정심판","가사","상속"]
    },
    "publisher": {
      "@type": "Organization",
      "name": "AUCTORITAS LAB",
      "url": SITE,
      "logo": { "@type": "ImageObject", "url": `${SITE}/assets/logo.png` }
    },
    "url": pageUrl,
    "mainEntityOfPage": pageUrl,
    "inLanguage": "ko",
    "articleSection": label,
    "keywords": keywordsList,
    "wordCount": wordCount,
    "image": `${SITE}/og/${p.id}.png`,
    "about": relatedTopics.map(topic => ({
      "@type": "Thing",
      "name": topic.name,
      "url": topicUrl(topic)
    })),
    "isPartOf": {
      "@type": "Blog",
      "name": "AUCTORITAS LAB 법률 저널",
      "url": SITE
    }
  };
  const breadcrumbJsonld = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "AUCTORITAS LAB", "item": `${SITE}/` },
      { "@type": "ListItem", "position": 2, "name": "Journal", "item": `${SITE}/journal.html` },
      { "@type": "ListItem", "position": 3, "name": p.title, "item": pageUrl }
    ]
  };
  const jsonld = { "@context": "https://schema.org", "@graph": [articleJsonld, breadcrumbJsonld] };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(p.title)} | AUCTORITAS LAB 법률 저널</title>
<meta name="description" content="${escHtml(desc)}">
<meta name="keywords" content="${escHtml(keywordsList.join(','))}">${tags.map(t => `\n<meta property="article:tag" content="${escHtml(t)}">`).join('')}
<meta name="robots" content="index,follow">
<meta name="author" content="조국환 변호사팀 | AUCTORITAS LAB">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="AUCTORITAS LAB">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${escHtml(p.title)} | AUCTORITAS LAB">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${SITE}/og/${p.id}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escHtml(p.title)} — AUCTORITAS LAB">
<meta property="article:published_time" content="${escHtml(datePublished)}">
<meta property="article:modified_time" content="${escHtml(dateModified)}">
<meta property="article:section" content="${escHtml(label)}">
<meta property="article:author" content="조국환 변호사팀 | AUCTORITAS LAB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(p.title)} | AUCTORITAS LAB">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${SITE}/og/${p.id}.png">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
${discoveryLinksHtml()}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link rel="stylesheet" href="../assets/common.css">
<style>
.container{max-width:1400px;margin:0 auto;padding:60px 40px 120px;display:grid;grid-template-columns:1fr 320px;gap:80px}
.breadcrumb{font-family:var(--label);font-size:10px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:40px}
.breadcrumb a:hover{color:var(--ink)}
.breadcrumb .dim{color:var(--fg-3);margin:0 6px}
.article-cat{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;display:inline-flex;align-items:center;gap:10px;padding:6px 0;margin-bottom:28px;color:var(--ink)}
.article-title{font-family:var(--sans);font-weight:900;font-size:clamp(40px,5.4vw,80px);line-height:1.0;letter-spacing:-.04em;margin-bottom:28px;color:var(--ink)}
.article-meta{display:flex;gap:24px;flex-wrap:wrap;font-family:var(--label);font-size:11px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:48px;padding-bottom:24px;border-bottom:1px solid var(--ink)}
.article-summary{font-family:var(--sans);font-weight:600;font-size:clamp(20px,2.2vw,26px);line-height:1.5;letter-spacing:-.018em;color:var(--ink);padding:24px 0 32px;border-left:3px solid var(--vermillion);padding-left:28px;margin-bottom:40px}
.article-body{font-family:var(--sans);font-size:17px;line-height:1.95;color:var(--ink);font-weight:400}
.article-body h2,.article-body h3{font-family:var(--sans);font-weight:900;color:var(--ink);margin:40px 0 16px;letter-spacing:-.025em}
.article-body h2{font-size:30px}.article-body h3{font-size:22px}
.article-body p{margin-bottom:20px}
.article-body blockquote{border-left:3px solid var(--ink);padding:16px 24px;background:var(--paper-2);margin:28px 0;font-weight:500;color:var(--fg-2)}
.article-body a{color:var(--vermillion);border-bottom:1px solid currentColor}
.tag-block{margin-top:64px;padding-top:32px;border-top:1px solid var(--line)}
.tag-block .h{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:14px}
.tag-block .chips{display:flex;flex-wrap:wrap;gap:8px}
.tag-chip{display:inline-flex;align-items:center;padding:7px 14px;border:1px solid var(--line-2);font-family:var(--sans);font-size:13px;font-weight:500;color:var(--ink);text-decoration:none;transition:background var(--d-fast) var(--ease),border-color var(--d-fast) var(--ease)}
.tag-chip:hover{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.tag-chip::before{content:'#';color:var(--fg-3);margin-right:4px;font-weight:400}
.tag-chip:hover::before{color:var(--paper)}
.topic-block{margin-top:24px;padding-top:24px;border-top:1px solid var(--line)}
.topic-block .h{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:14px}
.topic-block .chips{display:flex;flex-wrap:wrap;gap:8px}
.topic-chip{display:inline-flex;align-items:center;padding:7px 14px;border:1px solid var(--line-2);font-family:var(--sans);font-size:13px;font-weight:600;color:var(--ink);text-decoration:none;transition:background var(--d-fast) var(--ease),border-color var(--d-fast) var(--ease)}
.topic-chip:hover{background:var(--vermillion);color:var(--paper);border-color:var(--vermillion)}
.cta-block{margin-top:64px;padding-top:40px;border-top:1px solid var(--line)}
.cta-block p{font-family:var(--sans);font-size:13px;color:var(--fg-3);line-height:1.8;margin-bottom:16px}
.cta-btn{display:inline-block;padding:14px 32px;background:var(--ink);color:var(--paper);font-family:var(--label);font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase}
.cta-btn:hover{background:#000}
aside.sidebar{position:sticky;top:100px;height:fit-content;display:flex;flex-direction:column;gap:32px}
.side-block{padding:24px 0;border-top:1px solid var(--ink)}
.side-h{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:18px}
.brand-chip{display:inline-block;font-family:var(--label);font-size:10px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--ink);padding:6px 10px;border:1px solid var(--line-2);margin-bottom:14px}
.side-item{font-family:var(--sans);font-size:13px;line-height:1.7;margin-bottom:8px;color:var(--ink)}
.side-item strong{font-weight:700}
.side-consult{display:block;margin-top:18px;padding:12px;background:var(--ink);color:var(--paper);text-align:center;font-family:var(--label);font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase}
.recent-row{display:grid;grid-template-columns:32px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);font-family:var(--sans);text-decoration:none}
.recent-row .rn{font-family:var(--label);font-size:10px;color:var(--fg-3);letter-spacing:.18em}
.recent-row .rc{font-family:var(--label);font-size:10px;color:var(--fg-3);letter-spacing:.22em;text-transform:uppercase;margin-bottom:4px}
.recent-row .rt{font-size:13px;line-height:1.5;color:var(--ink)}
@media(max-width:900px){.container{grid-template-columns:1fr;padding:40px 20px 80px;gap:48px}aside.sidebar{position:static}}
</style>
</head>
<body>
${navHtml()}

<div class="container">
  <main>
    <nav class="breadcrumb" aria-label="이동 경로"><a href="../index.html">HOME</a><span class="dim">/</span><a href="../journal.html">JOURNAL</a><span class="dim">/</span><span>${escHtml((p.title || '').substring(0, 40))}${p.title && p.title.length > 40 ? '…' : ''}</span></nav>
    <article>
      <div class="article-cat"><span>${escHtml(label)}</span></div>
      <h1 class="article-title">${escHtml(p.title)}</h1>
      <div class="article-meta">
        <time datetime="${escHtml(datePublished)}">${escHtml(p.date || '')}</time>
        <span>작성: 조국환 변호사팀 | AUCTORITAS LAB</span>
      </div>
      ${p.summary ? `<div class="article-summary">${escHtml(p.summary)}</div>` : ''}
      <div class="article-body">${p.content || ''}</div>
      ${tags.length ? `<div class="tag-block">
        <div class="h">Tags</div>
        <div class="chips">${tags.map(t => `<a class="tag-chip" href="${tagHref(t, true)}" rel="tag">${escHtml(t)}</a>`).join('')}</div>
      </div>` : ''}
      ${relatedTopics.length ? `<div class="topic-block">
        <div class="h">Related Topics</div>
        <div class="chips">${relatedTopics.map(topic => `<a class="topic-chip" href="${topicHref(topic, 'subdir')}">${escHtml(topic.name)}</a>`).join('')}</div>
      </div>` : ''}
      <div class="cta-block">
        <p>조국환 변호사팀의 활동 전반은 본 사이트에서 확인하실 수 있습니다.</p>
        <a href="https://www.fightingspirit.kr" target="_blank" rel="noopener" class="cta-btn">발행팀 홈페이지 →</a>
      </div>
    </article>
  </main>

  <aside class="sidebar">
    <div class="side-block">
      <span class="brand-chip">AUCTORITAS LAB</span>
      <div class="side-h">Contact</div>
      <div class="side-item"><strong>031-546-3997</strong></div>
      <div class="side-item">031-546-3998 (FAX)</div>
      <div class="side-item"><a href="mailto:info@fightingspirit.kr">info@fightingspirit.kr</a></div>
      <div class="side-item" style="font-size:12px;color:var(--fg-2);margin-top:10px;line-height:1.6">경기도 수원시 영통구 광교중앙로 248번길 7-2 원희캐슬법조타운 B동 401호</div>
      <a href="https://www.fightingspirit.kr" target="_blank" rel="noopener" class="side-consult">발행팀 홈페이지 →</a>
    </div>
    <div class="side-block">
      <div class="side-h">Recent Articles</div>
      <div>${recentSidebar(allPosts, p.id)}</div>
    </div>
  </aside>
</div>

${footerHtml()}
</body>
</html>`;
}

function legacyArticleRedirectHtml(p) {
  const canonical = articleUrl(p);
  const next = articleHref(p, 'same-dir');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(p.title)} | AUCTORITAS LAB</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${canonical}">
<meta http-equiv="refresh" content="0; url=${next}">
<script>location.replace(${JSON.stringify(next)});</script>
</head>
<body>
<p>이 글의 정규 URL로 이동합니다. <a href="${next}">계속하기</a></p>
</body>
</html>`;
}

function tagPageHtml(tag, postsForTag, allTags) {
  const pageUrl = tagUrl(tag);
  const desc = `'${tag}' 태그가 붙은 글 ${postsForTag.length}건 — 공간분쟁 전문 조국환 변호사팀의 판례·실무 저널.`;

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `#${tag} — AUCTORITAS LAB 법률 저널`,
    "description": desc,
    "url": pageUrl,
    "inLanguage": "ko",
    "isPartOf": { "@type": "Blog", "name": "AUCTORITAS LAB 법률 저널", "url": SITE },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": postsForTag.length,
      "itemListElement": postsForTag.map((p, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": articleUrl(p),
        "name": p.title
      }))
    }
  };

  const rows = postsForTag.map(p => {
    const lbl = SERIES_LABEL[p.series] || p.series || '';
    const dateStr = p.date || (p.publish_at || '').slice(0, 10);
    const sum = p.summary || stripTags(p.content).substring(0, 110);
    return `<a class="t-row" href="${articleHref(p, 'subdir')}">
      <div class="t-cat">${escHtml(lbl)}</div>
      <div class="t-main">
        <div class="t-title">${escHtml(p.title)}</div>
        ${sum ? `<div class="t-sum">${escHtml(sum)}</div>` : ''}
      </div>
      <div class="t-date">${escHtml(dateStr)}</div>
    </a>`;
  }).join('');

  const cloud = allTags.slice(0, 30).map(([t, postsForT]) => {
    const n = postsForT.length;
    return t === tag
      ? `<span class="cl-chip cl-active">#${escHtml(t)} <em>${n}</em></span>`
      : `<a class="cl-chip" href="./${encodeURIComponent(tagSlug(t))}.html">#${escHtml(t)} <em>${n}</em></a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>#${escHtml(tag)} — AUCTORITAS LAB 법률 저널</title>
<meta name="description" content="${escHtml(desc)}">
<meta name="keywords" content="${escHtml(tag)},공간분쟁,조국환변호사,AUCTORITAS">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AUCTORITAS LAB">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="#${escHtml(tag)} — AUCTORITAS LAB 법률 저널">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${SITE}/og/default.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="#${escHtml(tag)} — AUCTORITAS LAB 법률 저널">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${SITE}/og/default.png">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
${discoveryLinksHtml()}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link rel="stylesheet" href="../assets/common.css">
<style>
.tagwrap{max-width:1200px;margin:0 auto;padding:60px 40px 120px}
.breadcrumb{font-family:var(--label);font-size:10px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:40px}
.breadcrumb a:hover{color:var(--ink)}
.breadcrumb .dim{color:var(--fg-3);margin:0 6px}
.tag-head{padding-bottom:40px;border-bottom:1px solid var(--ink);margin-bottom:8px}
.tag-eyebrow{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:18px}
.tag-h1{font-family:var(--sans);font-weight:900;font-size:clamp(40px,5vw,72px);line-height:1.0;letter-spacing:-.04em;color:var(--ink)}
.tag-h1 .hash{color:var(--vermillion);margin-right:6px}
.tag-h1 .count{font-size:.4em;font-weight:500;color:var(--fg-3);margin-left:12px;letter-spacing:.06em}
.tag-desc{margin-top:18px;font-family:var(--sans);font-size:15px;line-height:1.85;color:var(--fg-2);max-width:60ch}

.t-list{margin-top:0}
.t-row{display:grid;grid-template-columns:120px 1fr 110px;align-items:center;gap:28px;padding:24px 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink);transition:padding var(--d-base) var(--ease),background var(--d-fast) var(--ease)}
.t-row:hover{padding-left:16px;padding-right:16px;background:var(--paper-2)}
.t-cat{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3)}
.t-row:hover .t-cat{color:var(--vermillion)}
.t-title{font-family:var(--sans);font-weight:600;font-size:19px;line-height:1.4;letter-spacing:-.012em;color:var(--ink)}
.t-sum{margin-top:6px;font-family:var(--sans);font-size:13px;line-height:1.6;color:var(--fg-3)}
.t-date{font-family:var(--label);font-size:11px;color:var(--fg-3);letter-spacing:.18em;text-align:right}

.cloud{margin-top:80px;padding-top:32px;border-top:1px solid var(--line)}
.cloud .h{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:16px}
.cloud .chips{display:flex;flex-wrap:wrap;gap:8px}
.cl-chip{display:inline-flex;align-items:baseline;gap:6px;padding:7px 14px;border:1px solid var(--line-2);font-family:var(--sans);font-size:13px;font-weight:500;color:var(--ink);text-decoration:none;transition:background var(--d-fast) var(--ease),border-color var(--d-fast) var(--ease)}
.cl-chip em{font-style:normal;font-size:11px;color:var(--fg-3);font-weight:400}
.cl-chip:hover{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.cl-chip:hover em{color:var(--fg-on-ink-2)}
.cl-active{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.cl-active em{color:var(--fg-on-ink-2)}

@media(max-width:700px){
  .tagwrap{padding:40px 20px 80px}
  .t-row{grid-template-columns:1fr;gap:6px;padding:18px 0}
  .t-cat,.t-date{font-size:10px}
  .t-row:hover{padding-left:0;padding-right:0}
}
</style>
</head>
<body>
${navHtml()}

<div class="tagwrap">
  <nav class="breadcrumb" aria-label="이동 경로">
    <a href="../index.html">HOME</a><span class="dim">/</span>
    <a href="../journal.html">JOURNAL</a><span class="dim">/</span>
    <span>#${escHtml(tag)}</span>
  </nav>

  <header class="tag-head">
    <div class="tag-eyebrow">Tag Archive</div>
    <h1 class="tag-h1"><span class="hash">#</span>${escHtml(tag)}<span class="count">${postsForTag.length}건</span></h1>
    <p class="tag-desc">${escHtml(desc)}</p>
  </header>

  <div class="t-list">${rows}</div>

  <section class="cloud">
    <div class="h">전체 태그</div>
    <div class="chips">${cloud}</div>
  </section>
</div>

${footerHtml()}
</body>
</html>`;
}

function topicPageHtml(topic, postsForTopic, allPosts) {
  const pageUrl = topicUrl(topic);
  const listedPosts = postsForTopic;
  const desc = topic.description;
  const queryTargets = topicQueryTargets(topic);
  const keywords = uniqueList([topic.name, ...queryTargets, ...topic.keywords, '공간분쟁', '조국환변호사', 'AUCTORITAS']);

  const collectionJsonld = {
    "@type": "CollectionPage",
    "name": topic.title,
    "description": desc,
    "url": pageUrl,
    "inLanguage": "ko",
    "isPartOf": { "@type": "Blog", "name": "AUCTORITAS LAB 법률 저널", "url": SITE },
    "about": keywords.map(name => ({ "@type": "Thing", "name": name })),
    "keywords": queryTargets.join(', '),
    "mentions": queryTargets.map(name => ({ "@type": "Thing", "name": name })),
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": listedPosts.length,
      "itemListElement": listedPosts.map((p, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": articleUrl(p),
        "name": p.title
      }))
    }
  };
  const faqJsonld = {
    "@type": "FAQPage",
    "mainEntity": (topic.faq || []).map(([question, answer]) => ({
      "@type": "Question",
      "name": question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": answer
      }
    }))
  };
  const breadcrumbJsonld = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "AUCTORITAS LAB", "item": `${SITE}/` },
      { "@type": "ListItem", "position": 2, "name": "주요 주제", "item": `${SITE}/topic/` },
      { "@type": "ListItem", "position": 3, "name": topic.name, "item": pageUrl }
    ]
  };
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [collectionJsonld, faqJsonld, breadcrumbJsonld]
  };

  const rows = listedPosts.length ? listedPosts.map(p => {
    const lbl = SERIES_LABEL[p.series] || p.series || '';
    const dateStr = p.date || (p.publish_at || '').slice(0, 10);
    const sum = p.summary || stripTags(p.content).substring(0, 120);
    return `<a class="topic-row" href="${articleHref(p, 'subdir')}">
      <div class="topic-cat">${escHtml(lbl)}</div>
      <div class="topic-main">
        <div class="topic-title">${escHtml(p.title)}</div>
        ${sum ? `<div class="topic-sum">${escHtml(sum)}</div>` : ''}
      </div>
      <div class="topic-date">${escHtml(dateStr)}</div>
    </a>`;
  }).join('') : `<div class="empty-topic">이 주제에 직접 연결된 공개 글은 아직 준비 중입니다. 아래 체크포인트를 기준으로 관련 글이 발행되면 이 페이지에 자동으로 묶입니다.</div>`;

  const topicLinks = TOPIC_PAGES.map(x => x.slug === topic.slug
    ? `<span class="topic-chip active">${escHtml(x.name)}</span>`
    : `<a class="topic-chip" href="./${encodeURIComponent(x.slug)}.html">${escHtml(x.name)}</a>`
  ).join('');
  const faqRows = (topic.faq || []).map(([question, answer]) => `
    <details class="faq-item">
      <summary>${escHtml(question)}</summary>
      <p>${escHtml(answer)}</p>
    </details>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(topic.title)} | AUCTORITAS LAB 법률 저널</title>
<meta name="description" content="${escHtml(desc)}">
<meta name="keywords" content="${escHtml(keywords.join(','))}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AUCTORITAS LAB">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${escHtml(topic.title)} | AUCTORITAS LAB">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${SITE}/og/default.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(topic.title)} | AUCTORITAS LAB">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${SITE}/og/default.png">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
${discoveryLinksHtml()}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link rel="stylesheet" href="../assets/common.css">
<style>
.topicwrap{max-width:1200px;margin:0 auto;padding:60px 40px 120px}
.breadcrumb{font-family:var(--label);font-size:10px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:40px}
.breadcrumb a:hover{color:var(--ink)}
.breadcrumb .dim{color:var(--fg-3);margin:0 6px}
.topic-head{padding-bottom:40px;border-bottom:1px solid var(--ink)}
.topic-eyebrow{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:18px}
.topic-h1{font-family:var(--sans);font-weight:900;font-size:clamp(40px,5vw,76px);line-height:1.02;letter-spacing:-.04em;color:var(--ink)}
.topic-desc{margin-top:20px;font-family:var(--sans);font-size:16px;line-height:1.85;color:var(--fg-2);max-width:68ch}
.query-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:26px}
.query-pill{border:1px solid var(--line-2);padding:7px 12px;font-family:var(--sans);font-size:12px;color:var(--fg-2)}
.checkpoint{display:grid;grid-template-columns:220px 1fr;gap:40px;padding:32px 0;border-bottom:1px solid var(--line)}
.checkpoint .h{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3)}
.checkpoint ul{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 24px;margin:0;padding:0;list-style:none}
.checkpoint li{font-family:var(--sans);font-size:14px;line-height:1.65;color:var(--ink);padding-left:16px;position:relative}
.checkpoint li::before{content:'';position:absolute;left:0;top:.75em;width:5px;height:5px;background:var(--vermillion)}
.faq{padding:48px 0;border-bottom:1px solid var(--line)}
.faq .h{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:18px}
.faq-item{border-top:1px solid var(--line);font-family:var(--sans)}
.faq-item:last-child{border-bottom:1px solid var(--line)}
.faq-item summary{cursor:pointer;padding:18px 0;font-size:16px;font-weight:800;line-height:1.45;color:var(--ink);letter-spacing:-.012em}
.faq-item p{margin:0 0 20px;font-size:14px;line-height:1.8;color:var(--fg-2);max-width:74ch}
.topic-list{border-top:1px solid var(--line);margin-top:8px}
.empty-topic{padding:28px 0;border-bottom:1px solid var(--line);font-family:var(--sans);font-size:14px;line-height:1.8;color:var(--fg-2)}
.topic-row{display:grid;grid-template-columns:120px 1fr 110px;align-items:center;gap:28px;padding:24px 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink);transition:padding var(--d-base) var(--ease),background var(--d-fast) var(--ease)}
.topic-row:hover{padding-left:16px;padding-right:16px;background:var(--paper-2)}
.topic-cat{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3)}
.topic-title{font-family:var(--sans);font-weight:700;font-size:19px;line-height:1.4;letter-spacing:-.012em;color:var(--ink)}
.topic-sum{margin-top:7px;font-family:var(--sans);font-size:13px;line-height:1.7;color:var(--fg-3)}
.topic-date{font-family:var(--label);font-size:11px;color:var(--fg-3);letter-spacing:.18em;text-align:right}
.topic-nav{margin-top:80px;padding-top:32px;border-top:1px solid var(--line)}
.topic-nav .h{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:16px}
.topic-nav .chips{display:flex;flex-wrap:wrap;gap:8px}
.topic-chip{display:inline-flex;align-items:center;padding:7px 14px;border:1px solid var(--line-2);font-family:var(--sans);font-size:13px;font-weight:600;color:var(--ink);text-decoration:none;transition:background var(--d-fast) var(--ease),border-color var(--d-fast) var(--ease)}
.topic-chip:hover,.topic-chip.active{background:var(--ink);color:var(--paper);border-color:var(--ink)}
@media(max-width:700px){
  .topicwrap{padding:40px 20px 80px}
  .checkpoint{grid-template-columns:1fr;gap:16px}
  .checkpoint ul{grid-template-columns:1fr}
  .topic-row{grid-template-columns:1fr;gap:6px;padding:18px 0}
  .topic-date{text-align:left}
  .topic-row:hover{padding-left:0;padding-right:0}
}
</style>
</head>
<body>
${navHtml()}

<div class="topicwrap">
  <nav class="breadcrumb" aria-label="이동 경로">
    <a href="../index.html">HOME</a><span class="dim">/</span>
    <a href="../journal.html">JOURNAL</a><span class="dim">/</span>
    <span>${escHtml(topic.name)}</span>
  </nav>

  <header class="topic-head">
    <div class="topic-eyebrow">Topic Archive</div>
    <h1 class="topic-h1">${escHtml(topic.title)}</h1>
    <p class="topic-desc">${escHtml(desc)}</p>
    <div class="query-list" aria-label="대상 검색 질의">${queryTargets.slice(0, 9).map(k => `<span class="query-pill">${escHtml(k)}</span>`).join('')}</div>
  </header>

  <section class="checkpoint" aria-label="실무 체크포인트">
    <div class="h">Checkpoints</div>
    <ul>${(topic.checkpoints || []).map(x => `<li>${escHtml(x)}</li>`).join('')}</ul>
  </section>

  <section class="faq" aria-label="자주 묻는 질문">
    <div class="h">Questions</div>
    ${faqRows}
  </section>

  <div class="topic-list">${rows}</div>

  <section class="topic-nav">
    <div class="h">주요 주제</div>
    <div class="chips">${topicLinks}</div>
  </section>
</div>

${footerHtml()}
</body>
</html>`;
}

function legacyTopicRedirectHtml(topic) {
  const canonical = topicUrl(topic);
  const next = `./${encodeURIComponent(topic.slug)}.html`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(topic.title)} | AUCTORITAS LAB</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${canonical}">
<meta http-equiv="refresh" content="0; url=${next}">
<script>location.replace(${JSON.stringify(next)});</script>
</head>
<body>
<p>이 주제의 정규 URL로 이동합니다. <a href="${next}">계속하기</a></p>
</body>
</html>`;
}

function topicIndexHtml(topicIndex) {
  const pageUrl = `${SITE}/topic/`;
  const desc = '공간분쟁 전문 조국환 변호사팀 저널의 주요 검색 주제 모음. 인테리어 하자, 공사대금 청구소송, 건설 하자, 임대차 원상회복, 부동산 가압류, 명도소송을 한곳에서 탐색합니다.';
  const keywords = TOPIC_PAGES.flatMap(topic => [topic.name, ...topicQueryTargets(topic), ...topic.keywords]);
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "AUCTORITAS LAB 주요 공간분쟁 주제",
    "description": desc,
    "url": pageUrl,
    "inLanguage": "ko",
    "isPartOf": { "@type": "Blog", "name": "AUCTORITAS LAB 법률 저널", "url": SITE },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": topicIndex.length,
      "itemListElement": topicIndex.map(([topic], i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": topicUrl(topic),
        "name": topic.name
      }))
    }
  };

  const cards = topicIndex.map(([topic, postsForTopic]) => `
    <a class="topic-card" href="./${encodeURIComponent(topic.slug)}.html">
      <div class="topic-name">${escHtml(topic.name)}</div>
      <div class="topic-title">${escHtml(topic.title)}</div>
      <p>${escHtml(topic.description)}</p>
      <div class="topic-count">${postsForTopic.length ? `${postsForTopic.length}개 관련 글` : '관련 글 준비 중'}</div>
      <div class="topic-keys">${topicQueryTargets(topic).slice(0, 5).map(k => `<span>${escHtml(k)}</span>`).join('')}</div>
    </a>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>공간분쟁 주요 주제 | AUCTORITAS LAB 법률 저널</title>
<meta name="description" content="${escHtml(desc)}">
<meta name="keywords" content="${escHtml(uniqueList(keywords).join(','))}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AUCTORITAS LAB">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="공간분쟁 주요 주제 | AUCTORITAS LAB">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${SITE}/og/default.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="공간분쟁 주요 주제 | AUCTORITAS LAB">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${SITE}/og/default.png">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
${discoveryLinksHtml()}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link rel="stylesheet" href="../assets/common.css">
<style>
.wrap{max-width:1280px;margin:0 auto;padding:60px 40px 120px}
.breadcrumb{font-family:var(--label);font-size:10px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:40px}
.breadcrumb a:hover{color:var(--ink)}.breadcrumb .dim{color:var(--fg-3);margin:0 6px}
.head{padding-bottom:42px;border-bottom:1px solid var(--ink);margin-bottom:1px}
.eyebrow{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-3);margin-bottom:18px}
h1{font-family:var(--sans);font-weight:900;font-size:clamp(42px,5.8vw,84px);line-height:1.02;letter-spacing:-.04em;color:var(--ink)}
.desc{margin-top:22px;font-family:var(--sans);font-size:16px;line-height:1.85;color:var(--fg-2);max-width:72ch}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border-bottom:1px solid var(--line)}
.topic-card{display:flex;flex-direction:column;gap:12px;background:var(--paper);padding:28px;color:var(--ink);text-decoration:none;min-height:260px;transition:background var(--d-fast) var(--ease)}
.topic-card:hover{background:#fff}
.topic-name{font-family:var(--sans);font-weight:900;font-size:24px;line-height:1.18;letter-spacing:-.02em}
.topic-title{font-family:var(--sans);font-size:13px;font-weight:700;color:var(--vermillion)}
.topic-card p{font-family:var(--sans);font-size:13px;line-height:1.65;color:var(--fg-2);margin:0}
.topic-count{margin-top:auto;font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--fg-3)}
.topic-keys{display:flex;flex-wrap:wrap;gap:6px}
.topic-keys span{border:1px solid var(--line-2);padding:5px 8px;font-family:var(--sans);font-size:11px;color:var(--fg-2)}
@media(max-width:900px){.wrap{padding:40px 20px 80px}.grid{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
${navHtml()}
<div class="wrap">
  <nav class="breadcrumb" aria-label="이동 경로"><a href="../index.html">HOME</a><span class="dim">/</span><a href="../journal.html">JOURNAL</a><span class="dim">/</span><span>TOPICS</span></nav>
  <header class="head">
    <div class="eyebrow">Topic Index</div>
    <h1>공간분쟁 주요 주제</h1>
    <p class="desc">${escHtml(desc)}</p>
  </header>
  <div class="grid">${cards}</div>
</div>
${footerHtml()}
</body>
</html>`;
}

function queryMapHtml(topicIndex) {
  const pageUrl = `${SITE}/query-map.html`;
  const desc = 'AUCTORITAS LAB 법률 저널의 주제 허브와 SERP 추적용 핵심 검색 질의를 연결한 공개 질의 지도입니다.';
  const allQueries = topicIndex.flatMap(([topic]) => topicQueryTargets(topic).map(query => ({ topic, query })));
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "AUCTORITAS LAB 검색 질의 지도",
    "description": desc,
    "url": pageUrl,
    "inLanguage": "ko",
    "isPartOf": { "@type": "Blog", "name": "AUCTORITAS LAB 법률 저널", "url": SITE },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": allQueries.length,
      "itemListElement": allQueries.map((item, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": item.query,
        "url": topicUrl(item.topic)
      }))
    }
  };

  const sections = topicIndex.map(([topic, postsForTopic]) => {
    const queries = topicQueryTargets(topic).map(query => `
      <a class="query" href="${topicHref(topic)}">
        <span>${escHtml(query)}</span>
        <em>${escHtml(topic.name)}</em>
      </a>
    `).join('');
    return `<section class="topic-block">
      <div class="topic-meta">
        <a class="topic-name" href="${topicHref(topic)}">${escHtml(topic.name)}</a>
        <p>${escHtml(topic.description)}</p>
        <div class="topic-count">${postsForTopic.length} related articles</div>
      </div>
      <div class="query-grid">${queries}</div>
    </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>검색 질의 지도 | AUCTORITAS LAB 법률 저널</title>
<meta name="description" content="${escHtml(desc)}">
<meta name="keywords" content="${escHtml(uniqueList(allQueries.map(x => x.query)).join(','))}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AUCTORITAS LAB">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="검색 질의 지도 | AUCTORITAS LAB">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${SITE}/og/default.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="검색 질의 지도 | AUCTORITAS LAB">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${SITE}/og/default.png">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
${discoveryLinksHtml()}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link rel="stylesheet" href="assets/common.css">
<style>
.wrap{max-width:1240px;margin:0 auto;padding:60px 40px 120px}
.head{padding-bottom:42px;border-bottom:1px solid var(--ink)}
.eyebrow{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:0;text-transform:uppercase;color:var(--fg-3);margin-bottom:18px}
h1{font-family:var(--sans);font-weight:900;font-size:clamp(40px,5.5vw,80px);line-height:1.03;letter-spacing:0;color:var(--ink)}
.desc{margin-top:20px;font-family:var(--sans);font-size:16px;line-height:1.85;color:var(--fg-2);max-width:74ch}
.topic-block{display:grid;grid-template-columns:320px 1fr;gap:40px;padding:36px 0;border-bottom:1px solid var(--line)}
.topic-name{display:inline-block;font-family:var(--sans);font-size:24px;font-weight:900;line-height:1.2;color:var(--ink);text-decoration:none}
.topic-name:hover{color:var(--vermillion)}
.topic-meta p{margin:14px 0 0;font-family:var(--sans);font-size:14px;line-height:1.75;color:var(--fg-2)}
.topic-count{margin-top:14px;font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:0;text-transform:uppercase;color:var(--fg-3)}
.query-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.query{display:flex;justify-content:space-between;gap:16px;align-items:center;border:1px solid var(--line-2);padding:12px 14px;color:var(--ink);text-decoration:none;font-family:var(--sans);font-size:14px;font-weight:700;line-height:1.35;transition:background var(--d-fast) var(--ease),border-color var(--d-fast) var(--ease)}
.query em{font-style:normal;font-size:11px;font-weight:600;color:var(--fg-3);white-space:nowrap}
.query:hover{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.query:hover em{color:var(--fg-on-ink-2)}
@media(max-width:840px){
  .wrap{padding:40px 20px 80px}
  .topic-block{grid-template-columns:1fr;gap:20px}
  .query-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div id="navSlot"></div>
<div class="wrap">
  <header class="head">
    <div class="eyebrow">Search Query Map</div>
    <h1>검색 질의 지도</h1>
    <p class="desc">${escHtml(desc)}</p>
  </header>
  ${sections}
</div>
<div id="footerSlot"></div>
<script src="assets/common.js"></script>
<script>renderNav('journal');renderFooter();</script>
</body>
</html>`;
}

function journalArchiveHtml(posts, tagIndex, topicIndex) {
  const pageUrl = `${SITE}/journal/`;
  const desc = 'AUCTORITAS LAB 법률 저널의 전체 글을 검색엔진과 AI 에이전트가 JavaScript 없이도 따라갈 수 있도록 모은 정적 아카이브입니다.';
  const keywords = uniqueList([
    'AUCTORITAS LAB',
    '조국환 변호사',
    '법률 저널',
    '공간분쟁',
    ...TOPIC_PAGES.flatMap(topic => [topic.name, ...topicQueryTargets(topic), ...topic.keywords]),
    ...tagIndex.map(([tag]) => tag)
  ]);
  const collectionJsonld = {
    "@type": "CollectionPage",
    "name": "AUCTORITAS LAB 전체 글 아카이브",
    "description": desc,
    "url": pageUrl,
    "inLanguage": "ko",
    "isPartOf": { "@type": "Blog", "name": "AUCTORITAS LAB 법률 저널", "url": SITE },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": posts.length,
      "itemListElement": posts.map((p, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": articleUrl(p),
        "name": p.title
      }))
    }
  };
  const breadcrumbJsonld = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "AUCTORITAS LAB", "item": `${SITE}/` },
      { "@type": "ListItem", "position": 2, "name": "전체 글 아카이브", "item": pageUrl }
    ]
  };
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [collectionJsonld, breadcrumbJsonld]
  };

  const rows = posts.length ? posts.map((p, i) => {
    const lbl = SERIES_LABEL[p.series] || p.series || '';
    const dateStr = p.date || (p.publish_at || '').slice(0, 10);
    const sum = p.summary || stripTags(p.content).substring(0, 140);
    const tags = normalizeTags(p.tags).slice(0, 5);
    const topics = matchingTopicsForPost(p).slice(0, 3);
    const tagLinks = tags.map(tag => `<a class="mini" href="${tagHref(tag, true)}">#${escHtml(tag)}</a>`).join('');
    const topicLinks = topics.map(topic => `<a class="mini topic" href="${topicHref(topic, 'subdir')}">${escHtml(topic.name)}</a>`).join('');
    return `<article class="archive-row">
      <a class="archive-main" href="${articleHref(p, 'same-dir')}">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <span class="body">
          <span class="meta">${escHtml(lbl)}${dateStr ? ` / ${escHtml(dateStr)}` : ''}</span>
          <span class="title">${escHtml(p.title)}</span>
          ${sum ? `<span class="sum">${escHtml(sum)}</span>` : ''}
        </span>
      </a>
      ${(tagLinks || topicLinks) ? `<div class="mini-row">${topicLinks}${tagLinks}</div>` : ''}
    </article>`;
  }).join('') : `<div class="empty-archive">아직 공개된 글이 없습니다.</div>`;

  const topicChips = topicIndex
    .map(([topic, postsForTopic]) => `<a class="chip topic" href="${topicHref(topic, 'subdir')}">${escHtml(topic.name)} <em>${postsForTopic.length}</em></a>`)
    .join('');
  const tagChips = tagIndex
    .slice(0, 30)
    .map(([tag, postsForTag]) => `<a class="chip" href="${tagHref(tag, true)}">#${escHtml(tag)} <em>${postsForTag.length}</em></a>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>전체 글 아카이브 | AUCTORITAS LAB 법률 저널</title>
<meta name="description" content="${escHtml(desc)}">
<meta name="keywords" content="${escHtml(keywords.join(','))}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AUCTORITAS LAB">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="전체 글 아카이브 | AUCTORITAS LAB">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${SITE}/og/default.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="전체 글 아카이브 | AUCTORITAS LAB">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${SITE}/og/default.png">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
${discoveryLinksHtml()}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link rel="stylesheet" href="../assets/common.css">
<style>
.wrap{max-width:1240px;margin:0 auto;padding:60px 40px 120px}
.breadcrumb{font-family:var(--label);font-size:10px;font-weight:500;letter-spacing:0;text-transform:uppercase;color:var(--fg-3);margin-bottom:40px}
.breadcrumb a:hover{color:var(--ink)}.breadcrumb .dim{color:var(--fg-3);margin:0 6px}
.head{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:48px;align-items:end;padding-bottom:42px;border-bottom:1px solid var(--ink)}
.eyebrow{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:0;text-transform:uppercase;color:var(--fg-3);margin-bottom:18px}
h1{font-family:var(--sans);font-weight:900;font-size:clamp(40px,5.5vw,80px);line-height:1.03;letter-spacing:0;color:var(--ink)}
.desc{margin-top:20px;font-family:var(--sans);font-size:16px;line-height:1.85;color:var(--fg-2);max-width:72ch}
.count{font-family:var(--label);font-size:12px;letter-spacing:0;text-transform:uppercase;color:var(--fg-3);text-align:right}
.count strong{display:block;font-family:var(--sans);font-size:54px;line-height:1;color:var(--vermillion);letter-spacing:0;margin-bottom:8px}
.archive-list{border-bottom:1px solid var(--line)}
.archive-row{border-top:1px solid var(--line)}
.archive-main{display:grid;grid-template-columns:70px minmax(0,1fr);gap:28px;padding:26px 0;color:var(--ink);text-decoration:none;transition:background var(--d-fast) var(--ease),padding var(--d-base) var(--ease)}
.archive-main:hover{background:var(--paper-2);padding-left:16px;padding-right:16px}
.num{font-family:var(--label);font-size:12px;letter-spacing:0;color:var(--fg-3);padding-top:5px}
.body{display:flex;flex-direction:column;gap:8px;min-width:0}
.meta{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:0;text-transform:uppercase;color:var(--fg-3)}
.title{font-family:var(--sans);font-weight:760;font-size:22px;line-height:1.38;letter-spacing:0;color:var(--ink)}
.sum{font-family:var(--sans);font-size:14px;line-height:1.7;color:var(--fg-2);max-width:80ch}
.mini-row{display:flex;flex-wrap:wrap;gap:7px;padding:0 0 22px 98px}
.mini,.chip{display:inline-flex;align-items:baseline;gap:6px;border:1px solid var(--line-2);padding:6px 10px;font-family:var(--sans);font-size:12px;font-weight:600;color:var(--ink);text-decoration:none;transition:background var(--d-fast) var(--ease),border-color var(--d-fast) var(--ease),color var(--d-fast) var(--ease)}
.mini.topic,.chip.topic{border-color:rgba(216,58,44,.36);color:var(--vermillion)}
.mini:hover,.chip:hover{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.chip em{font-style:normal;font-size:11px;font-weight:500;color:var(--fg-3)}
.chip:hover em{color:var(--fg-on-ink-2)}
.link-cloud{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:64px;padding-top:32px;border-top:1px solid var(--line)}
.cloud-title{font-family:var(--label);font-size:10px;font-weight:600;letter-spacing:0;text-transform:uppercase;color:var(--fg-3);margin-bottom:14px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.empty-archive{padding:60px 0;font-family:var(--sans);font-size:15px;color:var(--fg-3)}
@media(max-width:760px){
  .wrap{padding:40px 20px 80px}
  .head{grid-template-columns:1fr;gap:24px}
  .count{text-align:left}
  .archive-main{grid-template-columns:1fr;gap:8px;padding:22px 0}
  .archive-main:hover{padding-left:0;padding-right:0}
  .mini-row{padding-left:0}
  .link-cloud{grid-template-columns:1fr}
}
</style>
</head>
<body>
${navHtml()}
<div class="wrap">
  <nav class="breadcrumb" aria-label="이동 경로"><a href="../index.html">HOME</a><span class="dim">/</span><a href="../journal.html">JOURNAL</a><span class="dim">/</span><span>ARCHIVE</span></nav>
  <header class="head">
    <div>
      <div class="eyebrow">Static Journal Archive</div>
      <h1>전체 글 아카이브</h1>
      <p class="desc">${escHtml(desc)}</p>
    </div>
    <div class="count"><strong>${posts.length}</strong>published articles</div>
  </header>
  <section class="archive-list" aria-label="전체 글 목록">${rows}</section>
  <section class="link-cloud" aria-label="주제와 태그">
    <div>
      <div class="cloud-title">Topic Hubs</div>
      <div class="chips">${topicChips}</div>
    </div>
    <div>
      <div class="cloud-title">Tags</div>
      <div class="chips">${tagChips}</div>
    </div>
  </section>
</div>
${footerHtml()}
</body>
</html>`;
}

function searchIndexJson(posts, tagIndex, topicIndex) {
  const generatedAt = new Date().toISOString();
  return JSON.stringify({
    site: SITE,
    name: 'AUCTORITAS LAB 법률 저널',
    description: '공간분쟁 전문 조국환 변호사팀의 판례·실무 저널 검색 인덱스',
    generatedAt,
    topics: topicIndex.map(([topic, postsForTopic]) => ({
      name: topic.name,
      title: topic.title,
      url: topicUrl(topic),
      description: topic.description,
      queryTargets: topicQueryTargets(topic),
      keywords: uniqueList([topic.name, ...topicQueryTargets(topic), ...topic.keywords]),
      faq: (topic.faq || []).map(([question, answer]) => ({ question, answer })),
      articleCount: postsForTopic.length,
      articles: postsForTopic.map(p => ({ title: p.title, url: articleUrl(p) }))
    })),
    tags: tagIndex.map(([tag, postsForTag]) => ({
      name: tag,
      url: tagUrl(tag),
      articleCount: postsForTag.length
    })),
    articles: posts.map(p => ({
      id: p.id,
      title: p.title,
      url: articleUrl(p),
      summary: p.summary || stripTags(p.content).substring(0, 180),
      date: p.date || (p.publish_at || '').slice(0, 10),
      tags: normalizeTags(p.tags),
      topics: matchingTopicsForPost(p).map(topic => topic.name)
    }))
  }, null, 2) + '\n';
}

function feedXml(posts) {
  const items = posts.slice(0, 30).map(p => {
    const pageUrl = articleUrl(p);
    const dateSrc = p.publish_at || (p.date ? p.date.replace(/\./g, '-') + 'T00:00:00+09:00' : Date.now());
    const pubDate = new Date(dateSrc).toUTCString();
    const desc = p.summary || stripTags(p.content).substring(0, 240);
    return `    <item>
      <title>${escXml(p.title)}</title>
      <link>${pageUrl}</link>
      <guid isPermaLink="true">${pageUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escXml(SERIES_LABEL[p.series] || p.series || '')}</category>
      <description>${escXml(desc)}</description>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AUCTORITAS LAB 법률 저널</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>공간분쟁 전문 조국환 변호사팀이 발행하는 판례·실무 저널</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

function llmsFullTxt(posts) {
  const head = `# AUCTORITAS LAB — 전체 본문 합본 (llms-full.txt)

> 공간분쟁 전문 조국환 변호사팀이 발행하는 판례·실무 저널의 published 글 전체.
> 자동 생성: ${new Date().toISOString()}
> 글 수: ${posts.length}
>
> 본 파일은 AI 어시스턴트가 인용 시 사용하도록 제공됩니다.
> 인용 시 출처(URL + AUCTORITAS LAB)를 반드시 표기해 주십시오.

---

`;
  const body = posts.map(p => {
    const label = SERIES_LABEL[p.series] || p.series || '';
    const url = articleUrl(p);
    const tags = normalizeTags(p.tags);
    return `## [${label}] ${p.title}

- URL: ${url}
- 발행일: ${p.date || (p.publish_at || '').slice(0, 10)}
${tags.length ? `- 태그: ${tags.join(', ')}\n` : ''}${p.summary ? `\n${p.summary}\n` : ''}
${stripTags(p.content)}

---
`;
  }).join('\n');

  return head + body;
}

// ─── OG 이미지 생성 ────────────────────────────────────────────────────────────

// Pretendard 폰트 다운로드 (Bold 700). Satori는 폰트 데이터를 ArrayBuffer로 직접 받는다.
// OFL 라이선스, GitHub release에서 직접 받아 메모리에 캐시.
async function loadPretendard() {
  const url = 'https://github.com/orioncactus/pretendard/raw/main/packages/pretendard/dist/public/static/Pretendard-Bold.otf';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Pretendard font fetch failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Satori 노드를 객체 트리로 표현 (JSX 없이).
function el(type, style, children) {
  return { type, props: { style: { display: 'flex', ...style }, children } };
}

function ogVdomArticle(title, label, date) {
  const safeTitle = title.length > 90 ? title.substring(0, 88) + '…' : title;
  const fontSize = safeTitle.length > 36 ? 64 : 80;

  return el('div', {
    width: '100%', height: '100%',
    flexDirection: 'column', justifyContent: 'space-between',
    padding: '72px 80px',
    backgroundColor: '#0d0d0d', color: '#f7f5f0',
    fontFamily: 'Pretendard'
  }, [
    // top: brand chip
    el('div', { alignItems: 'center', gap: '14px' }, [
      el('div', { width: '14px', height: '14px', backgroundColor: '#d83a2c' }, []),
      el('div', { fontSize: '22px', fontWeight: 700, letterSpacing: '4px' }, 'AUCTORITAS LAB')
    ]),
    // middle: title
    el('div', {
      fontSize: `${fontSize}px`, fontWeight: 900,
      lineHeight: 1.08, letterSpacing: '-2px',
      width: '1040px'
    }, safeTitle),
    // bottom row
    el('div', { justifyContent: 'space-between', alignItems: 'flex-end' }, [
      el('div', { color: '#d83a2c', fontSize: '22px', fontWeight: 700, letterSpacing: '4px' },
        label + (date ? '  ·  ' + date : '')),
      el('div', { color: '#999', fontSize: '20px', fontWeight: 500, letterSpacing: '2px' },
        'journal.fightingspirit.kr')
    ])
  ]);
}

function ogVdomDefault() {
  return el('div', {
    width: '100%', height: '100%',
    flexDirection: 'column', justifyContent: 'space-between',
    padding: '72px 80px',
    backgroundColor: '#0d0d0d', color: '#f7f5f0',
    fontFamily: 'Pretendard'
  }, [
    el('div', { alignItems: 'center', gap: '14px' }, [
      el('div', { width: '14px', height: '14px', backgroundColor: '#d83a2c' }, []),
      el('div', { fontSize: '22px', fontWeight: 700, letterSpacing: '4px' }, 'AUCTORITAS LAB')
    ]),
    el('div', { flexDirection: 'column', gap: '20px' }, [
      el('div', { fontSize: '92px', fontWeight: 900, lineHeight: 1.0, letterSpacing: '-3px' }, '공간분쟁'),
      el('div', { fontSize: '64px', fontWeight: 700, lineHeight: 1.0, letterSpacing: '-2px', color: '#d83a2c' }, '판례·실무 저널')
    ]),
    el('div', { justifyContent: 'space-between', alignItems: 'flex-end' }, [
      el('div', { color: '#bbb', fontSize: '22px', fontWeight: 500, letterSpacing: '2px' },
        '조국환 변호사팀 · 대한민국 전역'),
      el('div', { color: '#999', fontSize: '20px', fontWeight: 500, letterSpacing: '2px' },
        'journal.fightingspirit.kr')
    ])
  ]);
}

async function renderPng(vdom, fontData) {
  const svg = await satori(vdom, {
    width: 1200, height: 630,
    fonts: [{ name: 'Pretendard', data: fontData, weight: 700, style: 'normal' }]
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

function sitemapXml(posts, tagIndex, topicIndex) {
  const staticUrls = [
    { loc: `${SITE}/`,             changefreq: 'weekly',  priority: '1.0' },
    { loc: `${SITE}/journal.html`, changefreq: 'weekly',  priority: '0.9' },
    { loc: `${SITE}/journal/`,     changefreq: 'weekly',  priority: '0.9' },
    { loc: `${SITE}/query-map.html`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${SITE}/topic/`,       changefreq: 'weekly',  priority: '0.9' },
    { loc: `${SITE}/authority.html`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${SITE}/about.html`,   changefreq: 'monthly', priority: '0.7' }
  ];
  const postUrls = posts.map(p => ({
    loc: articleUrl(p),
    lastmod: (p.updated_at || p.publish_at || '').slice(0, 10),
    changefreq: 'monthly',
    priority: '0.8'
  }));
  const topicUrls = topicIndex.map(([topic, postsForTopic]) => ({
    loc: topicUrl(topic),
    lastmod: postsForTopic
      .map(p => (p.updated_at || p.publish_at || '').slice(0, 10))
      .filter(Boolean)
      .sort()
      .pop() || '',
    changefreq: 'weekly',
    priority: '0.85'
  }));
  const tagUrls = tagIndex.map(([tag, postsForTag]) => ({
    loc: tagUrl(tag),
    lastmod: postsForTag
      .map(p => (p.updated_at || p.publish_at || '').slice(0, 10))
      .filter(Boolean)
      .sort()
      .pop() || '',
    changefreq: 'weekly',
    priority: '0.6'
  }));
  const items = [...staticUrls, ...topicUrls, ...postUrls, ...tagUrls].map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

async function main() {
  console.log('Fetching published posts from Supabase…');
  const posts = await fetchPosts();
  const visiblePosts = posts.filter(p => isVisiblePost(p));
  console.log(`Got ${posts.length} published posts (${visiblePosts.length} visible now).`);

  const journalDir = join(ROOT, 'journal');
  await mkdir(journalDir, { recursive: true });

  for (const p of posts) {
    await writeFile(join(journalDir, `${articleSlug(p)}.html`), articleHtml(p, visiblePosts), 'utf8');
    await writeFile(join(journalDir, `${p.id}.html`), legacyArticleRedirectHtml(p), 'utf8');
  }
  console.log(`Wrote ${posts.length} canonical article pages and ${posts.length} legacy redirects → journal/`);

  // ── 태그 인덱스 페이지 ───────────────────────────────────────────────
  // 태그별로 글 모음. 빈 태그·중복 정규화.
  const tagMap = new Map();
  for (const p of visiblePosts) {
    for (const t of normalizeTags(p.tags)) {
      if (!tagMap.has(t)) tagMap.set(t, []);
      tagMap.get(t).push(p);
    }
  }
  // 글 개수 내림차순, 동률은 가나다.
  const tagIndex = [...tagMap.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ko')
  );

  const tagDir = join(ROOT, 'tag');
  await mkdir(tagDir, { recursive: true });
  for (const [tag, postsForTag] of tagIndex) {
    const fileName = `${tagSlug(tag)}.html`;
    await writeFile(join(tagDir, fileName), tagPageHtml(tag, postsForTag, tagIndex), 'utf8');
  }
  console.log(`Wrote ${tagIndex.length} tag index pages → tag/`);

  // ── 검색 주제 허브 페이지 ────────────────────────────────────────────
  const topicIndex = TOPIC_PAGES.map(topic => [topic, topicPosts(topic, visiblePosts)]);
  const topicDir = join(ROOT, 'topic');
  await mkdir(topicDir, { recursive: true });
  for (const [topic, postsForTopic] of topicIndex) {
    await writeFile(join(topicDir, `${topic.slug}.html`), topicPageHtml(topic, postsForTopic, visiblePosts), 'utf8');
    if (topic.legacySlug) {
      await writeFile(join(topicDir, `${topic.legacySlug}.html`), legacyTopicRedirectHtml(topic), 'utf8');
    }
  }
  await writeFile(join(topicDir, 'index.html'), topicIndexHtml(topicIndex), 'utf8');
  console.log(`Wrote ${topicIndex.length} topic hub pages → topic/`);

  await writeFile(join(journalDir, 'index.html'), journalArchiveHtml(visiblePosts, tagIndex, topicIndex), 'utf8');
  console.log('Wrote static journal archive -> journal/index.html');

  await writeFile(join(ROOT, 'query-map.html'), queryMapHtml(topicIndex), 'utf8');
  console.log('Wrote query-map.html');

  await writeFile(join(ROOT, 'feed.xml'), feedXml(visiblePosts), 'utf8');
  console.log('Wrote feed.xml');

  await writeFile(join(ROOT, 'llms-full.txt'), llmsFullTxt(visiblePosts), 'utf8');
  console.log('Wrote llms-full.txt');

  await writeFile(join(ROOT, 'sitemap.xml'), sitemapXml(visiblePosts, tagIndex, topicIndex), 'utf8');
  console.log('Wrote sitemap.xml');

  await writeFile(join(ROOT, 'search-index.json'), searchIndexJson(visiblePosts, tagIndex, topicIndex), 'utf8');
  console.log('Wrote search-index.json');

  // ── OG 이미지 ────────────────────────────────────────────────────────
  console.log('Loading Pretendard font for OG images…');
  const fontData = await loadPretendard();

  const ogDir = join(ROOT, 'og');
  await mkdir(ogDir, { recursive: true });

  const defaultPng = await renderPng(ogVdomDefault(), fontData);
  await writeFile(join(ogDir, 'default.png'), defaultPng);
  console.log('Wrote og/default.png');

  for (const p of posts) {
    const label = SERIES_LABEL[p.series] || p.series || '';
    const png = await renderPng(ogVdomArticle(p.title || '', label, p.date || ''), fontData);
    await writeFile(join(ogDir, `${p.id}.png`), png);
  }
  console.log(`Wrote ${posts.length} OG images → og/`);
}

main().catch(e => { console.error(e); process.exit(1); });
