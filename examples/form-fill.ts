// Fill a form with css: selectors and count matching inputs via Locator.

import { browser } from "bunwright";

console.log(browser);

const page = await browser.newPage();

await page
  .navigate("https://www.w3schools.com/html/html_forms.asp")
  .type("css:input[name='firstname']", "John")
  .type("css:input[name='lastname']", "Doe");

const count = await page.locator("css:input[type='text']").count();
console.log(`Found ${count} text inputs`);

await page.screenshot("./form-filled.png");
await browser.close();
