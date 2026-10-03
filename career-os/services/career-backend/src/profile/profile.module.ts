import { Module } from "@nestjs/common";

import { ProfileController } from "./profile.controller.js";
import { ProfileClock, ProfileService } from "./profile.service.js";
import { ProfileDocumentRepository } from "./repository/profile-document.repository.js";
import { UsageSnapshotRepository } from "./repository/usage-snapshot.repository.js";

@Module({
  controllers: [ProfileController],
  providers: [ProfileDocumentRepository, UsageSnapshotRepository, ProfileClock, ProfileService],
})
export class ProfileModule {}
