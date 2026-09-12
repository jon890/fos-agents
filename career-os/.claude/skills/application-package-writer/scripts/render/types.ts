import type { TABS } from "./constants.ts";

export type MarkdownSection = {
  title: string;
  body: string;
};

/** 모델이 적지 않았으면 그 자리는 `null` 이다. 화면은 그 배지를 그리지 않는다. */
export type PackageStatus = {
  readiness: "ready" | "needs_user_input" | "revise" | "do_not_apply" | null;
  evidence: "safe" | "revise" | "blocked" | null;
  humanConfirmation: "complete" | "needs_input" | null;
};

export type RenderAssets = {
  resumePdf?: boolean;
  careerDescriptionPdf?: boolean;
  submissionPdf?: boolean;
  submissionReady?: boolean;
  submissionBlockers?: string[];
};

export type FitColor = "excellent" | "good" | "fair" | "none";

export type TabKey = (typeof TABS)[number]["key"];
