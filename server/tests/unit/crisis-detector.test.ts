import { describe, it, expect } from 'vitest';
import { detectCrisis, CAMPUS_CRISIS_CONTACTS } from '../../src/services/ai/crisis';

describe('Crisis and Self-Harm Language Detector (AI Safety & Triage)', () => {
  it('detects explicit suicidal intent and returns emergency contacts', () => {
    const input = 'I feel so hopeless and I want to kill myself tonight';
    const result = detectCrisis(input);

    expect(result.isCrisis).toBe(true);
    expect(result.reason).toContain('Suicidal');
    expect(result.emergencyContacts).toEqual(CAMPUS_CRISIS_CONTACTS);
    expect(result.supportMessage).toBeDefined();
    expect(result.emergencyContacts.some((c) => c.number === '112')).toBe(true);
  });

  it('detects explicit self-harm statements', () => {
    const input = 'I am thinking about slitting my wrist because of the harassment';
    const result = detectCrisis(input);

    expect(result.isCrisis).toBe(true);
    expect(result.reason).toContain('self-harm');
  });

  it('detects immediate active assault / physical danger', () => {
    const input = 'Help me please urgent someone is attacking me outside the library';
    const result = detectCrisis(input);

    expect(result.isCrisis).toBe(true);
    expect(result.reason).toContain('physical danger');
  });

  it('passes regular policy and campus rule queries without flagging crisis', () => {
    const benignQueries = [
      'What is the penalty for ragging in the hostel?',
      'Can students enter campus after 10 PM on weekends?',
      'How do I report broken lab equipment?',
      'Is attendance mandatory for internal exams?',
      'Where is the student grievance committee office located?',
    ];

    for (const query of benignQueries) {
      const result = detectCrisis(query);
      expect(result.isCrisis).toBe(false);
      expect(result.reason).toBeUndefined();
    }
  });

  it('handles empty, null, or whitespace-only inputs safely', () => {
    expect(detectCrisis('').isCrisis).toBe(false);
    expect(detectCrisis('   ').isCrisis).toBe(false);
    // @ts-expect-error test non-string
    expect(detectCrisis(null).isCrisis).toBe(false);
  });
});
