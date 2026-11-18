// LAYAN — scam archetype library.
//
// Ported from the Python engine (layan/engine.py). The scammer side is a
// scripted simulator of real Malaysian scam archetypes: fully offline,
// deterministic under a seed, and safe to demo.

export type Intent =
  | 'open'
  | 'hook'
  | 'send-details'
  | 'pressure'
  | 'confirm-payment'
  | 'escalate';

export interface ArchetypeSpec {
  id: string;
  label: string;
  fingerprint: string;
  steps: Array<[Intent, string[]]>;
  exit: string;
}

export const ARCHETYPES: Record<string, ArchetypeSpec> = {
  poslaju: {
    id: 'poslaju',
    label: 'Pos Laju Customs Fee',
    fingerprint: 'PARCEL-CUSTOMS',
    steps: [
      ['open', [
        'Good afternoon madam, this is Encik Zul from Pos Laju headquarters. Your parcel from overseas is currently held at customs.',
      ]],
      ['hook', [
        'There is a small customs clearance fee of RM380 only. If you pay today before 5pm, the parcel will be delivered to your house tomorrow.',
      ]],
      ['send-details', [
        'You can transfer to our company account: Maybank 5123 4567 8901, a/n ZULHISYAM BIN ABD RAZAK. My office line is 03-2123 4567 if you want to verify.',
      ]],
      ['pressure', [
        'Alamak madam hurry please, after 5pm the customs system closes. Your parcel will be destroyed and you will lose the item too.',
      ]],
      ['confirm-payment', [
        'Have you made the payment yet? Send me the screenshot of the receipt here so I can release the parcel immediately.',
      ]],
      ['escalate', [
        'If payment not received today, your IC number will be blacklisted by customs! You cannot fly overseas anymore, madam.',
      ]],
      ['send-details', [
        'Okay okay, I give you again the account: Maybank 5123 4567 8901. Or you can use DuitNow to my number 012-345 6789, same name.',
      ]],
      ['pressure', [
        'Madam I am chasing you because your parcel value is very high, RM4,500. Just RM380 to release it. Where are you now?',
      ]],
      ['confirm-payment', [
        'The system shows still no payment. Are you at the ATM now? I can guide you, just follow what I say.',
      ]],
    ],
    exit: 'Tersalah orang lah ni. Buang masa saya je!',
  },

  lhdn: {
    id: 'lhdn',
    label: 'LHDN Tax Refund / Freeze',
    fingerprint: 'TAX-REFUND',
    steps: [
      ['open', [
        'Assalamualaikum tuan, this is Hafiz from Lembaga Hasil Dalam Negeri. There is an issue with your income tax file for year 2025.',
      ]],
      ['hook', [
        'You have an unclaimed tax refund of RM2,400. But there is a small processing deposit of RM240 required to activate the refund.',
      ]],
      ['send-details', [
        'Please transfer the deposit to LHDN payment gateway account: CIMB 8021 1234 5678, a/n HAFIZUDDIN BIN ISMAIL. Verification hotline: 03-8911 2233.',
      ]],
      ['pressure', [
        'Tuan must complete today, otherwise the refund system will close and your name will be flagged for tax audit.',
      ]],
      ['confirm-payment', [
        'Is it done? We need the reference number of the transfer to key into the system.',
      ]],
      ['escalate', [
        'Tuan, if we don\'t receive the deposit, your bank accounts will be frozen under Section 103 of the Income Tax Act!',
      ]],
      ['send-details', [
        'Alternatively you can pay via Touch \'n Go eWallet to 019-887 6543. Same amount, RM240 only.',
      ]],
      ['pressure', [
        'My supervisor is asking about your file already. Please, I am trying to help you here.',
      ]],
    ],
    exit: 'Macam ni pun... sudah, saya tutup fail ni.',
  },

  romance: {
    id: 'romance',
    label: 'Romance / Love Scam',
    fingerprint: 'ROMANCE-CRUEL',
    steps: [
      ['open', [
        'Hi dear, it\'s me, your Daniel. I am at the airport now, I am flying to KL to meet you this weekend. Do you miss me?',
      ]],
      ['hook', [
        'Baby, something embarrassing happened. My luggage got separated at the airport. The airline needs a handling fee of RM650 or my bag will not arrive with me.',
      ]],
      ['send-details', [
        'Can you help me, dear? Transfer to this agent account: Public Bank 3456 7890 1234, a/n DANIEL OKAFOR. I will pay you double when I land.',
      ]],
      ['pressure', [
        'The gate closes in one hour, baby. I am so stressed here. You are my only person in Malaysia.',
      ]],
      ['confirm-payment', [
        'Did you send it? Send me the proof so I can show the airline officer.',
      ]],
      ['escalate', [
        'I don\'t understand, is your love for me not worth RM650? I bought you a gift worth RM3,000 here!',
      ]],
      ['send-details', [
        'Okay, if bank is difficult, use Western Union to my name: DANIEL CHEE, agent code 88123. Phone me direct: +60 17-654 3210.',
      ]],
      ['pressure', [
        'Baby I am boarding soon. Please, I promise I will marry you this year.',
      ]],
    ],
    exit: 'You are not real girlfriend. I find someone else. Bye.',
  },

  paidtask: {
    id: 'paidtask',
    label: 'Paid-Task Job Scam',
    fingerprint: 'PAID-TASK',
    steps: [
      ['open', [
        'Hi kak! This is Amy from Shopee official partner team. Part-time job: like products 10 minutes daily, earn RM150-RM300 per day. Interested?',
      ]],
      ['hook', [
        'To join, kak need to topup a refundable deposit of RM100 into the task platform. All money returns with 8% commission after each task.',
      ]],
      ['send-details', [
        'Topup to our merchant account: Hong Leong 2109 8765 4321, a/n AMY NURAINI BINTI YUSOF. Or GrabPay to 016-777 8899.',
      ]],
      ['pressure', [
        'Kak hurry, only 3 slots left today. Yesterday group all already withdraw their earnings, look: RM1,200 in one week!',
      ]],
      ['confirm-payment', [
        'Have you topped up? Send screenshot, I will activate your task account and send today\'s 5 products.',
      ]],
      ['escalate', [
        'Kak, if you don\'t topup now, your RM100 bonus slot goes to another member. Don\'t blame me later.',
      ]],
      ['send-details', [
        'Last chance: transfer RM100 to RHB 1029 3847 5610, a/n AMY NURAINI. Commission credited in 10 minutes.',
      ]],
      ['pressure', [
        'Why so slow kak? People earn RM300 while you still typing. Decide lah.',
      ]],
    ],
    exit: 'Alah member macam ni je. Bye lah.',
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES);

// The persona LAYAN speaks as.
export const PERSONA = {
  name: 'Puan Rina',
  age: 54,
  occupation: 'retired school teacher',
  location: 'Kepala Batas, Penang',
  description:
    'A 54-year-old retired school teacher from Kepala Batas, Penang. ' +
    'Polite, patient, slightly hard of hearing, and endlessly curious about ' +
    'banking details. She believes the caller is a real government or company ' +
    'representative and wants to cooperate, but she is slow, asks for ' +
    'details to be repeated, and keeps the call going far longer than ' +
    'expected.',
};

/** Deterministic scripted replies, used when no model is available. */
export const SCRIPTED_REPLIES: Record<Intent, Array<[string, number]>> = {
  open: [
    ['Eh? Who is this? You have the wrong number lah... I am Rina, I only use this phone for calling my son. Anyway, continue continue, I listen.', 3],
    ['Hello? You said parcel? I didn\'t order anything from overseas... but you tell me more, I like listening to stories.', 4],
    ['Ala, my phone screen small one, I cannot see the name. You are from which office exactly? I write down.', 3],
  ],
  hook: [
    ['RM380 is not small for me, my pension is RM1,100 a month... but okay, you give me the account number, I want to write it in my book first. Slow slow.', 5],
    ['Eh you remind me of my grandson, he also talks fast-fast like this about computer things. What is your name full full? I want to remember.', 4],
    ['Okay okay... the account number how many digit? You type it again slowly, I use keypad phone, I need to look at each number.', 6],
  ],
  'send-details': [
    ['Wait wait, 5123... then what? My eyes already blur. You send it again in text so I can copy properly. I am not rushing you, don\'t rush me.', 7],
    ['I write down already: Zul... hisyam... what? A long name like that, like a politician. You sure this is official company account? The bank name which branch?', 6],
    ['Okay I have the number. But my Maybank2u app always ask for this OTP thing. OTP what is that? You know about that one? You work with customs or with bank?', 8],
  ],
  pressure: [
    ['Don\'t shout don\'t shout, I am going to the bank now... eh but Friday the Kepala Batas branch close for Friday prayer. You want me to go to the ATM at the pasar instead?', 6],
    ['Alah, 5pm 5pm, you people always with the deadline. My husband also says the system closes at 5, he says it for the TV news too. Wait ah, I\'m putting on my shoes.', 5],
    ['Okay okay, I am walking to the bank now. It\'s raining a bit here, you understand, weather in Penang. Don\'t hang up, I will be back in 20 minutes.', 9],
  ],
  'confirm-payment': [
    ['The ATM machine ask me: "Are you making this transfer to someone you know?"... eh, I know you or not? We just talking. The machine is right also.', 7],
    ['Eh sekejap, the screen says the account name must match. I typed Zulhisyam but it shows something else. You spell the name for me letter by letter?', 8],
    ['I am at the machine now but it asks for "purpose of payment". What I should write? "Customs"? "Parcel"? You people always make it complicated.', 6],
  ],
  escalate: [
    ['Blacklist my IC?! Eh, you know who I am? I taught 30 years of school children in Kepala Batas. You threaten me with paper? Anyway, tell me more about this customs thing.', 5],
    ['Eh you scare me like that, now I want to call my grandson. He studies IT at UPM, top of his class. You wait, I ask him to call you directly, he will be happy to talk to customs.', 10],
    ['My neighbour Mak Cik Kiah also got blacklisted once, turned out it was her son\'s friend playing around. You sure you are not playing around? I will ask my son first.', 8],
  ],
};

/** The scammer's reaction when Puan Rina threatens to involve family. */
export const SCAMMER_REACTIONS = {
  grandkid:
    'No no no, don\'t call anyone! This is confidential customs matter! Just pay, simple simple only!',
  son: 'Why you must ask your son? He is not the one receiving the parcel. Focus focus.',
  hangup: 'Hello? Hello?? Madam?? ...',
};
