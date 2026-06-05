#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SB_URL = process.env.SUPABASE_URL || 'https://cbdyclovsybrxhpgpjbo.supabase.co';
const AUTHOR_LINE = '작성: 조국환 변호사팀 | AUCTORITAS LAB';
const SERIES = new Set(['PRECEDENT', 'CIVIL', 'ADMIN', 'FAMILY']);
const SLOTS = ['05:10', '07:10', '09:10'];

function parseArgs(argv) {
  const opts = {
    publish: false,
    out: 'work/prepared-posts.json',
    status: 'published',
    defaultSeries: 'CIVIL',
    minTags: 8,
    baseDate: null,
    format: 'html',
    strictSeo: false,
    fillVisibleGaps: false,
    publishToday: false,
    todayIntervalMinutes: null,
    todayStartTime: null
  };
  const files = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--publish') opts.publish = true;
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--base-date') opts.baseDate = argv[++i];
    else if (arg === '--status') opts.status = argv[++i];
    else if (arg === '--default-series') opts.defaultSeries = argv[++i];
    else if (arg === '--min-tags') opts.minTags = Number(argv[++i]);
    else if (arg === '--format') opts.format = argv[++i];
    else if (arg === '--strict-seo') opts.strictSeo = true;
    else if (arg === '--fill-visible-gaps') opts.fillVisibleGaps = true;
    else if (arg === '--publish-today') opts.publishToday = true;
    else if (arg === '--today-interval') {
      const next = argv[i + 1];
      opts.todayIntervalMinutes = next && !next.startsWith('--') ? Number(argv[++i]) : 10;
    }
    else if (arg === '--today-start') opts.todayStartTime = argv[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else files.push(arg);
  }
  opts.input = files[0];
  return opts;
}

function validateArgs(opts) {
  if (!['html', 'text'].includes(opts.format)) throw new Error(`Invalid --format: ${opts.format}`);
  if (opts.todayIntervalMinutes !== null && (!Number.isFinite(opts.todayIntervalMinutes) || opts.todayIntervalMinutes <= 0)) {
    throw new Error(`Invalid --today-interval: ${opts.todayIntervalMinutes}`);
  }
  if (opts.todayStartTime && !/^\d{1,2}:\d{2}$/.test(opts.todayStartTime)) {
    throw new Error(`Invalid --today-start: ${opts.todayStartTime}`);
  }
}

function usage() {
  return `Usage:
  npm run journal:uploader -- drafts.md --base-date 2026-06-03
  SUPABASE_SERVICE_ROLE_KEY=... npm run journal:uploader:publish -- drafts.md --base-date auto

Compatibility:
  npm run posts:prepare -- drafts.md --base-date 2026-06-03
  SUPABASE_SERVICE_ROLE_KEY=... npm run posts:publish -- drafts.md --base-date auto

Options:
  --base-date YYYY-MM-DD | auto   마지막 예약/발행일. 다음 날부터 3개씩 배정.
  --out path                      준비 결과 JSON 경로. 기본 work/prepared-posts.json
  --default-series CIVIL          분류가 없을 때 기본 series.
  --min-tags 8                    최소 태그 수.
  --status published              직접 예약은 published + future publish_at 권장.
  --format html|text              기본 html. 검색 구조용 h2/h3/p를 생성.
  --strict-seo                    검색 구조 경고도 실패로 처리.
  --fill-visible-gaps             공개 저널 기준 날짜별 빈 슬롯을 먼저 채움.
  --publish-today                 모든 글을 오늘 날짜의 즉시 공개 글로 준비.
  --today-interval 10             오늘 남은 시간 기준 N분 간격으로 예약.
  --today-start HH:MM             --today-interval의 첫 예약 시각을 직접 지정.
`;
}

function normalizeDate(value) {
  if (!value) return null;
  const v = String(value).trim().replace(/\./g, '-');
  const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) throw new Error(`Invalid date: ${value}`);
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateInput(d);
}

