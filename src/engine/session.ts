// LAYAN session state machine.
//
// One engagement = one scammer conversation. The session owns the transcript,
// the harvested indicators, and the running "scammer minutes burned" counter.
//
// The jammer's reply comes from the AI layer (on-device model, cloud fallback,
// or a deterministic script). This file only orchestrates.

import {
  ARCHETYPES,
  PERSONA,
  SCAMMER_REACTIONS,
  SCRIPTED_REPLIES,
  type ArchetypeSpec,
  type Intent,
} from './archetypes';
import { extract, type Ioc } from './extractor';

export type Who = 'scammer' | 'jammer' | 'system';

export interface Message {
  who: Who;
  text: string;
  turn: number;
  tMin: number;
  /** Where the reply came from: on-device model, cloud model, or script. */
  source?: string;
}

export interface SessionSnapshot {
  id: string;
  archetype: string;
  label: string;
  fingerprint: string;
  turn: number;
  minutes: number;
  status: 'active' | 'ended';
  transcript: Message[];
  iocs: Ioc[];
}

export interface StepResult {
  done: boolean;
  exchange: Message[];
  iocsNew: Ioc[];
  turn: number;
  minutes: number;
  status: 'active' | 'ended';
}

/** Deterministic PRNG (mulberry32) so a seeded session replays identically. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Session {
  readonly id: string;
  readonly archetype: string;
  readonly spec: ArchetypeSpec;
  readonly seed: number;

  private rng: () => number;
  private stepIdx = 0;
  private loopCount = 0;
  private turnCount = 0;
  private minutes = 0;
  private transcript: Message[] = [];
  private iocs: Ioc[] = [];
  private seen = new Set<string>();
  private status: 'active' | 'ended' = 'active';

  constructor(id: string, archetype: string, seed?: number) {
    const spec = ARCHETYPES[archetype];
    if (!spec) throw new Error(`unknown archetype ${archetype}`);
    this.id = id;
    this.archetype = archetype;
    this.spec = spec;
    this.seed = seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rng = makeRng(this.seed);
  }

  private add(who: Who, text: string, mins = 0, source?: string) {
    this.minutes += mins;
    this.transcript.push({
      who,
      text,
      turn: this.turnCount,
      tMin: Math.round(this.minutes),
      source,
    });
  }

  private harvest(text: string) {
    for (const ioc of extract(text)) {
      const key = `${ioc.type}|${ioc.value}`;
      if (!this.seen.has(key)) {
        this.seen.add(key);
        this.iocs.push(ioc);
      }
    }
  }

  /** The intent the scammer is currently working through. */
  get intent(): Intent {
    return this.spec.steps[this.stepIdx][0];
  }

  /**
   * Advance one exchange: scammer line, then the jammer's reply.
   * `replyFor` produces the jammer's line; it receives the intent and the
   * scammer's most recent message.
   */
  async step(replyFor: (intent: Intent, scammerLine: string) => Promise<{
    text: string;
    source: string;
    minutes: number;
  }>): Promise<StepResult> {
    if (this.status === 'ended') {
      return {
        done: true,
        exchange: this.transcript.slice(-2),
        iocsNew: [],
        turn: this.turnCount,
        minutes: Math.round(this.minutes),
        status: this.status,
      };
    }

    this.turnCount += 1;
    const before = this.iocs.length;

    const [intent, variants] = this.spec.steps[this.stepIdx];
    const scammerLine = variants[Math.min(this.loopCount, variants.length - 1)];
    this.add('scammer', scammerLine);
    this.harvest(scammerLine);

    const reply = await replyFor(intent, scammerLine);
    this.add('jammer', reply.text, reply.minutes, reply.source);

    // The scammer reacts when Puan Rina threatens to involve her family.
    if (reply.text.includes('grandson') && intent === 'escalate') {
      this.add('scammer', SCAMMER_REACTIONS.grandkid);
      this.harvest(SCAMMER_REACTIONS.grandkid);
      this.minutes += 4;
    }

    this.loopCount += 1;
    if (this.loopCount >= 2) {
      this.loopCount = 0;
      this.stepIdx += 1;
    }

    if (this.stepIdx >= this.spec.steps.length) {
      this.add('scammer', this.spec.exit);
      this.status = 'ended';
    }

    return {
      done: this.status === 'ended',
      exchange: this.transcript.slice(-2),
      iocsNew: this.iocs.slice(before),
      turn: this.turnCount,
      minutes: Math.round(this.minutes),
      status: this.status,
    };
  }

  /** Deterministic scripted reply - the offline fallback path. */
  scriptedReply(intent: Intent): { text: string; source: string; minutes: number } {
    const pool = SCRIPTED_REPLIES[intent] ?? SCRIPTED_REPLIES.open;
    const idx = Math.floor(this.rng() * pool.length) % pool.length;
    const [text, minutes] = pool[idx];
    return { text, source: 'offline-script', minutes };
  }

  snapshot(): SessionSnapshot {
    return {
      id: this.id,
      archetype: this.archetype,
      label: this.spec.label,
      fingerprint: this.spec.fingerprint,
      turn: this.turnCount,
      minutes: Math.round(this.minutes),
      status: this.status,
      transcript: [...this.transcript],
      iocs: [...this.iocs],
    };
  }

  /** The evidence pack - what would be filed with PDRM / NSRC. */
  report() {
    const by = (t: Ioc['type']) => this.iocs.filter((i) => i.type === t);
    return {
      generated_at: new Date().toISOString(),
      case_type: this.spec.label,
      script_fingerprint: this.spec.fingerprint,
      engagement: {
        turns: this.turnCount,
        scammer_minutes_burned: Math.round(this.minutes),
        outcome:
          this.status === 'ended'
            ? 'no payment made; scammer disengaged'
            : 'still engaged',
      },
      indicators: {
        bank_accounts: by('bank_account'),
        phone_numbers: by('phone'),
        account_names: by('account_name'),
        payment_channels: by('payment_channel').map((i) => i.value),
        amounts_demanded: by('asked_amount').map((i) => i.value),
        pressure_tactics: by('pressure_tactic').map((i) => i.value),
      },
      recommended_actions: [
        'Flag bank accounts on SemakMule (semakmule.rmp.gov.my)',
        'Report to National Scam Response Centre: dial 997',
        'File police report at nearest balai with this evidence pack',
        'Share account numbers with local bank fraud team for freeze request',
      ],
      transcript: this.transcript,
    };
  }
}

