import { z } from 'zod';
import { ComplaintMode, TargetEntityType } from '@prisma/client';

export const CreateComplaintSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  description: z
    .string()
    .min(20, 'Please provide sufficient detail (minimum 20 characters) so the committee can investigate.')
    .max(4000, 'Description cannot exceed 4000 characters'),
  categoryId: z.string().min(1, 'Please select a valid complaint category'),
  locationId: z.string().min(1, 'Please select the incident location on campus'),
  incidentAt: z.string().or(z.date()).transform((val) => new Date(val)),
  mode: z.nativeEnum(ComplaintMode).default(ComplaintMode.CONFIDENTIAL),
  targetEntityType: z.nativeEnum(TargetEntityType).optional(),
  targetEntityLabel: z.string().max(100).optional(),
  attachments: z
    .array(
      z.object({
        fileKey: z.string(),
        mime: z.string(),
        size: z.number().max(5 * 1024 * 1024, 'File exceeds 5MB limit'),
      })
    )
    .optional(),
});

export const TrackingKeyParamSchema = z.object({
  key: z.string().min(1, 'Tracking key is required'),
});
