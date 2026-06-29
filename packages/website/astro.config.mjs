// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: "Bunwright",
      logo: {
        src: "./src/assets/logo.svg",
        replacesTitle: false,
      },
      customCss: ["./src/styles/global.css"],
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/jonaspm/bunwright" },
        { icon: "npm", label: "npm", href: "https://www.npmjs.com/package/bunwright" },
      ],
      editLink: {
        baseUrl:
          "https://github.com/jonaspm/bunwright/edit/main/packages/website/src/content/docs/",
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      sidebar: [
        {
          label: "Guides",
          items: [
            { label: "Getting Started", slug: "guides/getting-started" },
            { label: "Selectors", slug: "guides/selectors" },
            { label: "Chaining", slug: "guides/chaining" },
            { label: "Configuration", slug: "guides/configuration" },
            { label: "Environment Variables", slug: "guides/environment-variables" },
            { label: "Windows Notes", slug: "guides/windows" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Browser", slug: "reference/browser" },
            { label: "Page", slug: "reference/page" },
            { label: "Locator", slug: "reference/locator" },
            { label: "ElementHandle", slug: "reference/element-handle" },
            { label: "Errors", slug: "reference/errors" },
            { label: "Types", slug: "reference/types" },
            { label: "Full API Reference", slug: "reference/full-api", badge: "auto" },
          ],
        },
        {
          label: "Examples",
          items: [
            { label: "Screenshot", slug: "examples/screenshot" },
            { label: "Login Flow", slug: "examples/login" },
            { label: "Form Fill", slug: "examples/form-fill" },
            { label: "Error Handling", slug: "examples/error-handling" },
            { label: "Evaluate & CDP", slug: "examples/evaluate" },
            { label: "Multi-Context", slug: "examples/multi-context" },
          ],
        },
      ],
    }),
  ],

  adapter: cloudflare(),
});
