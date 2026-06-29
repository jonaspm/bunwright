import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const DIST_DIR = "./dist";
const OUTPUT_FILE = "./docs/api-reference.md";
const TYPES_ENTRY = "index.d.ts";

const dtsFiles = readdirSync(DIST_DIR)
  .filter((f) => f.endsWith(".d.ts"))
  .toSorted();
if (dtsFiles.length === 0) {
  console.error("No .d.ts files found in dist/. Run `bun run build` first.");
  process.exit(1);
}
if (!dtsFiles.includes(TYPES_ENTRY)) {
  console.error(`Missing ${TYPES_ENTRY} in dist/. Run \`bun run build\` first.`);
  process.exit(1);
}

interface ClassInfo {
  name: string;
  extends?: string;
  members: string[];
  source: string;
}
interface InterfaceInfo {
  name: string;
  members: string[];
  source: string;
}
interface TypeAliasInfo {
  name: string;
  definition: string;
  source: string;
}
interface FunctionInfo {
  name: string;
  signature: string;
  source: string;
}

const classes: ClassInfo[] = [];
const interfaces: InterfaceInfo[] = [];
const typeAliases: TypeAliasInfo[] = [];
const functions: FunctionInfo[] = [];

const indexContent = readFileSync(join(DIST_DIR, TYPES_ENTRY), "utf-8");
const indexExports = new Set<string>();
for (const line of indexContent.split("\n")) {
  const trimmed = line.trim();
  let m = trimmed.match(/^export(?:\s+type)?\s*\{\s*([^}]+?)\s*\}/);
  if (m) {
    for (const part of m[1]!.split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]!
        .trim();
      if (name) indexExports.add(name);
    }
    continue;
  }
  m = trimmed.match(/^export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)/);
  if (m) indexExports.add(m[1]!);
}

