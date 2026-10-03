import { Body, Controller, Get, HttpCode, Param, Put } from "@nestjs/common";

import { toContractError, ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ProfileService } from "./profile.service.js";
import {
  profileDocumentKeySchema,
  profileDocumentPutSchema,
  type ProfileDocument,
  type ProfileDocumentKey,
  type ProfileDocumentPut,
  type ProfileDocumentPutResponse,
  type ProfileDocumentSummary,
} from "./schema.js";

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

  private documentKey(value: string): ProfileDocumentKey {
    try {
      return profileDocumentKeySchema.parse(value);
    } catch (error) {
      return toContractError(error);
    }
  }
}
