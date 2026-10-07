const artifactScrollbarCss = `
<style>
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  *::-webkit-scrollbar-thumb { border: 1px solid transparent; border-radius: 999px; background: rgba(140, 148, 181, 0.22); background-clip: padding-box; }
  * { scrollbar-color: rgba(140, 148, 181, 0.22) transparent; }
</style>`

const htmlHeadOpenRegex = /<head([^>]*)>/i
const htmlDocumentPattern = /<!doctype html|<html[\s>]/i

const artifactDarkPreviewCss = `
    html { background: #262936; }
    body { background: #262936; color: #d5daed; }
    a { color: #b9bff3; }
    code, pre { color: #d5daed; background: rgba(255,255,255,0.04); }
    blockquote { color: #969db7; border-left: 3px solid rgba(185,191,243,0.32); margin-left: 0; padding-left: 1rem; }
    hr { border: 0; border-top: 1px solid rgba(169,178,215,0.14); }
`

function escapeScriptContent(script: string) {
  return script.replace(/<\/script/gi, '<\\/script')
}

export function buildHtmlPreview(content: string) {
  const capture = `${artifactScrollbarCss}
<script>
window.addEventListener('error', function(event) {
  parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: event.message, stack: event.error && event.error.stack }, '*');
});
window.addEventListener('unhandledrejection', function(event) {
  parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: String(event.reason && event.reason.message || event.reason), stack: event.reason && event.reason.stack }, '*');
});
const originalError = console.error;
console.error = function(...args) {
  parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: args.map(String).join(' ') }, '*');
  originalError.apply(console, args);
};
</script>`
  if (!htmlDocumentPattern.test(content)) {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${capture}
  <style>
    html, body { min-height: 100%; margin: 0; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    ${artifactDarkPreviewCss}
  </style>
</head>
<body>${content}</body>
</html>`
  }

  return htmlHeadOpenRegex.test(content)
    ? content.replace(htmlHeadOpenRegex, `<head$1>${capture}`)
    : `${capture}${content}`
}

export function buildReactPreview(compiledJs: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${artifactScrollbarCss}
  <style>
    html, body, #root { min-height: 100%; margin: 0; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    ${artifactDarkPreviewCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.addEventListener('error', function(event) {
      parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: event.message, stack: event.error && event.error.stack }, '*');
    });
    window.addEventListener('unhandledrejection', function(event) {
      parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: String(event.reason && event.reason.message || event.reason), stack: event.reason && event.reason.stack }, '*');
    });
    const originalError = console.error;
    console.error = function(...args) {
      parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: args.map(String).join(' ') }, '*');
      originalError.apply(console, args);
    };
  </script>
  <script type="module">${escapeScriptContent(compiledJs)}</script>
</body>
</html>`
}
