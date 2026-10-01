import { ComplaintStatus } from '@prisma/client';

export const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  [ComplaintStatus.SUBMITTED]: [ComplaintStatus.FLAGGED_REVIEW, ComplaintStatus.TRIAGED],
  [ComplaintStatus.FLAGGED_REVIEW]: [ComplaintStatus.TRIAGED, ComplaintStatus.REJECTED],
  [ComplaintStatus.TRIAGED]: [ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS, ComplaintStatus.REJECTED],
  [ComplaintStatus.ASSIGNED]: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.REJECTED],
  [ComplaintStatus.IN_PROGRESS]: [
    ComplaintStatus.NEEDS_INFO,
    ComplaintStatus.ESCALATED,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.REJECTED,
  ],
  [ComplaintStatus.NEEDS_INFO]: [
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.REJECTED,
  ],
  [ComplaintStatus.ESCALATED]: [
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.REJECTED,
  ],
  [ComplaintStatus.RESOLVED]: [ComplaintStatus.REOPENED, ComplaintStatus.CLOSED],
  [ComplaintStatus.REOPENED]: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED],
  [ComplaintStatus.REJECTED]: [],
  [ComplaintStatus.CLOSED]: [],
};

const STATES_REQUIRING_REASON = [
  ComplaintStatus.REJECTED,
  ComplaintStatus.RESOLVED,
  ComplaintStatus.ESCALATED,
];

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
}

export function validateStateTransition(
  current: ComplaintStatus,
  target: ComplaintStatus,
  reason?: string
): TransitionValidationResult {
  const allowed = ALLOWED_TRANSITIONS[current] || [];

  if (!allowed.includes(target)) {
    return {
      valid: false,
      error: `Invalid status transition from '${current}' to '${target}'. Allowed transitions: [${allowed.join(', ')}].`,
    };
  }

  if (STATES_REQUIRING_REASON.includes(target) && (!reason || reason.trim().length === 0)) {
    return {
      valid: false,
      error: `A mandatory reason must be provided when transitioning to status '${target}'.`,
    };
  }

  return { valid: true };
}
