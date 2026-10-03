import { Module } from "@nestjs/common";

import { CandidateContextModule } from "../candidate-context/candidate-context.module.js";
import { PositionsController } from "./positions.controller.js";
import { PositionsService } from "./positions.service.js";
import { PositionsRepository } from "./repository/positions.repository.js";

@Module({
  imports: [CandidateContextModule],
  controllers: [PositionsController],
  providers: [PositionsRepository, PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {}
