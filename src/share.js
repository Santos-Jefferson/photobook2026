// Export a finished story as a single self-contained .html file: all images
// are already base64 (embedded inline), the styles and a tiny vanilla-JS
// viewer are inlined too, so the recipient just double-clicks the file — no
// server, no build, no internet required. Great for sharing an MVP for review.

import { buildSlides } from './book'

// The standalone viewer's script. Plain ES5-ish JS, NO template literals or
// `${...}` so it can live safely inside the template literal below. `__STORY__`
// is replaced with the embedded data.
const VIEWER_SCRIPT = `
(function () {
  var STORY = __STORY__;
  var slides = STORY.slides || [];
  var index = 0;
  var app = document.getElementById('app');

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function escapeText(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderSlide(s) {
    if (s.type === 'opening') {
      var inner =
        (s.vibe ? '<span class="kicker">' + escapeText(s.vibe) + '</span>' : '') +
        '<h1 class="cover-title">' + escapeText(s.title) + '</h1>' +
        '<p class="cover-body">' + escapeText(s.text) + '</p>' +
        '<span class="swipe-hint">swipe to begin &rarr;</span>';
      return el('div', 'slide slide-text slide-opening in', '<div class="slide-text-inner">' + inner + '</div>');
    }
    if (s.type === 'closing') {
      var c =
        '<span class="kicker">the end</span>' +
        '<p class="cover-body large">' + escapeText(s.text) + '</p>' +
        '<h2 class="closing-title">' + escapeText(s.title) + '</h2>';
      return el('div', 'slide slide-text slide-closing in', '<div class="slide-text-inner">' + c + '</div>');
    }
    var node = el('div', 'slide slide-photo in');
    if (s.image) {
      var bg = el('img', 'slide-img-bg');
      bg.src = s.image;
      bg.setAttribute('aria-hidden', 'true');
      var img = el('img', 'slide-img');
      img.src = s.image;
      img.alt = s.caption || 'Photo';
      node.appendChild(bg);
      node.appendChild(img);
    } else {
      node.appendChild(el('div', 'slide-img slide-img-missing'));
    }
    node.appendChild(el('div', 'scrim'));
    var cap =
      (s.caption ? '<p class="caption">' + escapeText(s.caption) + '</p>' : '') +
      (s.narrative ? '<p class="narrative">' + escapeText(s.narrative) + '</p>' : '') +
      (s.styleApplied ? '<span class="style-chip">' + escapeText(String(s.styleApplied).replace(/_/g, ' ')) + '</span>' : '');
    node.appendChild(el('div', 'slide-caption', cap));
    return node;
  }

  function render() {
    app.innerHTML = '';
    var viewer = el('div', 'viewer');

    var progress = el('div', 'progress');
    for (var i = 0; i < slides.length; i++) {
      var seg = el('span', 'progress-seg' + (i < index ? ' done' : '') + (i === index ? ' active' : ''));
      seg.appendChild(el('i'));
      progress.appendChild(seg);
    }
    viewer.appendChild(progress);

    viewer.appendChild(renderSlide(slides[index]));

    if (index > 0) {
      var prev = el('button', 'nav nav-prev', '\\u2039');
      prev.onclick = function () { go(-1); };
      viewer.appendChild(prev);
    }
    if (index < slides.length - 1) {
      var next = el('button', 'nav nav-next', '\\u203a');
      next.onclick = function () { go(1); };
      viewer.appendChild(next);
    }

    var zl = el('button', 'tapzone tapzone-left');
    zl.onclick = function () { go(-1); };
    var zr = el('button', 'tapzone tapzone-right');
    zr.onclick = function () { go(1); };
    viewer.appendChild(zl);
    viewer.appendChild(zr);

    app.appendChild(viewer);
  }

  function go(d) {
    index = Math.min(Math.max(index + d, 0), slides.length - 1);
    render();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  });

  var sx = 0, sy = 0;
  document.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    sx = t.clientX; sy = t.clientY;
  });
  document.addEventListener('touchend', function (e) {
    var t = e.changedTouches[0];
    var dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  });

  render();
})();
`

