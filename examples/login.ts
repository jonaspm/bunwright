// Login flow: label: + role: selectors, Promise.all for parallel reads,
// waitForURL, then capture a success screenshot.

import { browser } from "bunwright";

const page = await browser.newPage();

await page
  .navigate("https://the-internet.herokuapp.com/login")
  .type("label:Username", "tomsmith")
  .type("label:Password", "SuperSecretPassword!")
  .click("role:button[name=' Login']")
  .waitForURL("**/secure");

const [title, status] = await Promise.all([
  page.evaluate(() => document.title),
  page.locator("role:status").innerText(),
]);

console.log("Logged in successfully");
console.log("Title:", title);
console.log("Status:", status);

await page.screenshot("./login-success.png");
await browser.close();
