<a href="https://github.com/GoogleChromeLabs/pptraas.com"><img style="position: absolute; top: 0; right: 0; border: 0;" src="https://s3.amazonaws.com/github/ribbons/forkme_right_darkblue_121621.png" alt="Fork me on GitHub"></a>

Puppeteer as a service
======================

## Render

### Render page as a PNG
https://pptraas.com/screenshot?url=https://paul.kinlan.me/ (full page)

https://pptraas.com/screenshot?url=https://developers.google.com&size=400,400

https://pptraas.com/screenshot?url=https://www.wikipedia.org&element=.central-featured

### Render page as a PDF
https://pptraas.com/pdf?url=https://paul.kinlan.me/

### Render generated static markup of page ("SSR")
https://pptraas.com/ssr?url=https://angular2-hn.firebaseapp.com/

### Render as Google Search bot

Detects what features a page is using and cross references them with the features
supported by the [Google Search bot](https://developers.google.com/search/docs/guides/rendering).

https://pptraas.com/gsearch?url=https://paul.kinlan.me/

## Performance

### Get a timeline trace

https://pptraas.com/trace?url=https://paul.kinlan.me/

#### View the trace in trace-viewer:

https://chromedevtools.github.io/timeline-viewer/?loadTimelineFromURL=https://pptraas.com/trace?url=https://paul.kinlan.me/

### Get metrics
https://pptraas.com/metrics?url=https://paul.kinlan.me/

## Misc

### Print UserAgent / Chromium version
https://pptraas.com/version

----
[![Deploy to now](https://deploy.now.sh/static/button.svg)](https://deploy.now.sh/?repo=https://github.com/GoogleChromeLabs/pptraas.com) [![Lighthouse score: 100/100](https://lighthouse-badge.appspot.com/?score=100&category=Perf)](https://github.com/ebidel/lighthouse-badge)
