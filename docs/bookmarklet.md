# Annotoo bookmarklet

Inject the widget into any page you already have open — handy for annotating a dev preview
or a page you didn't pre-wire with a `<script>` tag.

## Setup

1. Host `annotoo.js` somewhere reachable (your dev server, or use
   `https://unpkg.com/@staplelab/annotoo/dist/annotoo.js`). Note its URL.
2. Create a new browser bookmark. For the **URL**, paste the snippet below, replacing
   `HOST_URL` with where `annotoo.js` lives.

```
javascript:(function(){if(window.__annotooBooted){return;}var s=document.createElement('script');s.src='HOST_URL/annotoo.js';s.setAttribute('data-annotoo','loader');document.body.appendChild(s);})();
```

Example with a local dev server:

```
javascript:(function(){if(window.__annotooBooted){return;}var s=document.createElement('script');s.src='http://localhost:4173/annotoo.js';s.setAttribute('data-annotoo','loader');document.body.appendChild(s);})();
```

## Use

1. Open the page you want to annotate.
2. Click the bookmark. The Annotoo button appears bottom-right.
3. Annotate, then use **Export HTML** in the toolbar.

The loader is idempotent: clicking it twice on the same page does nothing the second time
(`__annotooBooted` guard). The injected `<script data-annotoo>` tag is stripped from exported
bundles automatically.

> Note: some sites block injected scripts via Content-Security-Policy. Your own hosted
> pages and local dev servers are fine; third-party sites may not be.