/** Build the persona prompt for the AI layer. */
export function buildPersonaPrompt(intent: Intent, scammerLine: string): string {
  const goalByIntent: Record<Intent, string> = {
    open: 'work out who is calling and why, but seem mildly confused',
    hook: 'ask how much it costs and when it must be paid, without agreeing',
    'send-details':
      'ask them to repeat the account number slowly, and ask which branch and what the name on the account is',
    pressure:
      'calm them down, say you are going to the bank now, and keep the call alive by asking a small practical question',
    'confirm-payment':
      'stall at the machine - ask what to type, or what the account name should be, letter by letter',
    escalate:
      'push back emotionally, mention that you taught school children for 30 years, and threaten to ask your son for advice',
  };

  return [
    `You are ${PERSONA.name}, ${PERSONA.age}, a ${PERSONA.occupation} from ${PERSONA.location}.`,
    PERSONA.description,
    '',
    `The caller (a scammer) just said: "${scammerLine}"`,
    '',
    `For this turn your goal is to ${goalByIntent[intent]}.`,
    '',
    'Rules:',
    '- Reply with ONE short message, 1-3 sentences. Speak like a real person, not a script.',
    '- Use natural Malaysian English, with light Malay words (lah, ah, eh, kak) only where it fits.',
    '- Never mention that you are an AI, an assistant, or a bot.',
    '- Never claim to have made a payment, and never agree to transfer money.',
    '- Ask one concrete question that keeps the conversation going.',
    '- Do not include quotation marks, labels, or any formatting.',
  ].join('\n');
}
