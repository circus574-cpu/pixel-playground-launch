/**
 * What the game server knows about where a connected player is and what they are doing. (The admin panel used to simulate
 * telemetry here; it now shows only values measured by the server, see src/server/runtimeStatus.ts.)
 */
export type PlayerActivityState = "safe" | "combat" | "exploring" | "interior" | "offline";
