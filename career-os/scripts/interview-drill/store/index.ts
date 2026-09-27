import { dirname, join } from "node:path";
import { resolveCareerBackendConnection } from "../../lib/career-backend-config.ts";
import type { InterviewPracticeStore } from "./port.ts";
import { InterviewBackendClient } from "../career-backend/client.ts";
import { BackendInterviewPracticeStore } from "./backend-store.ts";
import { FileInterviewPracticeStore } from "./file-store.ts";

function careerOsRoot(): string {
  return join(dirname(import.meta.path), "..", "..", "..");
}

export function createInterviewPracticeStore(
  environment: Record<string, string | undefined> = process.env,
  careerOsDirectory = careerOsRoot(),
): InterviewPracticeStore {
  if (environment.CAREER_STORE === "backend") {
    return new BackendInterviewPracticeStore(
      new InterviewBackendClient(resolveCareerBackendConnection(environment)),
    );
  }
  if (environment.CAREER_STORE === "file") {
    return new FileInterviewPracticeStore(
      environment.CAREER_STORE_DIR?.trim() ||
        join(careerOsDirectory, "state", "interview-practice"),
    );
  }
  throw new Error(
    "CAREER_STORE 는 backend 나 file 이어야 한다. drill-engine.ts doctor 로 설정을 점검한다.",
  );
}
