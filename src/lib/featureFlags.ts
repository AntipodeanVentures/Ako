// Flags for features that are built but intentionally not yet switched
// on. Flip a flag to true to launch the feature.

// Real-time voice calls for role-plays (a streaming voice API). The beta
// runs role-plays as turn-taking speech instead.
export const VOICE_CALLS_ENABLED: boolean = false;

// Server-side push for people who have not opened the app in days. The
// beta relies on local due-review reminders, which need no server.
export const SERVER_PUSH_ENABLED: boolean = false;
