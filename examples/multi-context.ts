// Run two contexts in parallel and read each page's URL.

import { browser } from "bunwright";

const [adminCtx, userCtx] = await Promise.all([
  browser.newContext(),
  browser.newContext(),
]);

const adminPage = await adminCtx.newPage();
const userPage = await userCtx.newPage();

await Promise.all([
  adminPage.navigate("https://example.com/admin"),
  userPage.navigate("https://example.com"),
]);

console.log("Admin URL:", adminPage.webview.url);
console.log("User URL:", userPage.webview.url);

await browser.close();
