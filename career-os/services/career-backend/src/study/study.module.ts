import { Module } from "@nestjs/common";

import { StudyController } from "./study.controller.js";
import { StudyRepository } from "./repository/study.repository.js";
import { StudyService } from "./study.service.js";

@Module({
  controllers: [StudyController],
  providers: [StudyRepository, StudyService],
})
export class StudyModule {}
