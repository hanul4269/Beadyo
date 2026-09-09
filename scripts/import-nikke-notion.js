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
    { slug: 'raid', id: '3a3914205419805580f8e531694cd8ec', label: '솔로레이드 뮤지엄', eyebrow: 'RAID MUSEUM' },
    { slug: 'order', id: '3bf91420541980e89089d07b5e1987d8', label: '스토리 순서', eyebrow: 'STORY NOTE' }
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
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${page.label} · NIKKE</title>
    <link rel="stylesheet" href="archive.css">
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

const archiveCss = `:root {
    color-scheme: dark;
    --ink: #f0f2f5;
    --muted: #99a2b2;
    --line: rgba(255,255,255,.11);
    --panel: #121722;
    --cyan: #74e6f5;
    --yellow: #f5d553;
}

* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; overflow: hidden; }
body {
    background:
        linear-gradient(rgba(116,230,245,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(116,230,245,.035) 1px, transparent 1px),
        radial-gradient(circle at 100% 0, rgba(35,61,94,.42), transparent 38%),
        #0b0f16;
    background-size: 54px 54px, 54px 54px, auto, auto;
    color: var(--ink);
    font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow-wrap: anywhere;
}

a { color: var(--cyan); }
.archive-shell { width: min(1160px, 100%); margin: 0 auto; padding: clamp(26px, 5vw, 72px); }
.archive-eyebrow {
    margin: 0 0 12px;
    color: var(--cyan);
    font-size: 10px;
    font-weight: 950;
    letter-spacing: .22em;
}
.page > header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--line); }
.page-title { margin: 0; color: #fff; font-size: clamp(34px, 6vw, 68px); line-height: .98; letter-spacing: -.055em; }
.page-description:empty { display: none; }
.page-body { display: flow-root; }
.page-body > p {
    margin: 16px 0;
    color: #d8dce3;
    font-size: 15px;
    font-weight: 750;
    line-height: 1.8;
}
.page-body > p:has(+ figure),
.page-body > p:has(+ details) {
    margin-top: 34px;
    color: var(--yellow);
    font-size: 17px;
    font-weight: 950;
}
.image { margin: 14px 0 26px; }
.image-open { display: block; border: 1px solid var(--line); background: #090c12; text-decoration: none; cursor: zoom-in; }
.image img { display: block; width: 100% !important; height: auto; }
details.toggle {
    margin: 14px 0;
    border: 1px solid var(--line);
    background: rgba(18,23,34,.88);
    box-shadow: 0 18px 46px rgba(0,0,0,.15);
}
details.toggle[open] { border-color: rgba(116,230,245,.36); }
details.toggle > summary {
    position: relative;
    padding: 19px 52px 19px 20px;
    color: #eef1f5;
    font-size: 15px;
    font-weight: 950;
    cursor: pointer;
    list-style: none;
}
details.toggle > summary::-webkit-details-marker { display: none; }
details.toggle > summary::after {
    content: "+";
    position: absolute;
    right: 20px;
    top: 50%;
    color: var(--cyan);
    font-size: 24px;
    font-weight: 400;
    transform: translateY(-50%);
}
details.toggle[open] > summary { border-bottom: 1px solid var(--line); }
details.toggle[open] > summary::after { content: "−"; color: var(--yellow); }
.indented { padding: 16px; }
.indented .image:first-child { margin-top: 0; }
.indented .image:last-child { margin-bottom: 0; }
.video-card {
    margin: 20px 0;
    padding: clamp(16px, 3vw, 28px);
    border: 1px solid rgba(116,230,245,.28);
    background: linear-gradient(135deg, rgba(116,230,245,.09), rgba(18,23,34,.9));
}
.video-copy { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
.video-copy span { color: var(--cyan); font-size: 10px; font-weight: 950; letter-spacing: .18em; }
.video-copy strong { color: #fff; font-size: 14px; }
.video-frame { position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: #05070a; }
.video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.archive-origin { margin: 46px 0 0; padding-top: 18px; border-top: 1px solid var(--line); color: #687181; font-size: 11px; }
.lightbox {
    width: min(96vw, 1600px);
    max-width: none;
    max-height: 94vh;
    padding: 42px 12px 12px;
    border: 1px solid rgba(116,230,245,.35);
    background: #06080d;
    overflow: auto;
}
.lightbox::backdrop { background: rgba(0,0,0,.88); backdrop-filter: blur(4px); }
.lightbox img { display: block; max-width: 100%; height: auto; margin: auto; }
.lightbox-close { position: fixed; top: max(14px, 3vh); right: max(14px, 3vw); z-index: 2; width: 38px; height: 38px; border: 1px solid var(--line); border-radius: 50%; background: #111722; color: #fff; font-size: 25px; cursor: pointer; }

@media (max-width: 600px) {
    .archive-shell { padding: 24px 14px 38px; }
    .page > header { margin-bottom: 22px; padding-bottom: 18px; }
    .page-body > p { font-size: 14px; line-height: 1.7; }
    .indented { padding: 8px; }
    .image { margin: 10px 0 18px; }
    .video-copy { align-items: flex-start; flex-direction: column; }
}
`;

const archiveJs = `(() => {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = lightbox.querySelector('img');
    let syncFrame = 0;

    function reportHeight() {
        cancelAnimationFrame(syncFrame);
        syncFrame = requestAnimationFrame(() => {
            const content = document.querySelector('.archive-shell');
            window.parent.postMessage({
                type: 'nikke:notion-height',
                path: window.location.pathname,
                height: Math.ceil(content.getBoundingClientRect().bottom)
            }, window.location.origin);
        });
    }

    document.querySelectorAll('a').forEach(link => {
        if (!link.classList.contains('image-open')) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
    });

    document.querySelectorAll('.image-open').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            lightboxImage.src = link.href;
            lightbox.showModal();
        });
    });

    lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', event => {
        if (event.target === lightbox) lightbox.close();
    });
    document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', reportHeight));
    document.querySelectorAll('img').forEach(image => image.addEventListener('load', reportHeight));
    window.addEventListener('load', reportHeight);
    window.addEventListener('resize', reportHeight);
    new ResizeObserver(reportHeight).observe(document.querySelector('.archive-shell'));
    reportHeight();
})();
`;

if (!fs.existsSync(cwebp)) throw new Error(`cwebp is required at ${cwebp}`);
fs.mkdirSync(assetsRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, 'archive.css'), archiveCss);
fs.writeFileSync(path.join(outputRoot, 'archive.js'), archiveJs);

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
