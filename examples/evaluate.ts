// Drop down to raw JS via evaluate() and into CDP for protocol-level calls.

import { browser } from "bunwright";

const page = await browser.newPage();

await page.navigate("https://example.com");

const title = await page.evaluate(() => document.title);
const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll("a")).map((a) => a.href),
);

console.log("Title:", title);
console.log("Links:", links);

const networkResponse = await page.cdp("Network.getCookies", {});
console.log("Cookies:", networkResponse);

await browser.close();
