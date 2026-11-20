// Mix hard failures (try/catch on TimeoutError) with soft checks (exists()).

import { browser, TimeoutError } from "bunwright";

const page = await browser.newPage();

try {
  await page
    .navigate("https://example.com")
    .click("role:button[name='Does not exist']")
    .waitForURL("**/success");
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log("Button not found, continuing with fallback");
  } else {
    throw error;
  }
}

const exists = await page.exists("role:button[name='Submit']");
if (exists) {
  console.log("Submit button found");
  await page.click("role:button[name='Submit']");
} else {
  console.log("No submit button on this page, skipping");
}

await browser.close();
