/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const puppeteer = require('puppeteer');
const randomUUID = require('random-uuid');
const fs = require('fs');
const http = require('http');
const util = require('util');
const marked = require('marked');
const {URL} = require('url');
const shortid = require('shortid');

const PORT = process.env.PORT || 8080;
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
      <meta name="description" content="A hosted service that makes the Chrome Puppeteer API accessible via REST based queries. Tracing, Screenshots and PDFs" />
      <meta name="google-site-verification" content="4Tf-yH47m_tR7aSXu7t3EI91Gy4apbwnhg60Jzq_ieY" />
      <style>
        body {
          padding: 40px;
        }
        body, h2, h3, h4 {
          font-family: "Product Sans", sans-serif;
          font-weight: 300;
        }
      </style>
    </head>
    <body>${marked(md)}</body>
    </html>
  `);
  /* eslint-enable */
});

// Init code that gets run before all request handlers.
app.all('*', async (request, response, next) => {
  response.locals.browser = await puppeteer.launch({
    dumpio: true,
    // headless: false,
    executablePath: 'google-chrome-unstable',
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

  const scale = request.query.scale;
  if(scale) {
    if(!isFinite(scale)){
      return response.status(400).send(
        'Malformed scale parameter. Example ?scale=1.0');
    }
    viewport.deviceScaleFactor = Number(request.query.scale);
  }

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
    await page.goto(url, {waitUntil: 'load'});

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

    let buffer;

    const element = request.query.element;
    if (element) {
      const elementHandle = await page.$(element);
      if (!elementHandle) {
        return response.status(404).send(
          `Element ${element} not found`);
      }
      buffer = await elementHandle.screenshot();
    } else {
      const filename = '/home/pptruser/' + shortid.generate() + '.png';
      opts.path = filename;
      await page.screenshot(opts);
      const readFile = util.promisify(fs.readFile);
      buffer = (await readFile(filename));
    }
    response.type('image/png').send(buffer);
  } catch (err) {
    response.status(500).send(err.toString());
  }

  await browser.close();
});

app.get('/svgexport', async (request, response) => {
  const url = request.query.url;
  if (!url) {
    return response.status(400).send(
      'Please provide a URL. Example: ?url=https://example.com');
  }

  const browser = response.locals.browser;
  
  try {

    let buffer;
    const id = shortid.generate();
    const svgFilename = '/tmp/' + id + '.svg';
    const pngFilename = '/tmp/' + id + '.png';
    
    let writeStream = fs.createWriteStream(svgFilename);
    const get = util.promisify(http.get);
    let response = await get(request.query.url);
    response.pipe(writeStream);
    writeStream.close();
   
    const datafile = [
	    {"input": [svgFilename,"0.4x"]},
	    {"output": [pngFilename]}
    ];
    
    const render = util.promisify(svgexport.render);
    await render(datafile);
	
    const readFile = util.promisify(fs.readFile);
    buffer = (await readFile(pngFilename));
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

  const options = {};
  const format = request.query.format;
  if(format) {
    options.format = format;
  }
  const landscape = request.query.landscape;
  if(landscape) {
    options.landscape = true;
  }

  const page = await browser.newPage();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const pdf = await page.pdf(options);
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
      const elements = document.querySelectorAll(
        'script:not([type="application/ld+json"]), link[rel="import"]');
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
