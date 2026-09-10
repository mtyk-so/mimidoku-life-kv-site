import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Normally installed through npm. The override permits an offline local build.
const { marked } = await import(process.env.MIMIDOKU_MARKED_MODULE
  ? pathToFileURL(process.env.MIMIDOKU_MARKED_MODULE).href : 'marked');
const site = JSON.parse(await fs.readFile(path.join(root, 'content/site.json'), 'utf8'));
const preview = !process.argv.includes('--release');
// Reuse the existing approved text material and its matching impression URL.
const configContext = {window:{}};
vm.runInNewContext(await fs.readFile(path.join(root, 'public/js/config.js'), 'utf8'), configContext, {timeout:1000});
const affiliate = configContext.window.SiteConfig.A8.text;
for (const address of [affiliate.link, affiliate.impression]) {
  const parsed = new URL(address);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.a8.net')) throw new Error('Invalid A8 material URL');
}
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url = slug => `/articles/${slug}`;
const guideUrl = url('audible-beginners-guide');
const siteUrl = 'https://mimidoku-life.com';
const abs = value => /^https?:\/\//.test(value) ? value : `${siteUrl}${value}`;
const affiliatePanel = `<section class="affiliate-panel" aria-label="Audibleのご案内"><span class="eyebrow">PR · AUDIBLE</span><h2>まずはプレミアムプランの無料体験で、聴いてみる。</h2><p>聴き放題の対象作品から、気になる1冊を。<br>自分に合う聴き方を試してみませんか。</p><a class="affiliate-button" href="${esc(affiliate.link)}" target="_blank" rel="sponsored nofollow noopener noreferrer">プレミアムプランの無料体験を試す <span aria-hidden="true">↗</span></a><small>無料体験は対象の方に適用されます。体験期間・終了後の料金は申込画面をご確認ください。体験終了後は自動更新されます。</small></section>`;
const affiliateInline = (copy, label, button = false) => `<aside class="affiliate-inline${button ? ' affiliate-inline-button' : ''}" aria-label="Audibleのご案内"><span class="eyebrow">PR · AUDIBLE</span><p>${copy}</p><a href="${esc(affiliate.link)}" target="_blank" rel="sponsored nofollow noopener noreferrer">${label} <span aria-hidden="true">↗</span></a><small>無料体験は対象の方に適用されます。体験期間・終了後の料金は申込画面をご確認ください。</small></aside>`;
const affiliateMarkers = {
  '{{affiliate:trial}}': affiliateInline('プレミアムプランの無料体験で、自分に合うか試してみませんか。', '無料体験の対象と料金を確認する'),
  '{{affiliate:signup}}': affiliateInline('登録方法を確認できたら、申込画面で条件を確かめて始められます。', 'プレミアムプランの無料体験を始める', true)
};
const affiliateDisclosure = '<p class="affiliate-disclosure">当サイトはアフィリエイト広告を利用しています。</p>';
// Local previews must not inflate advertising impressions.
const affiliatePixel = preview ? '' : `<img class="affiliate-impression" src="${esc(affiliate.impression)}" width="1" height="1" alt="">`;
const safeHref = value => /^(https?:\/\/|\/(?!\/)|#)/.test(value) ? value : '#';
const articles = [];
for (const item of site.articles) {
  if (!/^[a-z0-9-]+$/.test(item.slug)) throw new Error('Invalid article slug');
  if (!item.author) throw new Error(`Missing article author: ${item.slug}`);
  const markdown = (await fs.readFile(path.join(root, 'content/articles', `${item.slug}.md`), 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const title = markdown.match(/^# (.+)/)?.[1];
  if (!title || /編集メモ|\[\[|\*\*状態\*\*/.test(markdown)) throw new Error(`Use article body only: ${item.slug}`);
  let headingIndex = 0;
  const toc = [];
  const renderer = new marked.Renderer();
  renderer.html = ({text}) => esc(text);
  renderer.heading = function({tokens, depth}) {
    const html = this.parser.parseInline(tokens);
    if (depth !== 2) return `<h${depth}>${html}</h${depth}>`;
    const id = `section-${++headingIndex}`;
    toc.push(`<li><a href="#${id}">${html}</a></li>`);
    return `<h2 id="${id}">${html}</h2>`;
  };
  renderer.link = function({href, tokens}) {
    const related = site.articles.find(a => a.source === href);
    const target = related ? url(related.slug) : safeHref(href);
    return `<a href="${esc(target)}">${this.parser.parseInline(tokens)}</a>`;
  };
  let body = marked.parse(markdown.replace(/^# .+\n/, ''), {renderer, gfm:true})
    .replaceAll('<table>', '<div class="table-scroll" role="region" aria-label="比較表" tabindex="0"><table>')
    .replaceAll('</table>', '</table></div>');
  for (const [marker, block] of Object.entries(affiliateMarkers)) {
    body = body.replaceAll(`<p>${marker}</p>`, block);
  }
  if (body.includes('{{affiliate:')) throw new Error(`Unknown affiliate marker: ${item.slug}`);
  articles.push({...item, title, body, toc});
}
if (new Set(articles.map(a => a.slug)).size !== articles.length) throw new Error('Duplicate slugs');

const photo = (src, alt, note, extra = '') => src
  ? `<img class="photo ${extra}" src="${esc(safeHref(src))}" alt="${esc(alt)}" loading="${extra === 'hero-photo' ? 'eager' : 'lazy'}" width="1200" height="800">`
  : `<div class="photo photo-placeholder ${extra}" role="img" aria-label="写真準備中：${esc(note)}"><span class="photo-mark" aria-hidden="true">＋</span><span>写真準備中</span><small>${esc(note)}</small></div>`;
const brand = `<a class="brand" href="/">耳読ライフ<small>MIMIDOKU LIFE JOURNAL</small></a>`;
function shell(title, description, main, meta = {}) {
  const canonical = abs(meta.path || '/');
  const ogImage = abs(meta.image || site.heroImage || '/images/title.png');
  const social = `<link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="${meta.type || 'website'}"><meta property="og:site_name" content="耳読ライフ"><meta property="og:locale" content="ja_JP"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(ogImage)}"><meta name="twitter:card" content="summary_large_image">`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}">${social}${preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<meta name="theme-color" content="#f4f3ee"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500&family=Noto+Serif+JP:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/journal.css"></head><body><a class="skip-link" href="#main">本文へ移動</a>${preview ? '<div class="preview-note">リニューアル確認用</div>' : ''}<header class="site-header"><div class="header-inner">${brand}<nav aria-label="メインメニュー"><a href="/#journal">記事一覧</a><a href="${guideUrl}">はじめてのAudible</a><a href="/#about">耳読ライフについて</a></nav></div></header>${main}<footer class="site-footer"><div>${brand}<p>聴く読書のある、いつもの暮らし。</p></div><div class="footer-meta">${affiliateDisclosure}<small>© 2026 耳読ライフ</small></div></footer>${affiliatePixel}</body></html>`;
}
const card = a => `<a class="story-card" href="${url(a.slug)}">${photo(a.image, a.imageAlt, a.imageNote)}<div class="story-copy"><span class="category">${esc(a.category)}</span><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p><span class="story-meta"><span><time datetime="${a.date}">${a.date.replaceAll('-', '.')}</time><span class="story-author"> · ${esc(a.author)}</span></span><span aria-hidden="true">読む →</span></span></div></a>`;
const sceneItems = (site.scenes || []).map((scene, index) => {
  const article = articles.find(a => a.slug === scene.articleSlug);
  const content = `<span class="scene-number">${String(index + 1).padStart(2, '0')}</span><h3>${esc(scene.title)}</h3><p>${esc(scene.description)}</p><small class="scene-status">${article ? '記事を読む →' : '記事準備中'}</small>`;
  return article ? `<a class="scene-item" href="${url(article.slug)}">${content}</a>` : `<div class="scene-item">${content}</div>`;
}).join('');
const dailyScenes = sceneItems ? `<section class="daily-scenes" id="daily-scenes"><div class="section"><div class="section-heading"><h2>Daily scenes</h2><span>いつもの時間から探す</span></div><div class="scene-grid">${sceneItems}</div></div></section>` : '';
const about = `<span class="eyebrow">ABOUT THIS JOURNAL</span><h2>耳読ライフについて</h2><p>暮らしの中で、本を聴いてみる。<br>私が実際に聴いて感じたことや、<br>Audibleの始め方を綴る小さな読みものサイトです。</p>`;
const home = shell('耳読ライフ｜聴く読書のある暮らし', '家事の合間に、ひと息つく時間に。Audibleで本を聴いた体験と、初めて使う方へのガイドを綴る耳読ライフ。', `<main id="main"><section class="hero"><div class="hero-visual">${photo(site.heroImage, site.heroAlt, '本やイヤホンのある、いつもの暮らし', 'hero-photo')}</div><div class="hero-copy"><span class="eyebrow">A LITTLE READING, EVERY DAY.</span><h1>本を開けない日にも、<br>物語やことばを。</h1><p>聴く読書のある、いつもの暮らし。</p></div></section><div class="intro"><p>家事の合間に。ひと息つく時間に。<br class="mobile-break">本との付き合い方を、少しずつ。</p><a href="${guideUrl}">はじめての方へ <span aria-hidden="true">→</span></a></div><section class="section" id="journal"><div class="section-heading"><h2>Journal</h2><span>新着記事</span><span class="article-count">${articles.length} ARTICLES</span></div><div class="story-grid">${articles.map(card).join('')}</div></section>${dailyScenes}<section class="bottom-section"><div class="getting-started"><span class="eyebrow">GETTING STARTED</span><h2>聴く読書、<br>はじめの一歩。</h2><p>どんな作品があるのか。無料でも試せるのか。<br>気になることを、ひとつずつ。</p><a class="text-link" href="${guideUrl}">Audibleの初心者ガイドを読む <span aria-hidden="true">→</span></a></div><div class="about" id="about">${about}</div></section><div class="home-affiliate">${affiliatePanel}</div></main>`, {path: '/', image: site.heroImage, type: 'website'});
await fs.mkdir(path.join(root, 'public/articles'), {recursive:true});
await fs.writeFile(path.join(root, 'public/index.html'), home);
for (const a of articles) {
  const related = articles.filter(x => x.slug !== a.slug).slice(0, 3);
  const html = shell(`${a.title}｜耳読ライフ`, a.description, `<main id="main" class="article-main"><a class="back-link" href="/#journal">← 記事一覧へ戻る</a><div class="article-layout"><article class="article"><header class="article-header"><span class="category">${esc(a.category)}</span><h1>${esc(a.title)}</h1><p class="article-meta"><span><time datetime="${a.date}">${a.date.replaceAll('-', '.')}</time><span class="article-author"> · ${esc(a.author)}</span></span>${a.checkedDate ? `<span>情報確認日：${a.checkedDate.replaceAll('-', '.')}</span>` : ''}</p>${photo(a.image, a.imageAlt, a.imageNote)}</header><details class="toc"><summary>この記事の目次</summary><ol>${a.toc.join('')}</ol></details><div class="article-body">${a.body}</div>${affiliatePanel}<section class="next-reading"><span class="eyebrow">NEXT READING</span><h2>次に読む</h2>${related.map(x => `<a href="${url(x.slug)}">${esc(x.title)} <span aria-hidden="true">→</span></a>`).join('')}</section></article><aside class="sidebar"><section>${about}</section></aside></div></main>`, {path: url(a.slug), image: a.image, type: 'article'});
  await fs.writeFile(path.join(root, 'public/articles', `${a.slug}.html`), html);
}
// Keep preview builds out of search results; release builds point crawlers at the sitemap.
await fs.writeFile(path.join(root, 'public/robots.txt'), preview
  ? `User-agent: *
Disallow: /
`
  : `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`);
const pages = [{loc: abs('/'), lastmod: articles.map(a => a.date).sort().at(-1)},
  ...articles.map(a => ({loc: abs(url(a.slug)), lastmod: a.date}))];
await fs.writeFile(path.join(root, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`
  + pages.map(page => `  <url><loc>${page.loc}</loc><lastmod>${page.lastmod}</lastmod></url>`).join(`
`)
  + `
</urlset>
`);
console.log(`Built home + ${articles.length} articles (${preview ? 'local preview / noindex' : 'release'}).`);