// Self-contained styles for the exported file — mirrors the app's light theme.
const VIEWER_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    background: linear-gradient(180deg, #eaf4fb 0%, #f7fafc 28%, #ffffff 60%);
    color: #16202c;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  #app { height: 100%; }
  .viewer { position: fixed; inset: 0; background: #0b1620; overflow: hidden; max-width: 560px; margin: 0 auto; }
  .progress { position: absolute; top: 0; left: 0; right: 0; z-index: 30; display: flex; gap: 4px; padding: 12px 12px 0; }
  .progress-seg { flex: 1; height: 3px; border-radius: 3px; background: rgba(255,255,255,0.35); overflow: hidden; }
  .progress-seg i { display: block; height: 100%; width: 0; background: #fff; }
  .progress-seg.done i, .progress-seg.active i { width: 100%; }
  .nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 25; width: 42px; height: 42px; border-radius: 50%; border: none; background: rgba(255,255,255,0.85); color: #16202c; font-size: 26px; line-height: 1; display: grid; place-items: center; box-shadow: 0 4px 16px rgba(15,45,75,0.18); }
  .nav-prev { left: 10px; } .nav-next { right: 10px; }
  .tapzone { position: absolute; top: 0; bottom: 0; width: 35%; z-index: 20; border: none; background: transparent; }
  .tapzone-left { left: 0; } .tapzone-right { right: 0; }
  .slide { position: absolute; inset: 0; }
  .slide-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: center; z-index: 2; }
  .slide-img-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: scale(1.15); filter: blur(28px) brightness(0.55); z-index: 1; }
  .slide-img-missing { background: linear-gradient(135deg, #dbe6ef, #eef4f9); }
  .scrim { position: absolute; inset: 0; z-index: 3; background: linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.4) 32%, rgba(0,0,0,0) 58%); }
  .slide-caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 22px 34px; z-index: 10; }
  .caption { font-size: 26px; line-height: 1.2; font-weight: 800; margin: 0 0 8px; color: #fff; text-shadow: 0 2px 18px rgba(0,0,0,0.6); }
  .narrative { font-size: 16px; line-height: 1.55; margin: 0; color: #eef2f6; text-shadow: 0 1px 12px rgba(0,0,0,0.7); }
  .style-chip { display: inline-block; margin-top: 14px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #fff; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); padding: 5px 10px; border-radius: 20px; }
  .slide-text { display: grid; place-items: center; padding: 40px 30px; }
  .slide-opening { background: radial-gradient(120% 90% at 50% 18%, #eaf6fc 0%, #f3f9fc 55%, #ffffff 100%); }
  .slide-closing { background: radial-gradient(120% 90% at 50% 82%, #e6faf5 0%, #f1fbf8 55%, #ffffff 100%); }
  .slide-text-inner { max-width: 32ch; text-align: center; }
  .kicker { display: inline-block; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #0aa1dd; font-weight: 700; margin-bottom: 18px; }
  .cover-title { font-size: 40px; line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 18px; font-weight: 800; color: #16202c; }
  .cover-body { font-size: 18px; line-height: 1.6; color: #46586a; margin: 0; }
  .cover-body.large { font-size: 21px; }
  .closing-title { margin: 22px 0 0; font-size: 20px; color: #0aa1dd; font-weight: 700; }
  .swipe-hint { display: block; margin-top: 34px; font-size: 13px; color: #64748b; }
  @media (min-width: 560px) {
    .viewer { border-radius: 22px; top: 20px; bottom: 20px; left: 50%; right: auto; width: min(560px, calc(100% - 40px)); transform: translateX(-50%); box-shadow: 0 20px 60px rgba(11,22,32,0.25); }
  }
`

// Build the full standalone HTML document for a finished book.
export function buildShareHtml(book) {
  const slides = buildSlides(book)
  const title = (book && book.title) || 'Photobook Story'
  const data = { title, slides }

  // Embedded as a JS object literal. Escaping `<` is what prevents the JSON
  // from prematurely closing the surrounding <script> tag (e.g. via "</...").
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const script = VIEWER_SCRIPT.replace('__STORY__', json)

  return (
    '<!doctype html>\n' +
    '<html lang="en">\n<head>\n' +
    '<meta charset="UTF-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />\n' +
    '<meta name="theme-color" content="#ffffff" />\n' +
    '<title>' + escapeHtml(title) + ' · Photobook</title>\n' +
    '<style>' + VIEWER_STYLE + '</style>\n' +
    '</head>\n<body>\n<div id="app"></div>\n' +
    '<script>' + script + '</' + 'script>\n' +
    '</body>\n</html>\n'
  )
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugify(s) {
  return (
    String(s || 'photobook-story')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'photobook-story'
  )
}

// Generate the file and trigger a download in the browser.
export function downloadStoryHtml(book) {
  const html = buildShareHtml(book)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = slugify(book && book.title) + '.html'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke a moment later so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
