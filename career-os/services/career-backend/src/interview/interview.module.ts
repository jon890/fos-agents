import { Module } from "@nestjs/common";

import { InterviewController } from "./interview.controller.js";
import { InterviewService, InterviewClock } from "./interview.service.js";
import { InterviewRepository } from "./repository/interview.repository.js";

@Module({
  controllers: [InterviewController],
  providers: [InterviewClock, InterviewRepository, InterviewService],
})
export class InterviewModule {}
