import { Body, Controller, Get, HttpCode, Param, Put, Query } from "@nestjs/common";

import { toContractError, ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { StudyService } from "./study.service.js";
import { cursorModeSchema, sourceKeySchema, studySourcePutSchema, type StudyCursorResult, type StudySourcePut, type StudySourceUpsertResponse } from "./schema.js";

@Controller("api/study/v1")
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Get("sources")
  listSources() {
    return this.study.listSources();
  }

  @Put("sources/:sourceKey")
  @HttpCode(200)
  upsertSource(
    @Param("sourceKey") sourceKey: string,
    @Body(new ZodValidationPipe(studySourcePutSchema)) body: StudySourcePut,
  ): Promise<StudySourceUpsertResponse> {
    return this.study.upsertSource(this.sourceKey(sourceKey), body);
  }

  @Get("sources/:sourceKey/cursor")
  getCursor(
    @Param("sourceKey") sourceKey: string,
    @Query("mode") mode: string,
  ): Promise<StudyCursorResult> {
    try {
      return this.study.getCursor(this.sourceKey(sourceKey), cursorModeSchema.parse(mode));
    } catch (error) {
      return toContractError(error);
    }
  }

  private sourceKey(value: string): string {
    try {
      return sourceKeySchema.parse(value);
    } catch (error) {
      return toContractError(error);
    }
  }
}
