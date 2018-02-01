const express = require('express');
const app = express();
const puppeteer = require('puppeteer');

const randomUUID = require('random-uuid');


app.all('*', function enableCors(request, response, next) {
  response.setHeader('Access-Control-Allow-Origin', '*');

  if('url' in request.query && request.query.url.startsWith('https://puppeteeraas.com')) {
    return response.status(500).send({ error: 'Error calling self' });
  }
  
  return next();
});

app.get("/", function(request, response) {
    response.sendFile(`${__dirname}/views/index.html`);
});

app.get("/screenshot", async function (request, response) {
  const url = request.query.url;

  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto(url);
  const screenshot = await page.screenshot();
  await browser.close();

  response.type('png');
  response.send(screenshot);
});

app.get("/metrics", async function (request, response) {
  const url = request.query.url;

  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto(url);
  const metrics = await page.metrics();
  await browser.close();

  response.type('application/json');
  response.send(JSON.stringify(metrics));
});

app.get("/pdf", async function (request, response) {
  const url = request.query.url;
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});

  const page = await browser.newPage();
  await page.goto(url);
  const pdf = await page.pdf();
  await browser.close();
  
  response.type('application/pdf');
  response.send(pdf);
});

app.get("/content", async function (request, response) {
  const url = request.query.url;
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});

  const page = await browser.newPage();
  await page.goto(url);
  const content = await page.content();
  await browser.close();
  
  response.type('text/html');
  response.send(content);
});

app.get("/trace", async function (request, response) {
  const url = request.query.url;
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const filename = `/tmp/trace-${randomUUID()}.json`;

  const page = await browser.newPage();
  await page.tracing.start({path: filename, screenshots: true});
  await page.goto(url);
  await page.tracing.stop();
  await browser.close();
  
  response.type('application/json');
  response.sendFile(filename);
});

app.get("/test", async function (request, response) {
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  
  await browser.close();
  
  response.send("OK")
});

const listener = app.listen(8084, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
