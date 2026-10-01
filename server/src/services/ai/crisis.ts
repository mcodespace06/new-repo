export interface EmergencyContact {
  name: string;
  number: string;
  description: string;
  tollFree: boolean;
}

export const CAMPUS_CRISIS_CONTACTS: EmergencyContact[] = [
  {
    name: 'National Emergency Service (Police/Ambulance)',
    number: '112',
    description: 'Immediate police, ambulance, and disaster response nationwide.',
    tollFree: true,
  },
  {
    name: 'Campus Security Control Room',
    number: '+919876543210',
    description: '24/7 on-campus rapid response team and medical emergency escort.',
    tollFree: false,
  },
  {
    name: 'Tele-MANAS (National Mental Health Helpline)',
    number: '14416',
    description: 'Free, confidential, 24/7 professional psychological counseling.',
    tollFree: true,
  },
  {
    name: 'AASRA Suicide Prevention Helpline',
    number: '+919820466726',
    description: '24/7 volunteer crisis support and emotional distress helpline.',
    tollFree: false,
  },
  {
    name: 'Vandrevala Foundation for Mental Health',
    number: '+919999666555',
    description: '24/7 crisis intervention, depression, and trauma support.',
    tollFree: false,
  },
];

const CRISIS_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  {
    regex: /\b(kill(ing)?\s+myself|end(ing)?\s+my\s+life|want\s+to\s+die|commit(ting)?\s+suicide|take\s+my\s+(own\s+)?life)\b/i,
    reason: 'Suicidal ideation or intent',
  },
  {
    regex: /\b(slit(ting)?\s+my\s+wrist|overdose|hang(ing)?\s+myself|jump(ing)?\s+off\s+(a\s+)?(roof|building|bridge)|self[-\s]?harm)\b/i,
    reason: 'Explicit self-harm statement',
  },
  {
    regex: /\b(he\s+is\s+hitting\s+me|someone\s+is\s+attacking\s+me|breaking\s+in|help\s+me\s+please\s+urgent|gun|knife|hostage)\b/i,
    reason: 'Immediate physical danger or active assault',
  },
  {
    regex: /\b(i\s+can['’]?t\s+take\s+it\s+anymore.*better\s+off\s+dead|no\s+reason\s+to\s+live)\b/i,
    reason: 'Severe acute psychological distress',
  },
];

export interface CrisisDetectionResult {
  isCrisis: boolean;
  reason?: string;
  emergencyContacts: EmergencyContact[];
  supportMessage?: string;
}

/**
 * Evaluates input text for crisis, self-harm, or active life-threatening indicators.
 * If detected, returns immediate emergency assistance resources.
 */
export function detectCrisis(text: string): CrisisDetectionResult {
  if (!text || typeof text !== 'string') {
    return {
      isCrisis: false,
      emergencyContacts: CAMPUS_CRISIS_CONTACTS,
    };
  }

  const cleanText = text.trim();

  for (const { regex, reason } of CRISIS_PATTERNS) {
    if (regex.test(cleanText)) {
      return {
        isCrisis: true,
        reason,
        emergencyContacts: CAMPUS_CRISIS_CONTACTS,
        supportMessage:
          'If you or someone you know is in immediate danger or going through extreme emotional distress, please reach out for help right now. You are not alone and support is available 24/7.',
      };
    }
  }

  return {
    isCrisis: false,
    emergencyContacts: CAMPUS_CRISIS_CONTACTS,
  };
}
