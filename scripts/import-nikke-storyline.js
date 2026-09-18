#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceUrl = 'https://ssissun.github.io/nikke-storyline/';
const outputDir = path.join(__dirname, '..', 'nikke-storyline');
const outputPath = path.join(outputDir, 'index.html');
const sourceCssPath = path.join(outputDir, 'source.css');

function makeAbsoluteAssets(html) {
    return html.replace(/\b(href|src)=(['"])(.*?)\2/gi, (match, attribute, quote, value) => {
        if (!value || /^(?:https?:|data:|mailto:|tel:|#)/i.test(value)) return match;
        return `${attribute}=${quote}${new URL(value, sourceUrl).href}${quote}`;
    });
}

function removeRemoteScripts(html) {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function injectBeadyoAssets(html) {
    const style = `  <meta name="robots" content="noindex">
  <script>
    (() => {
      const storageKey = 'beadyo:theme';
      window.applyBeadyoStoryTheme = theme => {
        const next = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        document.documentElement.style.colorScheme = next;
      };
      let theme = 'light';
      try {
        theme = localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
      } catch {}
      window.applyBeadyoStoryTheme(theme);
    })();
  </script>
  <link rel="stylesheet" href="./beadyo.css?v=4">
`;
    const resizeScript = `
  <script>
    (() => {
      let frame = 0;
      const reportHeight = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          window.parent.postMessage({
            type: 'nikke:story-height',
            path: window.location.pathname,
            height: Math.ceil(document.documentElement.scrollHeight)
          }, window.location.origin);
        });
      };

      window.addEventListener('load', reportHeight);
      window.addEventListener('resize', reportHeight);
      window.addEventListener('message', event => {
        if (event.origin !== window.location.origin || event.data?.type !== 'beadyo-theme-sync') return;
        window.applyBeadyoStoryTheme?.(event.data.theme);
        try {
          localStorage.setItem('beadyo:theme', event.data.theme === 'dark' ? 'dark' : 'light');
        } catch {}
      });
      window.addEventListener('storage', event => {
        if (event.key === 'beadyo:theme') window.applyBeadyoStoryTheme?.(event.newValue);
      });
      new ResizeObserver(reportHeight).observe(document.body);
      reportHeight();
    })();
  </script>
`;

    return html
        .replace('</head>', `${style}</head>`)
        .replace('</body>', `${resizeScript}</body>`);
}

async function main() {
    const response = await fetch(sourceUrl, {
        headers: { 'user-agent': 'Beadyo storyline importer' }
    });

    if (!response.ok) {
        throw new Error(`스토리 감상순서 원본을 불러오지 못했습니다: ${response.status}`);
    }

    let html = await response.text();
    const stylesheetPath = html.match(/href=(['"])([^'"]*\/assets\/index\.[^'"]+\.css)\1/i)?.[2];
    if (!stylesheetPath) {
        throw new Error('스토리 감상순서 원본 스타일시트를 찾지 못했습니다.');
    }

    const stylesheetUrl = new URL(stylesheetPath, sourceUrl).href;
    const stylesheetResponse = await fetch(stylesheetUrl, {
        headers: { 'user-agent': 'Beadyo storyline importer' }
    });
    if (!stylesheetResponse.ok) {
        throw new Error(`스토리 감상순서 원본 스타일을 불러오지 못했습니다: ${stylesheetResponse.status}`);
    }

    const sourceCss = await stylesheetResponse.text();
    html = removeRemoteScripts(html);
    html = makeAbsoluteAssets(html);
    html = html.replace(stylesheetUrl, './source.css');
    html = injectBeadyoAssets(html);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(sourceCssPath, sourceCss);
    fs.writeFileSync(outputPath, html);
    console.log(`NIKKE 스토리 감상순서 가져오기 완료: ${path.relative(process.cwd(), outputPath)}`);
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