function formatDateInput(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function displayDate(date) {
  return date.replaceAll('-', '.');
}

function publishAtIso(date, time) {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

function cleanTags(raw) {
  return [...new Set(String(raw || '')
    .split(/[,，\n]/)
    .map(x => x.trim().replace(/^#+/, '').trim())
    .filter(Boolean))];
}

function cleanSearchTargets(raw) {
  return [...new Set(String(raw || '')
    .split(/[,，\n]/)
    .map(x => x.trim())
    .filter(Boolean))];
}

function inferSeries(draft, fallback) {
  const text = `${draft.title || ''} ${draft.tags?.join(' ') || ''} ${draft.body || ''}`;
  if (/행정|처분|인허가|심판/.test(text)) return 'ADMIN';
  if (/상속|가사|이혼|유류분|재산분할/.test(text)) return 'FAMILY';
  if (/판례|대법원|하급심|결정|판결/.test(text)) return 'PRECEDENT';
  return fallback;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function inlineHtml(value) {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function normalizeSourceText(raw) {
  let text = String(raw || '').replace(/\r\n/g, '\n').trim();
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/?(h2|h3|p|strong|b)[^>]*>/gi, '\n');
  text = text.replace(/<\/?[^>]+>/g, '');
  text = text.replace(/^[ \t]*Q\d+\.?[ \t]*/gim, '');
  text = text.replace(/^[ \t]*Q\.?[ \t]*/gim, '');
  text = text.replace(/^(#{2,3}\s+[^\n]+)\n(?!\n)/gm, '$1\n\n');
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  text = text.replaceAll(AUTHOR_LINE, '').trim();
  return text;
}

function looksLikeHeading(block) {
  const line = block.trim();
  if (!line || line.includes('\n')) return false;
  if (/[.?!。]$/.test(line)) return false;
  return line.length <= 42;
}

function markdownTableText(block) {
  const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 2 || !lines.every(line => line.startsWith('|') && line.endsWith('|'))) return null;
  const rows = lines
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()).filter(Boolean))
    .filter(cells => cells.length);
  const contentRows = rows.filter(cells => !cells.every(cell => /^:?-{3,}:?$/.test(cell)));
  if (contentRows.length < 2) return null;
  const [headers, ...bodyRows] = contentRows;
  const body = bodyRows.map(cells => {
    const [label, ...rest] = cells;
    return rest.length ? `${label}: ${rest.join(' / ')}` : label;
  });
  return [`**${headers.join(' / ')}**`, ...body].join('\n');
}

function normalizeBodyText(raw) {
  let text = normalizeSourceText(raw).replace(/^#{2,3}\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1');
  if (!text.includes(AUTHOR_LINE)) text = `${text}\n\n${AUTHOR_LINE}`;
  return text;
}

function normalizeBodyHtml(raw) {
  const source = normalizeSourceText(raw);
  const blocks = source.split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
  const html = [];
  let inFaq = false;

  for (const block of blocks) {
    const normalized = block.replace(/^#{2,3}\s+/, '').trim();
    if (!normalized) continue;
    const tableText = markdownTableText(block);
    if (tableText) {
      html.push(`<p>${inlineHtml(tableText).replace(/\n/g, '<br>')}</p>`);
      continue;
    }
    if (/^자주\s*묻는\s*질문$/.test(normalized)) {
      html.push('<h2>자주 묻는 질문</h2>');
      inFaq = true;
      continue;
    }
    if (/^##\s+/.test(block)) {
      html.push(`<h2>${inlineHtml(normalized)}</h2>`);
      continue;
    }
    if (/^###\s+/.test(block) || (inFaq && /\?$/.test(normalized))) {
      html.push(`<h3>${inlineHtml(normalized)}</h3>`);
      continue;
    }
    if (!inFaq && looksLikeHeading(normalized)) {
      html.push(`<h2>${inlineHtml(normalized)}</h2>`);
      continue;
    }
    html.push(`<p>${inlineHtml(normalized).replace(/\n/g, '<br>')}</p>`);
  }

  html.push(`<p>${AUTHOR_LINE}</p>`);
  return html.join('\n');
}

function normalizeBody(raw, format) {
  return format === 'text' ? normalizeBodyText(raw) : normalizeBodyHtml(raw);
}

function stripText(raw) {
  return String(raw || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function includesSearchTarget(haystack, target) {
  if (!target) return true;
  if (haystack.includes(target)) return true;
  const words = target.split(/\s+/).map(x => x.trim()).filter(x => x.length >= 2);
  if (words.length <= 1) return false;
  return words.every(word => haystack.includes(word));
}

function summaryFor(draft, content) {
  if (draft.summary) return draft.summary;
  const body = stripText(content).replace(AUTHOR_LINE, '').trim();
  return body.length > 150 ? `${body.slice(0, 147)}...` : body;
}

function parseDrafts(text) {
  const blocks = text.split(/^##\s*초안\s*#?\d+/gim).slice(1);
  if (!blocks.length) throw new Error('초안 블록을 찾지 못했습니다. "## 초안 #1" 형식을 사용해 주세요.');

  return blocks.map((block, index) => {
    const readField = name => {
      const re = new RegExp(`^${name}\\s*:\\s*([\\s\\S]*?)(?=^(?:제목|요약|분류|검색\\s*질의|태그|이미지\\s*키워드|본문)\\s*:|(?![\\s\\S]))`, 'im');
      const match = block.match(re);
      return match ? match[1].trim() : '';
    };
    const bodyMatch = block.match(/^본문\s*:\s*([\s\S]*)$/im);
    return {
      index: index + 1,
      title: readField('제목'),
      summary: readField('요약'),
      series: readField('분류').toUpperCase(),
      tags: cleanTags(readField('태그')),
      searchTargets: cleanSearchTargets(readField('검색\\s*질의')),
      imageKeyword: readField('이미지\\s*키워드'),
      body: bodyMatch ? bodyMatch[1].trim() : ''
    };
  });
}

function seoWarnings(draft, row, opts) {
  const warnings = [];
  const text = stripText(row.content);
  const primary = draft.searchTargets[0] || row.title;
  const earlyText = `${row.title} ${text.slice(0, 320)}`;
  const h2Count = (row.content.match(/<h2>/g) || []).length;
  const h3Count = (row.content.match(/<h3>/g) || []).length;
  if (opts.format === 'html' && h2Count < 3) warnings.push(`h2 섹션 ${h2Count}개, 권장 3개 이상`);
  if (opts.format === 'html' && !/자주 묻는 질문/.test(row.content)) warnings.push('FAQ 섹션 없음');
  if (opts.format === 'html' && /자주 묻는 질문/.test(row.content) && h3Count < 2) warnings.push(`FAQ 질문 ${h3Count}개, 권장 2개 이상`);
  if (primary && !includesSearchTarget(earlyText, primary)) warnings.push(`주 검색질의가 제목 또는 초반부에 없음: ${primary}`);
  if (row.summary.length < 60 || row.summary.length > 170) warnings.push(`요약 길이 ${row.summary.length}자, 권장 60~170자`);
  if (row.title.length < 18 || row.title.length > 85) warnings.push(`제목 길이 ${row.title.length}자, 권장 18~85자`);
  return warnings;
}

function scheduleRows(drafts, opts, baseDate, assignments = null) {
  return drafts.map((draft, i) => {
    const fallback = {
      date: addDays(baseDate, Math.floor(i / SLOTS.length) + 1),
      slot: SLOTS[i % SLOTS.length]
    };
    const plan = assignments?.[i] || fallback;
    const { date, slot } = plan;
    const series = draft.series || inferSeries(draft, opts.defaultSeries);
    const content = normalizeBody(draft.body, opts.format);
    const row = {
      title: draft.title,
      summary: summaryFor(draft, content),
      content,
      series,
      tags: draft.tags,
      status: opts.status,
      date: displayDate(date),
      publish_at: slot ? publishAtIso(date, slot) : null
    };
    const errors = [];
    if (!row.title) errors.push('제목 없음');
    if (!row.content || row.content === AUTHOR_LINE) errors.push('본문 없음');
    if (!SERIES.has(row.series)) errors.push(`분류 오류: ${row.series}`);
    if (row.tags.length < opts.minTags) errors.push(`태그 ${row.tags.length}개, 최소 ${opts.minTags}개 필요`);
    const warnings = seoWarnings(draft, row, opts);
    if (opts.strictSeo) errors.push(...warnings);
    return {
      draft: draft.index,
      schedule: slot ? `${date} ${slot}` : `${date} now`,
      row,
      searchTargets: draft.searchTargets,
      warnings,
      errors
    };
  });
}

async function latestBaseDateFromSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('--base-date auto에는 SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_ANON_KEY가 필요합니다.');
  const url = `${SB_URL}/rest/v1/posts?select=publish_at,date&status=eq.published&order=publish_at.desc.nullslast,date.desc&limit=1`;
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) throw new Error(`Supabase base-date fetch failed: ${response.status} ${await response.text()}`);
  const rows = await response.json();
  const first = rows[0];
  if (!first) return formatDateInput(new Date());
  if (first.publish_at) return formatDateInput(new Date(first.publish_at));
  return normalizeDate(first.date);
}

function visiblePostDate(post) {
  if (post.publish_at) {
    const ts = Date.parse(post.publish_at);
    if (Number.isFinite(ts) && ts > Date.now()) return null;
  }
  if (post.date) return normalizeDate(post.date);
  if (post.publish_at) return formatDateInput(new Date(post.publish_at));
  return null;
}

async function visibleDateCountsFromSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('--fill-visible-gaps에는 SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_ANON_KEY가 필요합니다.');
  const url = `${SB_URL}/rest/v1/posts?select=date,publish_at&status=eq.published&limit=1000`;
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) throw new Error(`Supabase visible-date fetch failed: ${response.status} ${await response.text()}`);
  const counts = new Map();
  for (const post of await response.json()) {
    const date = visiblePostDate(post);
    if (!date) continue;
    counts.set(date, (counts.get(date) || 0) + 1);
  }
  return counts;
}

function fillVisibleGapAssignments(count, counts, startDate) {
  const assignments = [];
  let date = startDate;
  while (assignments.length < count) {
    let used = counts.get(date) || 0;
    for (let slotIndex = used; slotIndex < SLOTS.length && assignments.length < count; slotIndex += 1) {
      assignments.push({ date, slot: SLOTS[slotIndex] });
      used += 1;
      counts.set(date, used);
    }
    date = addDays(date, 1);
  }
  return assignments;
}

function timeInputFromKstDate(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('hour')}:${get('minute')}`;
}

function roundUpDate(date, intervalMinutes) {
  const ms = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function todayIntervalAssignments(count, intervalMinutes, startTime = null) {
  const date = formatDateInput(new Date());
  const intervalMs = intervalMinutes * 60 * 1000;
  const first = startTime
    ? new Date(`${date}T${startTime}:00+09:00`)
    : roundUpDate(new Date(Date.now() + intervalMs), intervalMinutes);
  if (!Number.isFinite(first.getTime())) throw new Error(`Invalid --today-start: ${startTime}`);
  const now = Date.now();
  if (first.getTime() <= now) throw new Error('--today-start는 현재 시각 이후여야 합니다.');

  const assignments = [];
  for (let i = 0; i < count; i += 1) {
    const slotDate = new Date(first.getTime() + i * intervalMs);
    const slotDay = formatDateInput(slotDate);
    if (slotDay !== date) {
      throw new Error(`오늘 안에 ${count}건을 ${intervalMinutes}분 간격으로 배치할 시간이 부족합니다.`);
    }
    assignments.push({ date, slot: timeInputFromKstDate(slotDate) });
  }
  return assignments;
}

async function publishRows(rows) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('게시하려면 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  const response = await fetch(`${SB_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(`Supabase insert failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.input) {
    console.log(usage());
    process.exit(opts.help ? 0 : 1);
  }
  validateArgs(opts);
  if (!SERIES.has(opts.defaultSeries)) throw new Error(`Invalid --default-series: ${opts.defaultSeries}`);
  const input = await readFile(resolve(opts.input), 'utf8');
  const drafts = parseDrafts(input);
  let assignments = null;
  let baseDate = null;
  if (opts.todayIntervalMinutes !== null) {
    baseDate = formatDateInput(new Date());
    assignments = todayIntervalAssignments(drafts.length, opts.todayIntervalMinutes, opts.todayStartTime);
  } else if (opts.publishToday) {
    baseDate = formatDateInput(new Date());
    assignments = drafts.map(() => ({ date: baseDate, slot: null }));
  } else if (opts.fillVisibleGaps) {
    baseDate = opts.baseDate ? normalizeDate(opts.baseDate) : formatDateInput(new Date());
    assignments = fillVisibleGapAssignments(drafts.length, await visibleDateCountsFromSupabase(), baseDate);
  } else {
    baseDate = opts.baseDate === 'auto'
      ? await latestBaseDateFromSupabase()
      : normalizeDate(opts.baseDate);
  }
  if (!baseDate) throw new Error('--base-date YYYY-MM-DD 또는 --base-date auto가 필요합니다.');

  const prepared = scheduleRows(drafts, opts, baseDate, assignments);
  const failed = prepared.filter(x => x.errors.length);
  const result = {
    generatedAt: new Date().toISOString(),
    baseDate,
    format: opts.format,
    nextSchedule: prepared.map(x => ({ draft: x.draft, title: x.row.title, schedule: x.schedule, publish_at: x.row.publish_at, searchTargets: x.searchTargets })),
    rows: prepared.map(x => x.row),
    report: prepared.map(x => ({ draft: x.draft, title: x.row.title, schedule: x.schedule, tagCount: x.row.tags.length, series: x.row.series, searchTargets: x.searchTargets, warnings: x.warnings, errors: x.errors }))
  };

  await mkdir(dirname(resolve(opts.out)), { recursive: true });
  await writeFile(resolve(opts.out), JSON.stringify(result, null, 2) + '\n', 'utf8');

  if (failed.length) {
    console.error(`검증 실패: ${failed.length}건. ${opts.out}의 report를 확인하세요.`);
    process.exit(1);
  }

  if (opts.publish) {
    const inserted = await publishRows(result.rows);
    console.log(`게시 예약 payload insert 완료: ${inserted.length}건`);
    console.log(inserted.map(x => `[${x.id}] ${x.title}`).join('\n'));
  } else {
    console.log(`준비 완료: ${result.rows.length}건 -> ${opts.out}`);
    console.log(result.report.map(x => `[초안 ${x.draft}] ${x.schedule} / ${x.series} / 태그 ${x.tagCount}개 / 경고 ${x.warnings.length}개 / ${x.title}`).join('\n'));
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
