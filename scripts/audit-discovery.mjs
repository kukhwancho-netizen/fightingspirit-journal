#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = 'https://journal.fightingspirit.kr';

const requiredFiles = [
  'index.html',
  'journal.html',
  'journal/index.html',
  'topic/index.html',
  'sitemap.xml',
  'robots.txt',
  'feed.xml',
  'llms.txt',
  'llms-full.txt',
  'search-index.json',
  'opensearch.xml',
  '.well-known/agent.json'
];

const errors = [];

async function text(rel) {
  return readFile(join(ROOT, rel), 'utf8');
}

async function exists(rel) {
  try {
    await stat(join(ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

function requireText(file, body, needle, label = needle) {
  if (!body.includes(needle)) {
    errors.push(`${file}: missing ${label}`);
  }
}

function urlToGeneratedPath(url) {
  const parsed = new URL(url);
  const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  return pathname.endsWith('/') ? `${pathname}index.html` : pathname;
}

async function main() {
  for (const file of requiredFiles) {
    if (!(await exists(file))) errors.push(`missing required file: ${file}`);
  }

  const sitemap = await text('sitemap.xml');
  const robots = await text('robots.txt');
  const opensearch = await text('opensearch.xml');
  const llms = await text('llms.txt');
  const journalArchive = await text('journal/index.html');
  const indexHtml = await text('index.html');
  const journalHtml = await text('journal.html');
  const searchIndex = JSON.parse(await text('search-index.json'));
  const agent = JSON.parse(await text('.well-known/agent.json'));

  requireText('robots.txt', robots, `Sitemap: ${SITE}/sitemap.xml`, 'Sitemap directive');
  requireText('sitemap.xml', sitemap, `<loc>${SITE}/journal/</loc>`, 'static journal archive URL');
  requireText('sitemap.xml', sitemap, `<loc>${SITE}/topic/</loc>`, 'topic index URL');
  requireText('opensearch.xml', opensearch, `template="${SITE}/journal.html?q={searchTerms}"`, 'OpenSearch query template');
  requireText('llms.txt', llms, `${SITE}/journal/`, 'static archive link');
  requireText('index.html', indexHtml, 'href="journal/"', 'home static archive link');
  requireText('journal.html', journalHtml, 'href="journal/"', 'journal static archive link');
  requireText('journal/index.html', journalArchive, 'CollectionPage', 'CollectionPage JSON-LD');
  requireText('journal/index.html', journalArchive, 'ItemList', 'ItemList JSON-LD');
  requireText('.well-known/agent.json', JSON.stringify(agent), `${SITE}/journal/`, 'agent static archive URL');

  if (!Array.isArray(searchIndex.articles) || searchIndex.articles.length === 0) {
    errors.push('search-index.json: articles must be a non-empty array');
  }
  if (!Array.isArray(searchIndex.topics) || searchIndex.topics.length < 6) {
    errors.push('search-index.json: expected at least six topic hubs');
  }

  for (const article of searchIndex.articles || []) {
    if (!article.url || !article.url.startsWith(`${SITE}/journal/`)) {
      errors.push(`search-index.json: invalid article URL for ${article.title || article.id || 'unknown article'}`);
      continue;
    }
    requireText('sitemap.xml', sitemap, `<loc>${article.url}</loc>`, `sitemap article URL: ${article.url}`);
    const rel = urlToGeneratedPath(article.url);
    if (!(await exists(rel))) {
      errors.push(`missing generated article page: ${rel}`);
      continue;
    }
    const html = await text(rel);
    requireText(rel, html, `<link rel="canonical" href="${article.url}">`, 'canonical URL');
    if (!html.includes('"@type":"Article"') && !html.includes('"@type":"BlogPosting"')) {
      errors.push(`${rel}: missing Article/BlogPosting JSON-LD`);
    }
    requireText('journal/index.html', journalArchive, encodeURI(decodeURIComponent(new URL(article.url).pathname.split('/').pop())), `archive link for ${article.title}`);
  }

  for (const topic of searchIndex.topics || []) {
    if (!topic.url || !topic.url.startsWith(`${SITE}/topic/`)) {
      errors.push(`search-index.json: invalid topic URL for ${topic.name || 'unknown topic'}`);
      continue;
    }
    requireText('sitemap.xml', sitemap, `<loc>${topic.url}</loc>`, `sitemap topic URL: ${topic.url}`);
    const rel = urlToGeneratedPath(topic.url);
    if (!(await exists(rel))) {
      errors.push(`missing generated topic page: ${rel}`);
      continue;
    }
    const html = await text(rel);
    requireText(rel, html, `<link rel="canonical" href="${topic.url}">`, 'canonical URL');
    requireText(rel, html, 'FAQPage', 'FAQPage JSON-LD');
  }

  if (errors.length) {
    console.error('Discovery audit failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Discovery audit OK: ${searchIndex.articles.length} articles, ${searchIndex.topics.length} topic hubs.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