function findMatchingBrace(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitMembers(body: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  let inString: string | null = null;
  let tplDepth = 0;
  const flush = () => {
    const piece = buf.trim();
    if (piece) out.push(piece);
    buf = "";
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      buf += ch;
      if (inString === "`" && ch === "}" && tplDepth > 0) tplDepth--;
      if (ch === inString && body[i - 1] !== "\\") inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      buf += ch;
      continue;
    }
    if (inString === null && ch === "$" && body[i + 1] === "{") {
      tplDepth++;
      buf += ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (ch === ";" && depth === 0) {
      flush();
    } else if (ch === "\n" && depth === 0) {
      flush();
    } else {
      buf += ch;
    }
  }
  flush();
  return out;
}

function isPublicMember(member: string): boolean {
  if (member.startsWith("#")) return false;
  if (/^private\s/.test(member)) return false;
  if (/^private\s+get\s+/.test(member)) return false;
  if (/^private\s+set\s+/.test(member)) return false;
  if (member === "#private;") return false;
  return true;
}

function classifyMember(member: string): "method" | "property" | "ctor" | "accessor" | "skip" {
  if (member === "#private;") return "skip";
  if (/^constructor\s*\(/.test(member)) return "ctor";
  if (/^(static\s+)?(?:get|set)\s+[\w$]+\s*\(/.test(member)) return "accessor";
  if (/^[\w$][\w$<>,\s.|&]*\s*[?:]/.test(member) && !member.includes("(")) return "property";
  if (/[()]/.test(member)) return "method";
  return "property";
}

function formatMember(member: string): string {
  return member
    .replace(/\s+/g, " ")
    .replace(/,\s*\}/g, " }")
    .replace(/\{\s+/g, "{ ")
    .replace(/\s+\}/g, " }")
    .trim();
}

const classRe = /(?:export\s+)?declare\s+class\s+(\w+)(?:\s+extends\s+([\w$.]+))?\s*\{/g;
const ifaceRe = /export\s+interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*\{/g;
const typeRe = /export\s+type\s+(\w+)\s*=\s*([^;]+);/g;
const funcRe = /export\s+declare\s+function\s+(\w+)(?:<[^>]+>)?\s*\(([^)]*)\)\s*:\s*([^;{]+);/g;

function processFile(file: string) {
  const src = readFileSync(join(DIST_DIR, file), "utf-8");

  let m: RegExpExecArray | null;
  const classRegex = new RegExp(classRe.source, "g");
  while ((m = classRegex.exec(src)) !== null) {
    const openBrace = src.indexOf("{", m.index);
    const closeBrace = findMatchingBrace(src, openBrace);
    if (closeBrace === -1) continue;
    const body = src.slice(openBrace + 1, closeBrace);
    const rawMembers = splitMembers(body);
    const members = rawMembers.filter(isPublicMember).map(formatMember);
    classes.push({ name: m[1]!, extends: m[2], members, source: file });
  }

  const ifaceRegex = new RegExp(ifaceRe.source, "g");
  while ((m = ifaceRegex.exec(src)) !== null) {
    const openBrace = src.indexOf("{", m.index);
    const closeBrace = findMatchingBrace(src, openBrace);
    if (closeBrace === -1) continue;
    const body = src.slice(openBrace + 1, closeBrace);
    const members = splitMembers(body).map(formatMember);
    interfaces.push({ name: m[1]!, members, source: file });
  }

  const typeRegex = new RegExp(typeRe.source, "g");
  while ((m = typeRegex.exec(src)) !== null) {
    typeAliases.push({ name: m[1]!, definition: m[2]!.trim().replace(/\s+/g, " "), source: file });
  }

  const funcRegex = new RegExp(funcRe.source, "g");
  while ((m = funcRegex.exec(src)) !== null) {
    functions.push({
      name: m[1]!,
      signature: `${m[1]}(${m[2]!.trim().replace(/\s+/g, " ")}): ${m[3]!.trim().replace(/\s+/g, " ")}`,
      source: file,
    });
  }
}

for (const f of dtsFiles) processFile(f);

const seenClass = new Set<string>();
const uniqueClasses = classes.filter((c) =>
  seenClass.has(c.name) ? false : (seenClass.add(c.name), true),
);
const seenIface = new Set<string>();
const uniqueInterfaces = interfaces.filter((i) =>
  seenIface.has(i.name) ? false : (seenIface.add(i.name), true),
);
const seenType = new Set<string>();
const uniqueTypes = typeAliases.filter((t) =>
  seenType.has(t.name) ? false : (seenType.add(t.name), true),
);
const seenFunc = new Set<string>();
const uniqueFuncs = functions.filter((f) =>
  seenFunc.has(f.name) ? false : (seenFunc.add(f.name), true),
);

function isPublicExport(name: string): boolean {
  if (indexExports.has(name)) return true;
  if (RUNTIME_TYPES.has(name)) return true;
  return false;
}

const RUNTIME_TYPES = new Set(["Page", "BrowserContext", "BunwrightError"]);

const exportedClasses = uniqueClasses.filter((c) => isPublicExport(c.name));
const exportedInterfaces = uniqueInterfaces.filter((i) => isPublicExport(i.name));
const exportedTypes = uniqueTypes.filter((t) => isPublicExport(t.name));
const exportedFuncs = uniqueFuncs.filter((f) => isPublicExport(f.name));

function groupMembers(members: string[]) {
  const ctors: string[] = [];
  const methods: string[] = [];
  const properties: string[] = [];
  const accessors: string[] = [];
  for (const mem of members) {
    const kind = classifyMember(mem);
    if (kind === "ctor") ctors.push(mem);
    else if (kind === "method") methods.push(mem);
    else if (kind === "accessor") accessors.push(mem);
    else if (kind === "property") properties.push(mem);
  }
  return { ctors, methods, properties, accessors };
}

function renderClass(cls: ClassInfo): string {
  const ext = cls.extends ? ` extends \`${cls.extends}\`` : "";
  const { ctors, methods, properties, accessors } = groupMembers(cls.members);
  let out = `### \`${cls.name}\`${ext}\n\n`;
  out += `_Declared in \`dist/${cls.source}\`_\n\n`;
  if (ctors.length) {
    out += `**Constructor**\n\n`;
    for (const c of ctors) out += `- \`${c}\`\n`;
    out += `\n`;
  }
  if (properties.length) {
    out += `**Properties**\n\n`;
    for (const p of properties) out += `- \`${p}\`\n`;
    out += `\n`;
  }
  if (accessors.length) {
    out += `**Accessors**\n\n`;
    for (const a of accessors) out += `- \`${a}\`\n`;
    out += `\n`;
  }
  if (methods.length) {
    out += `**Methods**\n\n`;
    for (const m of methods) out += `- \`${m}\`\n`;
    out += `\n`;
  }
  return out;
}

function renderInterface(iface: InterfaceInfo): string {
  const { methods, properties, accessors } = groupMembers(iface.members);
  let out = `### \`${iface.name}\`\n\n`;
  out += `_Declared in \`dist/${iface.source}\`_\n\n`;
  if (properties.length) {
    out += `**Properties**\n\n`;
    for (const p of properties) out += `- \`${p}\`\n`;
    out += `\n`;
  }
  if (accessors.length) {
    out += `**Accessors**\n\n`;
    for (const a of accessors) out += `- \`${a}\`\n`;
    out += `\n`;
  }
  if (methods.length) {
    out += `**Methods**\n\n`;
    for (const m of methods) out += `- \`${m}\`\n`;
    out += `\n`;
  }
  return out;
}

const today = new Date().toISOString().split("T")[0];

let md = `# Bunwright DSL API Reference\n\n`;
md += `_Auto-generated from \`dist/*.d.ts\` on ${today}. Do not edit by hand._\n\n`;
md += `Source declarations live under \`src/dsl/\`. Regenerate this document with \`bun run docs\`.\n\n`;

md += `## Overview\n\n`;
md += `Bunwright exposes a single \`browser\` instance plus class-based page automation.\n\n`;
md += `**Public Exports** (from \`src/dsl/index.ts\`):\n\n`;
md += `- Values: \`browser\`, \`defineConfig\`\n`;
md += `- Classes: \`Locator\`, \`ElementHandle\`, \`SelectorError\`, \`TimeoutError\`, \`ElementNotFoundError\`, \`BrowserError\`, \`BunwrightError\`\n`;
md += `- Types: \`BrowserConfig\`, \`ContextOptions\`, \`Selector\`, \`LoadState\`, \`ResolvedSelector\`\n\n`;

md += `## Table of Contents\n\n`;
if (exportedClasses.length) md += `- [Classes](#classes)\n`;
if (exportedInterfaces.length) md += `- [Interfaces](#interfaces)\n`;
if (exportedTypes.length) md += `- [Type Aliases](#type-aliases)\n`;
if (exportedFuncs.length) md += `- [Functions](#functions)\n`;
md += `\n`;

const sorted = <T extends { name: string }>(arr: T[]) =>
  arr.sort((a, b) => a.name.localeCompare(b.name));

if (exportedClasses.length) {
  md += `## Classes\n\n`;
  for (const cls of sorted(exportedClasses)) md += renderClass(cls);
}

if (exportedInterfaces.length) {
  md += `## Interfaces\n\n`;
  for (const iface of sorted(exportedInterfaces)) md += renderInterface(iface);
}

if (exportedTypes.length) {
  md += `## Type Aliases\n\n`;
  for (const t of sorted(exportedTypes)) {
    md += `### \`${t.name}\`\n\n`;
    md += `_Declared in \`dist/${t.source}\`_\n\n`;
    md += `\`\`\`typescript\n${t.definition}\n\`\`\`\n\n`;
  }
}

if (exportedFuncs.length) {
  md += `## Functions\n\n`;
  for (const f of sorted(exportedFuncs)) {
    md += `### \`${f.name}\`\n\n`;
    md += `_Declared in \`dist/${f.source}\`_\n\n`;
    md += `\`\`\`typescript\n${f.signature}\n\`\`\`\n\n`;
  }
}

mkdirSync("./docs", { recursive: true });
writeFileSync(OUTPUT_FILE, md, "utf-8");
console.log(`Generated ${OUTPUT_FILE}`);
console.log(
  `  - ${exportedClasses.length} classes, ${exportedInterfaces.length} interfaces, ${exportedTypes.length} types, ${exportedFuncs.length} functions`,
);
