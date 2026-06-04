/**
 * proposed_esm_loader.js
 * Zero-dependency Node.js custom ESM loader to redirect external HTTPS Firebase imports
 * to local mocks during offline testing.
 * 
 * To run:
 *   node --experimental-loader=./proposed_esm_loader.js --import=./proposed_mock_env.js proposed_workout_test.js
 *   (or configure it in package.json)
 */

import { URL } from 'node:url';

// Redirect firebase app and auth gstatic URLs to mock modules
const firebaseAppMock = `
  export function initializeApp() {
    return { name: '[MockApp]' };
  }
`;

const firebaseAuthMock = `
  export function getAuth() {
    return {
      currentUser: null,
      onAuthStateChanged: (cb) => {
        // Trigger with null initially
        setTimeout(() => cb(null), 10);
        return () => {};
      }
    };
  }
  export function signInWithPopup() { return Promise.resolve({}); }
  export function signInWithRedirect() { return Promise.resolve({}); }
  export function getRedirectResult() { return Promise.resolve({}); }
  export class GoogleAuthProvider {
    constructor() {
      this.parameters = {};
    }
    setCustomParameters(p) { this.parameters = p; }
  }
  export function signOut() { return Promise.resolve(); }
  export function onAuthStateChanged(auth, cb) {
    // Return unsubscribe function
    return () => {};
  }
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.includes('firebase-app.js')) {
    return {
      shortCircuit: true,
      url: 'data:text/javascript;charset=utf-8,' + encodeURIComponent(firebaseAppMock)
    };
  }
  if (specifier.includes('firebase-auth.js')) {
    return {
      shortCircuit: true,
      url: 'data:text/javascript;charset=utf-8,' + encodeURIComponent(firebaseAuthMock)
    };
  }
  return nextResolve(specifier, context);
}
