// Cloud layer: durable session state, cross-device handover, remote tuning.
//
// The hybrid split is not cosmetic:
//   - the scammer-facing persona reply runs on-device (or falls back to the
//     cloud model) so the engagement never stalls on a bad connection;
//   - the evidence path is cloud-backed, so the session, the indicator
//     timeline and the transcript survive the phone dying and can be picked
//     up by a second operator on another device.

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, ensureSignedIn } from './firebase';
import type { SessionSnapshot } from './engine/session';

export interface CloudSessionRecord extends SessionSnapshot {
  operatorUid: string;
  updatedAt: number;
  deviceLabel: string;
}

const SESSIONS = 'sessions';

/** Persist the current session so it can be resumed or handed over. */
export async function saveSession(
  snapshot: SessionSnapshot,
  deviceLabel = 'web',
): Promise<void> {
  try {
    const user = await ensureSignedIn();
    const ref = doc(collection(db, SESSIONS), snapshot.id);
    const record: CloudSessionRecord & { operatorUid: string } = {
      ...snapshot,
      operatorUid: user.uid,
      updatedAt: Date.now(),
      deviceLabel,
    };
    await setDoc(
      ref,
      record as unknown as DocumentData,
      { merge: true } as never,
    );
  } catch (err) {
    // Cloud persistence is best-effort: the engagement must not die because
    // Firestore is unreachable. The local transcript is still intact.
    console.warn('[cloud] saveSession failed', err);
  }
}

/**
 * Watch a session for changes made on another device.
 * Returns an unsubscribe function.
 */
export function watchSession(
  sessionId: string,
  onRemoteUpdate: (record: CloudSessionRecord) => void,
): Unsubscribe {
  try {
    const ref = doc(collection(db, SESSIONS), sessionId);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as CloudSessionRecord;
        if (data) onRemoteUpdate(data);
      },
      (err) => console.warn('[cloud] watchSession failed', err),
    );
  } catch (err) {
    console.warn('[cloud] watchSession could not start', err);
    return () => undefined;
  }
}

/** Every session this operator has run, newest first. */
export async function listSessions(): Promise<CloudSessionRecord[]> {
  try {
    const user = await ensureSignedIn();
    const out: CloudSessionRecord[] = [];
    const snap = await (await import('firebase/firestore')).getDocs(
      collection(db, SESSIONS),
    );
    snap.forEach((d) => {
      const data = d.data() as CloudSessionRecord;
      if (data && data.operatorUid === user.uid) out.push(data);
    });
    out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return out;
  } catch {
    return [];
  }
}
