#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, 'nikke-notion');
const assetsRoot = path.join(outputRoot, 'assets');
const cwebp = '/opt/homebrew/bin/cwebp';

const pages = [
    { slug: 'tier', id: '37b91420541980a1a89df2a914cd98ad', label: '티어표', eyebrow: 'TIER ARCHIVE', custom: true },
    { slug: 'skill', id: '38091420541980609838c6367eefc082', label: '스킬작', eyebrow: 'SKILL ARCHIVE' },
    { slug: 'wish', id: '381914205419802a84fec5025cb88e5e', label: '위시', eyebrow: 'WISHLIST ARCHIVE' },
    { slug: 'growth', id: '3889142054198042b4dad5aeb0cab396', label: '육성 추천 가이드', eyebrow: 'GROWTH ARCHIVE' },
    { slug: 'raid', id: '3a3914205419805580f8e531694cd8ec', label: '솔로레이드 뮤지엄', eyebrow: 'RAID MUSEUM' }
];

function findExportedPage(id) {
    const result = execFileSync('find', [
        path.join(process.env.HOME, 'Downloads'),
        '-type', 'f', '-name', `*${id}.html`, '-print', '-quit'
    ], { encoding: 'utf8' }).trim();

    if (!result) throw new Error(`Notion export page not found: ${id}`);
    return result;
}

function extractArticle(html, sourceFile) {
    const match = html.match(/<article[\s\S]*?<\/article>/i);
    if (!match) throw new Error(`Article markup not found: ${sourceFile}`);
    return match[0];
}

function youtubeEmbed(urlString) {
    const decoded = urlString.replaceAll('&amp;', '&');
    try {
        const url = new URL(decoded);
        const id = url.hostname === 'youtu.be'
            ? url.pathname.slice(1)
            : url.searchParams.get('v');
        if (!id) return null;
        const params = new URLSearchParams();
        const list = url.searchParams.get('list');
        if (list) params.set('list', list);
        const query = params.size ? `?${params}` : '';
        return `https://www.youtube-nocookie.com/embed/${id}${query}`;
    } catch {
        return null;
    }
}

function enhanceVideos(article) {
    return article.replace(
        /<(figure|p)([^>]*)>\s*(?:<div class="source">\s*)?<a href="(https:\/\/(?:youtu\.be|www\.youtube\.com)[^"]+)">[\s\S]*?<\/a>(?:\s*<\/div>)?\s*<\/\1>/gi,
        (whole, _tag, _attrs, url) => {
            const embed = youtubeEmbed(url);
            if (!embed) return whole;
            return `<section class="video-card">
                <div class="video-copy"><span>VIDEO ARCHIVE</span><strong>영상으로 바로 보기</strong></div>
                <div class="video-frame"><iframe src="${embed}" title="NIKKE 영상 가이드" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
            </section>`;
        }
    );
}

function optimizeImages(article, sourceFile, page) {
    const refs = [...new Set([...article.matchAll(/<img[^>]+src="([^"]+)"/gi)].map(match => match[1]))];
    const replacements = new Map();
    const targetDir = path.join(assetsRoot, page.slug);
    fs.mkdirSync(targetDir, { recursive: true });

    refs.forEach((reference, index) => {
        const sourcePath = path.resolve(path.dirname(sourceFile), decodeURIComponent(reference));
        if (!fs.existsSync(sourcePath)) throw new Error(`Missing exported image: ${sourcePath}`);

        const outputName = `${page.slug}-${String(index + 1).padStart(2, '0')}.webp`;
        const outputPath = path.join(targetDir, outputName);
        const relativePath = `assets/${page.slug}/${outputName}`;
        const conversion = spawnSync(cwebp, [
            '-quiet', '-q', '90', '-m', '6', '-sharp_yuv', sourcePath, '-o', outputPath
        ], { stdio: 'inherit' });

        if (conversion.status !== 0) throw new Error(`WebP conversion failed: ${sourcePath}`);
        replacements.set(reference, relativePath);
    });

    for (const [original, replacement] of replacements) {
        article = article.split(original).join(replacement);
    }

    article = article
        .replace(/ data-notion-image="[^"]*"/gi, '')
        .replace(/<img\s+/gi, '<img loading="lazy" decoding="async" ')
        .replace(/<a href="(assets\/[^"]+)">/gi, '<a class="image-open" href="$1" aria-label="이미지 크게 보기">')
        .replace(/<details([^>]*)\sopen=""([^>]*)>/gi, '<details$1$2>');

    return article;
}

function renderPage(page, article) {
    return `<!doctype html>
<html lang="ko" data-page="nikke">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="../site-backdrop.js?v=trial-20261011"></script>
    <title>${page.label} · NIKKE</title>
    <script src="archive-theme.js?v=site-theme-20261011"></script>
    <link rel="stylesheet" href="archive.css?v=site-theme-20261011">
</head>
<body>
    <main class="archive-shell">
        <p class="archive-eyebrow">${page.eyebrow}</p>
        ${article}
        <p class="archive-origin">한울의 Notion HTML 내보내기에서 가져온 자료입니다.</p>
    </main>
    <dialog class="lightbox" id="lightbox" aria-label="이미지 크게 보기">
        <button class="lightbox-close" type="button" aria-label="닫기">×</button>
        <img alt="확대 이미지">
    </dialog>
    <script src="archive.js?v=2"></script>
</body>
</html>`;
}

// Shared archive styles and runtime are maintained in nikke-notion/.
// Importing content must not replace the site's current theme or behavior.
for (const asset of ['archive.css', 'archive.js', 'archive-theme.js']) {
    if (!fs.existsSync(path.join(outputRoot, asset))) {
        throw new Error(`Missing shared archive asset: ${asset}`);
    }
}

if (!fs.existsSync(cwebp)) throw new Error(`cwebp is required at ${cwebp}`);
fs.mkdirSync(assetsRoot, { recursive: true });

let imageCount = 0;
let importedCount = 0;
for (const page of pages) {
    if (page.custom) {
        process.stdout.write(`Preserved custom page: ${page.slug}\n`);
        continue;
    }
    const sourceFile = findExportedPage(page.id);
    let article = extractArticle(fs.readFileSync(sourceFile, 'utf8'), sourceFile);
    imageCount += [...article.matchAll(/<img[^>]+src="([^"]+)"/gi)].length;
    article = optimizeImages(article, sourceFile, page);
    article = enhanceVideos(article);
    fs.writeFileSync(path.join(outputRoot, `${page.slug}.html`), renderPage(page, article));
    importedCount += 1;
    process.stdout.write(`Imported ${page.slug}\n`);
}

process.stdout.write(`Done: ${importedCount} imported pages, ${imageCount} optimized images\n`);
