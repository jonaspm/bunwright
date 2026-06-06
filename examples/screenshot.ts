// Minimal smoke test: open a page, capture a screenshot, exit.

import { browser } from "bunwright";

const page = await browser.newPage();

await page
  .navigate("https://example.com")
  .screenshot("./example.png");

await browser.close();
console.log("Screenshot saved");
