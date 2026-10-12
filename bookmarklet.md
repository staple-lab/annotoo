# Notate bookmarklet

Inject the widget into any page you already have open — handy for annotating a dev preview
or a page you didn't pre-wire with a `<script>` tag.

## Setup

1. Host `notate.js` somewhere reachable (e.g. your dev server, or alongside a page on the
   hub). Note its URL.
2. Create a new browser bookmark. For the **URL**, paste the snippet below, replacing
   `HOST_URL` with where `notate.js` lives.

```
javascript:(function(){if(window.__notateBooted){return;}var s=document.createElement('script');s.src='HOST_URL/notate.js';s.setAttribute('data-notate','loader');document.body.appendChild(s);})();
```

Example with a local dev server:

```
javascript:(function(){if(window.__notateBooted){return;}var s=document.createElement('script');s.src='http://localhost:4173/notate.js';s.setAttribute('data-notate','loader');document.body.appendChild(s);})();
```

## Use

1. Open the page you want to annotate.
2. Click the bookmark — the Notate toolbar appears bottom-left.
3. Annotate and **Bundle for Hub** as usual.

The loader is idempotent: clicking it twice on the same page does nothing the second time
(`__notateBooted` guard). The injected `<script data-notate>` tag is stripped from exported
bundles automatically.

> Note: some sites block injected scripts via Content-Security-Policy. Your own hub-hosted
> pages and local dev servers are fine; third-party sites may not be.
