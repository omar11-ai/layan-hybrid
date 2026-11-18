// Firebase AI Logic — hybrid inference.
//
// The whole point of LAYAN hybrid: the persona must never stall because a
// network dropped, so we prefer the on-device model. When the device cannot
// run it (or the model is still downloading) Firebase AI Logic falls back to
// the cloud-hosted Gemini model automatically. If both are unavailable, the
// session falls back to a deterministic scripted reply - the engagement never
// dies.
//
//   on-device  ->  cloud  ->  offline script

import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from 'firebase/ai';
import { app } from './firebase';

export type InferenceSource = 'ON_DEVICE' | 'IN_CLOUD' | 'OFFLINE_SCRIPT';

export interface ReplyResult {
  text: string;
  source: InferenceSource;
  /** Minutes of scammer time burned by this exchange. */
  minutes: number;
  error?: string;
}

let model: ReturnType<typeof getGenerativeModel> | null = null;
let deviceModelReady = false;
let deviceDownloadProgress = 0;

export function getHybridModel() {
  if (model) return model;
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  model = getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: {
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        maxOutputTokens: 220,
        temperature: 0.9,
      },
    },
  });
  return model;
}

/**
 * Must be called after a user interaction (a click) and before the first
 * prompt request. Starts the on-device model download in the background.
 */
export function initializeDeviceModel(): void {
  const m = getHybridModel();
  try {
    void m.initializeDeviceModel((value: number) => {
      deviceDownloadProgress = value;
      window.dispatchEvent(
        new CustomEvent('layan:device-download', { detail: value }),
      );
    });
    deviceModelReady = true;
  } catch (err) {
    deviceModelReady = false;
    console.warn('[ai] initializeDeviceModel failed', err);
  }
}

export function getDeviceDownloadProgress() {
  return deviceDownloadProgress;
}

export function isDeviceModelRequested() {
  return deviceModelReady;
}

/**
 * Ask Chrome directly whether the on-device model is usable. Used to show an
 * honest status line in the UI rather than pretending everything is local.
 */
export async function probeOnDeviceAvailability(): Promise<string> {
  const lm = (globalThis as unknown as {
    LanguageModel?: {
      availability?: () => Promise<string>;
      capabilities?: () => Promise<{ available?: string }>;
    };
  }).LanguageModel;

  if (!lm || typeof lm.availability !== 'function') {
    return 'unsupported';
  }
  try {
    return await lm.availability();
  } catch {
    return 'unknown';
  }
}

/**
 * Generate the jammer's reply through the hybrid model.
 * Throws only if BOTH on-device and cloud inference fail; the caller then
 * uses the scripted fallback.
 */
export async function generateHybridReply(
  prompt: string,
): Promise<ReplyResult> {
  const m = getHybridModel();
  const result = await m.generateContent(prompt);
  const response = result.response;
  const raw = (response.text() ?? '').trim();

  const source: InferenceSource =
    (response as unknown as { inferenceSource?: string }).inferenceSource ===
    'ON_DEVICE'
      ? 'ON_DEVICE'
      : 'IN_CLOUD';

  return {
    text: raw.length ? raw : fallbackLine(),
    source,
    minutes: estimateMinutes(raw),
  };
}

/**
 * How long the scammer was kept on the line. Longer replies and replies that
 * ask for more detail keep them talking.
 */
function estimateMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const base = Math.max(2, Math.min(12, Math.round(words / 6)));
  const asks = (text.match(/\?/g) ?? []).length;
  return base + asks * 2;
}

function fallbackLine(): string {
  return 'Eh, one moment please, I write down first... you say again the number?';
}

/** Strip anything that looks like a model preamble or markdown. */
export function cleanReply(text: string): string {
  return text
    .replace(/^["'`\s]+|["'`\s]+$/g, '')
    .replace(/^(Puan Rina|Rina)\s*:\s*/i, '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}
