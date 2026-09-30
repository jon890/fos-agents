import { Module } from "@nestjs/common";

import { CandidateContextModule } from "../candidate-context/candidate-context.module.js";
import { StudyController } from "./study.controller.js";
import { StudyRepository } from "./repository/study.repository.js";
import { StudyService } from "./study.service.js";

@Module({
  imports: [CandidateContextModule],
  controllers: [StudyController],
  providers: [StudyRepository, StudyService],
})
export class StudyModule {}
