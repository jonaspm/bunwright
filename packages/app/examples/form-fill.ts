// Fill a form with css: selectors and count matching inputs via Locator.

import { browser } from "bunwright";

console.log(browser);

const page = await browser.newPage();

await page
  .navigate("https://httpbin.org/forms/post")
  .type("css:input[name='custname']", "John Doe")
  .type("css:input[name='custtel']", "555-0100");

const count = await page.locator("css:input").count();
console.log(`Found ${count} inputs`);

await page.screenshot("./form-filled.png");
await browser.close();
