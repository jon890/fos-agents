import { textAsset } from "../../lib/text-asset.ts";
import reportPartsSource from "./templates/report-parts.html" with { type: "text" };
import reportSource from "./templates/report.html" with { type: "text" };
import reportCss from "./templates/report.css" with { type: "text" };
import type { RenderAssets } from "./template.ts";

// 템플릿을 텍스트 import 로 읽어 번들한 실행기에서도 파일 위치와 무관하게 같은 자산을 쓴다.
export function loadRenderAssets(): RenderAssets {
  const templates = readTemplateParts(textAsset(reportPartsSource, "report-parts.html"));
  templates.report = textAsset(reportSource, "report.html");
  return {
    templates,
    css: textAsset(reportCss, "report.css"),
    script: "",
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
