import { Module } from "@nestjs/common";

import { ProfileController } from "./profile.controller.js";
import { ProfileService } from "./profile.service.js";
import { ProfileDocumentRepository } from "./repository/profile-document.repository.js";

@Module({
  controllers: [ProfileController],
  providers: [ProfileDocumentRepository, ProfileService],
})
export class ProfileModule {}
