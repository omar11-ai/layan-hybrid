// Firebase bootstrap.
//
// App Check is enforced for Firebase AI Logic, so the debug provider is used
// in development and a production attestation provider is used once the app
// is deployed. The debug token is read from the environment and is never
// committed.

import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getRemoteConfig, fetchAndActivate, getString } from 'firebase/remote-config';

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean;
  }
}

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const app = initializeApp(config);

// ---------------------------------------------------------------- App Check
// The debug token is generated locally and registered in the Firebase console
// (App Check -> Apps -> Manage debug tokens). It is never checked into git.
const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as
  | string
  | undefined;

if (debugToken) {
  window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(
    import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string,
  ),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const remoteConfig = getRemoteConfig(app);

/** Sign in anonymously so Firestore rules can scope data per operator. */
export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

/**
 * Remote Config lets us tune the persona and the archetype set without
 * shipping a new build - e.g. dialling the persona warmer during a live
 * demonstration.
 */
export async function loadRemoteConfig() {
  try {
    await fetchAndActivate(remoteConfig);
    return getString(remoteConfig, 'layan_persona_tone') || 'default';
  } catch {
    return 'default';
  }
}
