var express = require('express');
var app = express();

app.all('*', function(request, response, next) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  
  return next();
});

app.get("/screenshot", async function (request, response) {
  const puppeteer = require('puppeteer');
  const randomUUID = require('random-uuid');
  const url = request.query.url;
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const filename = `/tmp/screenshot-${randomUUID()}.png`;


  const page = await browser.newPage();
  await page.goto(url);
  await page.screenshot({path: filename});
  await browser.close();

  response.sendFile(filename);
});

app.get("/pdf", async function (request, response) {
  const puppeteer = require('puppeteer');
  const randomUUID = require('random-uuid');
  const url = request.query.url;
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const filename = `/tmp/pdf-${randomUUID()}.pdf`;


  const page = await browser.newPage();
  await page.goto(url);
  await page.pdf({path: filename});
  await browser.close();
  
  response.sendFile(filename);
});

app.get("/trace", async function (request, response) {
  const puppeteer = require('puppeteer');
  const randomUUID = require('random-uuid');
  const url = request.query.url;
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const filename = `/tmp/trace-${randomUUID()}.json`;

  const page = await browser.newPage();
  await page.tracing.start({path: filename});
  await page.goto(url);
  await page.tracing.stop();
  await browser.close();
  
  response.sendFile(filename);
});

app.get("/test", async function (request, response) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  
  await browser.close();
  
  response.send("OK")
});

var listener = app.listen(8084, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
