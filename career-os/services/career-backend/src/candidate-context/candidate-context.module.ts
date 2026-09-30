import { Module } from "@nestjs/common";

import { CandidateContextController } from "./candidate-context.controller.js";
import { CandidateContextService } from "./candidate-context.service.js";
import { CandidateContextRepository } from "./repository/candidate-context.repository.js";

@Module({
  controllers: [CandidateContextController],
  providers: [CandidateContextRepository, CandidateContextService],
  exports: [CandidateContextRepository, CandidateContextService],
})
export class CandidateContextModule {}
