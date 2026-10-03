import { Body, Controller, Get, HttpCode, Param, Put } from "@nestjs/common";

import { toContractError, ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ApiError } from "../common/api-error.js";
import { ProfileService } from "./profile.service.js";
import {
  profileDocumentKeySchema,
  profileDocumentPutSchema,
  usageSnapshotPutSchema,
  type ProfileDocument,
  type ProfileDocumentKey,
  type ProfileDocumentPut,
  type ProfileDocumentPutResponse,
  type ProfileDocumentSummary,
  type UsageSnapshot,
  type UsageSnapshotPut,
  type UsageSnapshotPutResponse,
} from "./schema.js";
import { usageMonthPattern } from "./usage-month.js";

@Controller("api/profile/v1")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get("documents")
  listDocuments(): Promise<{ documents: ProfileDocumentSummary[] }> {
    return this.profile.listDocuments();
  }

  @Get("documents/:documentKey")
  getDocument(@Param("documentKey") documentKey: string): Promise<{ document: ProfileDocument }> {
    return this.profile.getDocument(this.documentKey(documentKey));
  }

  @Put("documents/:documentKey")
  @HttpCode(200)
  putDocument(
    @Param("documentKey") documentKey: string,
    @Body(new ZodValidationPipe(profileDocumentPutSchema)) body: ProfileDocumentPut,
  ): Promise<ProfileDocumentPutResponse> {
    return this.profile.putDocument(this.documentKey(documentKey), body);
  }

  @Get("usage-snapshots")
  listUsageSnapshots(): Promise<{ snapshots: UsageSnapshot[] }> {
    return this.profile.listUsageSnapshots();
  }

  @Put("usage-snapshots/:month")
  @HttpCode(200)
  putUsageSnapshot(
    @Param("month") month: string,
    @Body(new ZodValidationPipe(usageSnapshotPutSchema)) body: UsageSnapshotPut,
  ): Promise<UsageSnapshotPutResponse> {
    if (!usageMonthPattern.test(month)) {
      throw new ApiError(400, "BAD_REQUEST", "month 는 YYYY-MM 형식이어야 합니다.");
    }
    return this.profile.putUsageSnapshot(month, body);
  }

  private documentKey(value: string): ProfileDocumentKey {
    try {
      return profileDocumentKeySchema.parse(value);
    } catch (error) {
      return toContractError(error);
    }
  }
}
