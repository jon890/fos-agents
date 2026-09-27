import { Module } from "@nestjs/common";

import { PositionsController } from "./positions.controller.js";
import { PositionsService } from "./positions.service.js";
import { PositionsRepository } from "./repository/positions.repository.js";

@Module({
  controllers: [PositionsController],
  providers: [PositionsRepository, PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {}
