import { vaultPrisma } from '../../lib/prisma';
import { encryptUserId, decryptUserId } from './crypto';

/**
 * ONLY module allowed to access the vault schema (ARCHITECTURE.md §5)
 */
export const vaultService = {
  /**
   * Links a complaint to a reporter in the vault schema.
   * STRICT: NEVER called for ULTRA_ANONYMOUS complaints.
   */
  async linkReporter(complaintId: string, userId: string): Promise<void> {
    const encUserId = encryptUserId(userId);

    await vaultPrisma.$transaction([
      vaultPrisma.reporterLink.create({
        data: {
          complaintId,
          encUserId,
        },
      }),
      vaultPrisma.reporterScore.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          score: 60, // PRD §7 initial score baseline
          tier: 'Normal',
        },
      }),
    ]);
  },

  /**
   * Resolves all complaint IDs linked to a specific authenticated user.
   * Decrypts vault links and matches against userId.
   */
  async listComplaintsForUser(userId: string): Promise<string[]> {
    const links = await vaultPrisma.reporterLink.findMany();
    const matchedComplaintIds: string[] = [];

    for (const link of links) {
      try {
        const decryptedUser = decryptUserId(link.encUserId);
        if (decryptedUser === userId) {
          matchedComplaintIds.push(link.complaintId);
        }
      } catch {
        // Corrupted or mismatched vault entry skipped safely
      }
    }

    return matchedComplaintIds;
  },

  /**
   * Internal lookup to resolve reporter userId for an admin-confirmed outcome.
   * Never exposed to admin UI directly.
   */
  async resolveUserForComplaint(complaintId: string): Promise<string | null> {
    const link = await vaultPrisma.reporterLink.findUnique({
      where: { complaintId },
    });

    if (!link) return null;

    try {
      return decryptUserId(link.encUserId);
    } catch {
      return null;
    }
  },

  /**
   * Retrieves user trust tier (for confidential complaints triage)
   */
  async getUserTrustTier(userId: string): Promise<string> {
    const record = await vaultPrisma.reporterScore.findUnique({
      where: { userId },
    });
    return record?.tier || 'Normal';
  },
};
