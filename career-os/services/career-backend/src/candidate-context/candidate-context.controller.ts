import { Body, Controller, Get, HttpCode, Param, Put } from "@nestjs/common";

import { toContractError, ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { CandidateContextService } from "./candidate-context.service.js";
import {
  candidateContextDocumentKeySchema,
  candidateContextDocumentPutSchema,
  type CandidateContextDocument,
  type CandidateContextDocumentKey,
  type CandidateContextDocumentPut,
  type CandidateContextDocumentPutResponse,
  type CandidateContextDocumentSummary,
} from "./schema.js";

@Controller("api/candidate-context/v1")
export class CandidateContextController {
  constructor(private readonly candidateContext: CandidateContextService) {}

  @Get("documents")
  listDocuments(): Promise<{ documents: CandidateContextDocumentSummary[] }> {
    return this.candidateContext.listDocuments();
  }

  @Get("documents/:documentKey")
  getDocument(@Param("documentKey") documentKey: string): Promise<{ document: CandidateContextDocument }> {
    return this.candidateContext.getDocument(this.documentKey(documentKey));
  }

  @Put("documents/:documentKey")
  @HttpCode(200)
  putDocument(
    @Param("documentKey") documentKey: string,
    @Body(new ZodValidationPipe(candidateContextDocumentPutSchema)) body: CandidateContextDocumentPut,
  ): Promise<CandidateContextDocumentPutResponse> {
    return this.candidateContext.putDocument(this.documentKey(documentKey), body);
  }

  private documentKey(value: string): CandidateContextDocumentKey {
    try {
      return candidateContextDocumentKeySchema.parse(value);
    } catch (error) {
      return toContractError(error);
    }
  }
}
