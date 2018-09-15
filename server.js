/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const puppeteer = require('puppeteer');
const randomUUID = require('random-uuid');
const fs = require('fs');
const util = require('util');
const marked = require('marked');
const ua = require('universal-analytics');
const {URL} = require('url');
const gsearch = require('./helpers/gsearch.js');

const PORT = process.env.PORT || 8080;
const GA_ACCOUNT = 'UA-114816386-1';
const app = express();

const isAllowedUrl = (string) => {
  try {
    const url = new URL(string);
    return url.hostname !== 'pptraas.com' && !url.hostname.startsWith('puppeteerexamples');
  } catch (err) {
    return false;
  }
};
// Adds cors, records analytics hit, and prevents self-calling loops.
app.use((request, response, next) => {
  const url = request.query.url;
  if (url && !isAllowedUrl(url)) {
    return response.status(500).send({
      error: 'URL is either invalid or not allowed'
    });
  }

  response.set('Access-Control-Allow-Origin', '*');

  // Record GA hit.
  const visitor = ua(GA_ACCOUNT, {https: true});
  visitor.pageview(request.originalUrl).send();

  next();
});

app.get('/', async (request, response) => {
  const readFile = util.promisify(fs.readFile);
  const md = (await readFile('./README.md', {encoding: 'utf-8'}));
  /* eslint-disable */
  response.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Puppeteer as a service</title>
      <meta name='description' content='A hosted service that makes the Chrome Puppeteer API accessible via REST based queries. Tracing, Screenshots and PDFs' />
      <meta name='google-site-verification' content='4Tf-yH47m_tR7aSXu7t3EI91Gy4apbwnhg60Jzq_ieY' />
      <style>
        body {
          padding: 40px;
        }
        body, h2, h3, h4 {
          font-family: 'Product Sans', sans-serif;
          font-weight: 300;
        }
      </style>
    </head>
    <body>${marked(md)}</body>
    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src='https://www.googletagmanager.com/gtag/js?id=${GA_ACCOUNT}'></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', '${GA_ACCOUNT}');
    </script>
    </html>
  `);
  /* eslint-enable */
});

// Init code that gets run before all request handlers.
app.all('*', async (request, response, next) => {
  response.locals.browser = await puppeteer.launch({
    dumpio: true,
    // headless: false,
    // executablePath: 'google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // , '--disable-dev-shm-usage']
  });

  next(); // pass control on to routes.
});

app.get('/screenshot', async (request, response) => {
  const url = request.query.url;
  if (!url) {
    return response.status(400).send(
      'Please provide a URL. Example: ?url=https://example.com');
  }

  // Default to a reasonably large viewport for full page screenshots.
  const viewport = {
    width: 1280,
    height: 1024,
    deviceScaleFactor: 2
  };

  let fullPage = true;
  const size = request.query.size;
  if (size) {
    const [width, height] = size.split(',').map(item => Number(item));
    if (!(isFinite(width) && isFinite(height))) {
      return response.status(400).send(
        'Malformed size parameter. Example: ?size=800,600');
    }
    viewport.width = width;
    viewport.height = height;

    fullPage = false;
  }

  const browser = response.locals.browser;

  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(url, {waitUntil: 'networkidle0'});

    const opts = {
      fullPage,
      // omitBackground: true
    };

    if (!fullPage) {
      opts.clip = {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height
      };
    }

    const buffer = await page.screenshot(opts);
    response.type('image/png').send(buffer);
  } catch (err) {
    response.status(500).send(err.toString());
  }

  await browser.close();
});

app.get('/metrics', async (request, response) => {
  const url = request.query.url;
  if (!url) {
    return response.status(400).send(
      'Please provide a URL. Example: ?url=https://example.com');
  }

  const browser = response.locals.browser;
  const page = await browser.newPage();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const metrics = await page.metrics();
  await browser.close();

  response.type('application/json').send(JSON.stringify(metrics));
});

app.get('/pdf', async (request, response) => {
  const url = request.query.url;
  if (!url) {
    return response.status(400).send(
      'Please provide a URL. Example: ?url=https://example.com');
  }

  const browser = response.locals.browser;

  const page = await browser.newPage();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const pdf = await page.pdf();
  await browser.close();

  response.type('application/pdf').send(pdf);
});

app.get('/ssr', async (request, response) => {
  const url = request.query.url;
  if (!url) {
    return response.status(400).send(
      'Please provide a URL. Example: ?url=https://example.com');
  }

  const browser = response.locals.browser;

  try {
    const page = await browser.newPage();
    const res = await page.goto(url, {waitUntil: 'networkidle0'});

    // Inject <base> on page to relative resources load properly.
    await page.evaluate(url => {
      /* global document */
      const base = document.createElement('base');
      base.href = url;
      document.head.prepend(base); // Add to top of head, before all other resources.
    }, url);

    // Remove scripts(except structured data) and html imports. They've already executed and loaded on the page.
    await page.evaluate(() => {
      const elements = document.querySelectorAll('script:not([type='application/ld+json']), link[rel='import']');
      elements.forEach(e => e.remove());
    });

    const html = await page.content();
    response.status(res.status()).send(html);
  } catch (e) {
    response.status(500).send(e.toString());
  }

  await browser.close();
});

app.get('/trace', async (request, response) => {
  const url = request.query.url;
  if (!url) {
    return response.status(400).send(
      'Please provide a URL. Example: ?url=https://example.com');
  }

  const browser = response.locals.browser;
  const filename = `/tmp/trace-${randomUUID()}.json`;

  const page = await browser.newPage();
  try {
    page.on('error', error => {
      console.log(url, error);
    });
    await page.tracing.start({path: filename, screenshots: true});
    await page.goto(url, {waitUntil: 'networkidle0'});
    await page.tracing.stop();
    response.type('application/json').sendFile(filename);
  } catch (e) {
    response.status(500).send(e.toString());
  }

  await browser.close();
});

app.get('/version', async (request, response) => {
  const browser = response.locals.browser;
  const ua = await browser.userAgent();
  await browser.close();
  response.send(ua);
});

app.get('/gsearch', async (request, response) => {
  const url = request.query.url;
  if (!url) {
    return response.status(400).send(
      'Please provide a URL. Example: ?url=https://example.com');
  }

  const browser = response.locals.browser;
  const results = await gsearch.run(browser, url, `/tmp/trace-${randomUUID()}.json`);
  await browser.close();

  const style = `
    <style>
      body {
        padding: 1em;
        font-size: 20px;
        font-family: sans-serif;
        font-weight: 300;
        line-height: 1.4;
      }
      .summary a {
        color: currentcolor;
        text-decoration: none;
      }
      .red {
        color: #F44336;
      }
      a {
        color: magenta;
      }
    </style>
  `;
  response.send(style + results);
});

app.get('/scrape', async (request, response) => {

  const artist = request.query.artist ? request.query.artist : 'drake';
  const source = request.query.source ? request.query.source : 'e-online';

  let WEB_URL = 'https://www.billboard.com/music/'+artist+'/news';

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  switch (source) {
    case 'billboard':
      WEB_URL = 'https://www.billboard.com/music/'+artist+'/news';
      break;
    case 'tmz':
      WEB_URL = 'http://www.tmz.com/person/'+artist;
      break;
    case 'people':
      WEB_URL = 'http://people.com/tag/'+artist;
      break;
    case 'e-online':
      WEB_URL = 'https://www.eonline.com/news/'+artist+'/articles';
      break;
    default:
      WEB_URL = 'https://www.billboard.com/music/'+artist+'/news';
      break;
  }

  await page.goto(WEB_URL);

  const result = await page.evaluate(() => {
    let data = [];

    // Billboard
    // let articles = document.querySelectorAll('.artist-section__item');
    // for(let article of articles){
    //   let title = article.innerText;
    //   let link = article.childNodes[1].href
    //   let host = article.childNodes[1].host
    //   let image = article.childNodes[1].childNodes[1].childNodes[1].childNodes[5].src
    //   data.push({title, link, host, image});
    // }

    // E! Online
    const articles = document.querySelectorAll('.articleList .story');
    for (const article of articles) {
      const title = article.childNodes[3].childNodes[1].innerText;
      const link = article.childNodes[1].href;
      // let host = article.baseURI
      const host = 'e-online';
      const image = article.childNodes[1].childNodes[1].childNodes[0].src;
      const time = article.childNodes[3].childNodes[5].innerText;
      data.push({title, link, host, image, time});
    }

    // People
    // let articles = document.querySelectorAll('.type-article');
    // for(let article of articles){
    //   let title = article.childNodes[7].children[1].innerText
    //   let link = article.children[0].href
    //   let host = article.children[0].host
    //   let image = article.children[0].children[0].dataset.src
    //   // let time = article.childNodes[3].childNodes[5].innerText
    //   data.push({title, link, host, image});
    // }

    // TMZ
    // let articles = document.querySelectorAll('.personsingle-storyitem');
    // for(let article of articles){
    //   let title = article.childNodes[3].children[0].innerText
    //   let subheading = article.childNodes[3].children[1].innerText
    //   let link = article.children[0].href
    //   let host = article.children[0].host
    //   let image = article.children[0].children[1].src
    //   let time = article.childNodes[3].children[2].innerText
    //   data.push({title, subheading, link, host, image, time});
    // }

    return {
      scrapedOn: +new Date(),
      data
    };

  });

  browser.close();

  (result) => {
    fs.writeFile('./sources/'+source+'/'+artist+'.json', JSON.stringify(result, null, 4), (err) => {
      if (err) {
        console.error(err);
        return;
      };
      console.log(source+'/'+artist +'. has been created');
    });
    response.status(200).send(result); // Success!
  };

});

app.listen(PORT, function() {
  console.log(`App is listening on port ${PORT}`);
});

// Make sure node server process stops if we get a terminating signal.
function processTerminator(sig) {
  if (typeof sig === 'string') {
    process.exit(1);
  }
  console.log('%s: Node server stopped.', Date(Date.now()));
}

const signals = [
  'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS',
  'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'];
signals.forEach(sig => {
  process.once(sig, () => processTerminator(sig));
});
