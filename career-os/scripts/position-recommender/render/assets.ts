import { readFileSync } from "node:fs";
import type { RenderAssets } from "./template.ts";

const directory = new URL("./templates/", import.meta.url);

export function loadRenderAssets(kind: "report" | "preview"): RenderAssets {
  const templates = readTemplateParts(
    readFileSync(new URL(`${kind}-parts.html`, directory), "utf8"),
  );
  templates[kind] = readFileSync(new URL(`${kind}.html`, directory), "utf8");
  return {
    templates,
    css: readFileSync(new URL(`${kind}.css`, directory), "utf8"),
    script: kind === "preview" ? readFileSync(new URL("preview.js", directory), "utf8") : "",
  };
}

/** 표준 HTML template 요소를 이름별로 읽는다. 반복과 조건은 TypeScript가 담당한다. */
export function readTemplateParts(source: string): Record<string, string> {
  const templates: Record<string, string> = Object.create(null);
  const remainder = source.replace(
    /<!--[\s\S]*?-->|<template\s+id="([\w-]+)"\s*>([\s\S]*?)<\/template\s*>/g,
    (_match, name: string | undefined, body: string) => {
      if (name === undefined) return "";
      if (Object.hasOwn(templates, name)) throw new Error(`Duplicate template: ${name}`);
      templates[name] = body;
      return "";
    },
  );
  if (remainder.trim()) throw new Error("Invalid template parts: expected named template elements");
  return templates;
}
