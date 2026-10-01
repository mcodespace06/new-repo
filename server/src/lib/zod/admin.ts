import { z } from 'zod';
import { ComplaintStatus, Priority, Outcome } from '@prisma/client';

export const UpdateCaseStatusSchema = z.object({
  status: z.nativeEnum(ComplaintStatus).optional(),
  reason: z.string().optional(),
  assignedTo: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
});

export const InternalNoteSchema = z.object({
  body: z.string().min(1, 'Note content cannot be empty').max(2000, 'Note cannot exceed 2000 characters'),
});

export const RecordOutcomeSchema = z.object({
  outcome: z.nativeEnum(Outcome),
  outcomeReason: z.string().min(5, 'Please provide an outcome rationale of at least 5 characters'),
});

export const SendMessageSchema = z.object({
  body: z.string().min(1, 'Message body cannot be empty').max(3000, 'Message cannot exceed 3000 characters'),
  requestInfo: z.boolean().optional(),
});
