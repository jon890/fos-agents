#!/usr/bin/env bun
import { randomUUID } from "node:crypto";
import { firstOptionValue } from "../lib/cli.ts";
import { createStudyLibraryClient } from "./study-library/client.js";
export async function configureStudyRecommendation(args = process.argv.slice(2)) { const version = firstOptionValue(args, "--candidate-context-version"); if (!version?.trim()) throw new Error("--candidate-context-version 값이 필요하다."); return createStudyLibraryClient().updateRecommendationControl(version, `control:${randomUUID()}`); }
if (import.meta.main) configureStudyRecommendation().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
