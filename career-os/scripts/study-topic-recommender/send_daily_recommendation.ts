#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { notifyDiscord } from "../../../_shared/lib/notify_discord.ts";

type StudyRecommendation = {
  key?: string;
  title?: string;
  domain?: string;
  whyNow?: string[];
};

type TopicInventory = {
  generatedAt?: string;
  recommendations?: StudyRecommendation[];
  updateExistingRecommendations?: Array<{ key?: string; candidatePath?: string }>;
};

type PresentationButton = {
  label: string;
  action: { type: "callback"; value: string };
  style?: "primary" | "secondary" | "success" | "danger";
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");
const envFile = resolve(rootDir, ".env");
const runtimeDir = resolve(rootDir, "data/runtime");
const inventoryPath = resolve(runtimeDir, "topic-inventory.json");
const markdownPath = resolve(runtimeDir, "morning-topic-recommendation.md");
const actionDir = resolve(runtimeDir, "study-topic-actions");

function loadEnvFileIfPresent(path: string): void {
  if (!existsSync(path)) return;
  loadDotenv({ path, override: false, quiet: true });
}

function kstParts(date = new Date()): { date: string; short: string } {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateText = formatter.format(date);
  const [, month, day] = dateText.match(/\d{4}-(\d{2})-(\d{2})/) ?? [];
  return {
    date: dateText,
    short: `${Number(month)}/${Number(day)}`,
  };
}

function titleOf(item: StudyRecommendation): string {
  return item.title || item.key || "(untitled)";
}

function reasonOf(item: StudyRecommendation): string {
  return item.whyNow?.[0] || "오늘 학습 흐름에 맞는 후보";
}

function humanizeKey(key: string): string {
  return key.replace(/-/g, " ");
}

async function refreshInventory(): Promise<void> {
  const proc = Bun.spawn([
    "bun",
    "--env-file=.env",
    "scripts/study-topic-recommender/refresh_topic_inventory.ts",
  ], {
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stderr).text(),
  ]);
  if (exitCode !== 0) {
    const detail = stderr.trim().split(/\r?\n/).slice(0, 3).join("\n");
    throw new Error(detail || `refresh_topic_inventory exit ${exitCode}`);
  }
}

function readInventory(): TopicInventory {
  return JSON.parse(readFileSync(inventoryPath, "utf8")) as TopicInventory;
}

function buildMessage(inventory: TopicInventory, today = kstParts()): string {
  const items = inventory.recommendations?.slice(0, 3) ?? [];
  const domains = [...new Set(items.map((item) => item.domain).filter(Boolean))];
  const avoided = (inventory.updateExistingRecommendations ?? [])
    .slice(0, 4)
    .map((item) => item.key || item.candidatePath || "")
    .filter(Boolean)
    .map(humanizeKey);

  const lines: string[] = [
    `오늘의 백엔드 학습 추천 (${today.short})`,
    "CJ Foodville 1차 면접(6/15) 대비 — 커머스 백엔드의 운영·정합성 축에 맞춰 골랐어요.",
    "",
    "오늘의 백엔드 3선",
  ];

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${titleOf(item)} — ${reasonOf(item)}`);
  });

  lines.push("", "왜 이 셋인가");
  if (domains.length > 0) {
    lines.push(`- ${domains.join(", ")} 축을 묶어서 운영 환경에서 생기는 장애 전파, 정합성, 관찰성 질문에 답하기 좋음.`);
  }
  lines.push("- 최근 추천 history와 기존 fos-study 중복을 피하면서, 바로 study-pack 초안으로 만들 수 있는 후보를 우선함.");

  lines.push("", "일부러 피한 축");
  lines.push("- generic DB 튜닝은 active weak area로 취급하지 않음.");
  if (avoided.length > 0) {
    lines.push(`- 기존 문서와 겹치는 후보: ${avoided.join(", ")}`);
  }

  lines.push("", `리포트: \`${markdownPath}\``);
  return lines.join("\n");
}

function buildPresentation(inventory: TopicInventory, today = kstParts()) {
  const buttons: PresentationButton[] = (inventory.recommendations ?? [])
    .slice(0, 3)
    .map((item, index) => ({
      label: `${index + 1}번 초안 생성`,
      action: {
        type: "callback",
        value: `career.study-pack.create:${today.date}:${index + 1}:${item.key ?? ""}`,
      },
      style: "primary",
    }));

  buttons.push({
    label: "오늘은 넘김",
    action: {
      type: "callback",
      value: `career.study-pack.skip:${today.date}`,
    },
    style: "secondary",
  });

  return {
    title: `오늘의 백엔드 학습 추천 (${today.short})`,
    tone: "info",
    blocks: [
      {
        type: "context",
        text: "버튼은 초안 생성 요청만 수행한다. 최종화는 별도 확인한다.",
      },
      {
        type: "buttons",
        buttons,
      },
    ],
  };
}

function writeActionSnapshot(inventory: TopicInventory, today = kstParts()): void {
  mkdirSync(actionDir, { recursive: true });
  const recommendations = (inventory.recommendations ?? []).slice(0, 3).map((item, index) => ({
    index: index + 1,
    key: item.key,
    title: item.title,
    action: `career.study-pack.create:${today.date}:${index + 1}:${item.key ?? ""}`,
  }));
  const snapshot = {
    date: today.date,
    generatedAt: new Date().toISOString(),
    markdownPath,
    recommendations,
    skipAction: `career.study-pack.skip:${today.date}`,
  };
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  writeFileSync(resolve(actionDir, `${today.date}.json`), json);
  writeFileSync(resolve(actionDir, "latest.json"), json);
}

async function main(): Promise<void> {
  loadEnvFileIfPresent(envFile);
  await refreshInventory();
  const inventory = readInventory();
  const today = kstParts();
  writeActionSnapshot(inventory, today);
  await notifyDiscord(buildMessage(inventory, today), {
    presentation: buildPresentation(inventory, today),
  });
}

try {
  await main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[send_daily_recommendation] ${message}`);
  process.exit(1);
}
