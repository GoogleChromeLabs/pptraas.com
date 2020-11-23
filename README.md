Puppeteer as a service
======================

## Render

### Render page as a PNG
http://localhost:4040/screenshot?url=https://howtank.com/ (full page)

http://localhost:4040/screenshot?url=https://developers.google.com&size=400,400

http://localhost:4040/screenshot?url=https://www.wikipedia.org&element=.central-featured

### Render page as a PDF
http://localhost:4040/pdf?url=https://howtank.com/

### Render generated static markup of page ("SSR")
http://localhost:4040/ssr?url=https://angular2-hn.firebaseapp.com/

### Render as Google Search bot

Detects what features a page is using and cross references them with the features
supported by the [Google Search bot](https://developers.google.com/search/docs/guides/rendering).

http://localhost:4040/gsearch?url=https://howtank.com/

## Performance

### Get a timeline trace

http://localhost:4040/trace?url=https://howtank.com/

#### View the trace in trace-viewer:

http://chromedevtools.github.io/timeline-viewer/?loadTimelineFromURL=https://localhost:4040/trace?url=https://howtank.com/

### Get metrics
http://localhost:4040/metrics?url=https://howtank.com/

## Misc

### Print UserAgent / Chromium version
http://localhost:4040/version

