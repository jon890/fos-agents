import { z } from 'zod';
import { ApplicationStatusSchema, RequiredUserActionSchema } from './ledger_schema';

export const AgentDecisionSchema = z.object({
  applicationId: z.string().min(1),
  fromStatus: ApplicationStatusSchema,
  fromAgentPhase: z.string().optional(),
  decision: z.string().min(1),
  decisionReason: z.string().min(1),
  confidence: z.number().min(0).max(1),
  nextStatus: ApplicationStatusSchema,
  nextAgentPhase: z.string().optional(),
  nextActions: z.array(z.string().min(1)),
  requiredUserAction: RequiredUserActionSchema,
  allowed: z.boolean(),
  createdAt: z.string().min(1),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;
