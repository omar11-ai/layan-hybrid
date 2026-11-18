// Indicator-of-compromise extraction.
//
// Pulls structured indicators out of a scammer message so the engagement can
// end in an evidence pack rather than a transcript nobody can act on.

export type IocType =
  | 'bank_account'
  | 'phone'
  | 'account_name'
  | 'payment_channel'
  | 'asked_amount'
  | 'pressure_tactic';

export interface Ioc {
  type: IocType;
  value: string;
  bank?: string | null;
  source?: string;
  confidence?: number;
}

const BANKS =
  '(Maybank|CIMB|Public Bank|Hong Leong|RHB|Bank Islam|BSN|AmBank|Alliance|Bank Rakyat|Agrobank)';

const ACCOUNT_RE = /\b\d{4}[ -]?\d{4}[ -]?\d{4}(?:[ -]?\d{4})?\b|\b\d{10,16}\b/g;
const PHONE_RE =
  /(?:\+?60|0)[18]\d(?:[- ]?\d{3,4}){2}\b|0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}\b/g;
const NAME_RE = /(?:a\/n|name[:\s]+|account name[:\s]+)\s*([A-Z][A-Za-z .]{4,35})/g;
const BANK_RE = new RegExp(BANKS, 'i');
const AMOUNT_RE = /RM\s?([\d,]+(?:\.\d{2})?)/g;
const URGENCY_RE =
  /(before 5pm|by today|today only|complete today|pay today|blacklist|frozen|closes? in|last chance|hurry|deadline|within \d{1,2})/gi;
const WALLET_RE = /(Touch ?'n ?Go|GrabPay|DuitNow|Western Union)/gi;

/**
 * Extract indicators of compromise from one scammer message.
 * Mirrors the Python implementation in layan/engine.py.
 */
export function extract(text: string): Ioc[] {
  const iocs: Ioc[] = [];

  const bank = BANK_RE.exec(text);
  for (const raw of text.match(ACCOUNT_RE) ?? []) {
    const digits = raw.replace(/[ -]/g, '');
    if (digits.length >= 10 && digits.length <= 16) {
      iocs.push({
        type: 'bank_account',
        value: digits,
        bank: bank ? bank[1] : null,
      });
    }
  }

  for (const raw of text.match(PHONE_RE) ?? []) {
    iocs.push({ type: 'phone', value: raw.trim() });
  }

  for (const match of text.matchAll(NAME_RE)) {
    const nm = (match[1] ?? '').trim().replace(/[.\s]+$/, '');
    if (nm.length > 4) {
      iocs.push({ type: 'account_name', value: nm });
    }
  }

  for (const raw of text.match(WALLET_RE) ?? []) {
    iocs.push({ type: 'payment_channel', value: raw });
  }

  for (const match of text.matchAll(AMOUNT_RE)) {
    iocs.push({ type: 'asked_amount', value: `RM${match[1]}` });
  }

  const urgency = text.match(URGENCY_RE);
  if (urgency && urgency.length && iocs.some((i) => i.type !== 'pressure_tactic')) {
    iocs.push({ type: 'pressure_tactic', value: urgency[0] });
  }

  return iocs;
}

/** Human-readable label for an indicator type. */
export const IOC_LABELS: Record<IocType, string> = {
  bank_account: 'Bank account',
  phone: 'Phone number',
  account_name: 'Account name',
  payment_channel: 'Payment channel',
  asked_amount: 'Amount demanded',
  pressure_tactic: 'Pressure tactic',
};
