import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Generates KI LEGENDS development sound effects (P0, P2) and ambience loops (P3)
 * using the ElevenLabs Sound Effects API (`POST /v1/sound-generation`).
 *
 * SECURITY: Reads `ELEVENLABS_API_KEY` from process.env ONLY. Never hardcode or
 * write the API key to any file.
 */

export interface AudioPromptSpec {
  priority: "P0" | "P2" | "P3";
  id: string;
  titlePl: string;
  prompt: string;
  durationSeconds: number;
  loop: boolean;
  clientRelPath: string;
}

const MODEL_ID = "eleven_text_to_sound_v2";
const PROMPT_INFLUENCE = 0.45;
const OUTPUT_FORMAT = "mp3_44100_128";

export const AUDIO_PROMPTS: readonly AudioPromptSpec[] = [
  // === P0 (7 items, including 3 Partia 1 test items) ===
  {
    priority: "P0",
    id: "audio.development.dummy-hit",
    titlePl: "Trafienie manekina",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. One firm padded wooden training dummy impact, satisfying but nonviolent, no metal weapon swing. Target duration 0.15–0.4 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/dummy-hit.mp3",
  },
  {
    priority: "P0",
    id: "audio.development.target-hit",
    titlePl: "Cel pomiarowy",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. One crisp mechanical measurement target impact with a small settling rattle. Target duration 0.2–0.5 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/target-hit.mp3",
  },
  {
    priority: "P0",
    id: "audio.development.checkpoint",
    titlePl: "Punkt kontrolny",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A short clean checkpoint confirmation, warm and light. Target duration 0.15–0.4 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/checkpoint.mp3",
  },
  {
    priority: "P0",
    id: "audio.development.exam-start",
    titlePl: "Start próby",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A short formal challenge opening chime, not an alarm. Target duration 0.5–1.0 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.8,
    loop: false,
    clientRelPath: "public/game/sfx/development/exam-start.mp3",
  },
  {
    priority: "P0",
    id: "audio.development.exam-success",
    titlePl: "Zdanie próby",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A restrained three-note achievement cadence, no orchestral fanfare. Target duration 0.8–1.5 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 1.2,
    loop: false,
    clientRelPath: "public/game/sfx/development/exam-success.mp3",
  },
  {
    priority: "P0",
    id: "audio.development.exam-fail",
    titlePl: "Niepowodzenie próby",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A soft low two-note retry cue, not a harsh buzzer. Target duration 0.4–0.8 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.6,
    loop: false,
    clientRelPath: "public/game/sfx/development/exam-fail.mp3",
  },
  {
    priority: "P0",
    id: "audio.development.ki-charge",
    titlePl: "Ładowanie węzła",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A focused energy intake smoothly rising and resolving into a small clean pulse. Target duration 0.6–1.2 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.9,
    loop: false,
    clientRelPath: "public/game/sfx/development/ki-charge.mp3",
  },

  // === P2 (30 items) ===
  {
    priority: "P2",
    id: "audio.development.training-start",
    titlePl: "Rozpoczęcie treningu",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. One soft wooden click followed by a restrained readiness chime. Target duration 0.4–0.8 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.6,
    loop: false,
    clientRelPath: "public/game/sfx/development/training-start.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.training-stop",
    titlePl: "Zakończenie treningu",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A soft descending two-note readiness closure, calm and neutral. Target duration 0.3–0.7 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/training-stop.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.window",
    titlePl: "Okno trafienia",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A quiet single readiness tick, noticeable without urgency. Target duration 0.1–0.25 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/window.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.exam-abandon",
    titlePl: "Przerwanie próby",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. One neutral closing clasp, no failure sting. Target duration 0.2–0.5 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/exam-abandon.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.warning",
    titlePl: "Ostrzeżenie próby",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A short low-key danger pulse with clear onset, no siren. Target duration 0.15–0.35 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/warning.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.ki-source",
    titlePl: "Źródło KI",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A soft crystalline reservoir ripple, one interaction only. Target duration 0.4–0.8 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.6,
    loop: false,
    clientRelPath: "public/game/sfx/development/ki-source.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.restraint",
    titlePl: "Powstrzymany cios",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A short controlled blade whoosh stopping safely against a padded catch. Target duration 0.2–0.5 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/restraint.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.rank",
    titlePl: "Wzrost rangi",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A small warm progress chime, less prominent than level-up. Target duration 0.5–1.0 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.8,
    loop: false,
    clientRelPath: "public/game/sfx/development/rank.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.mastery",
    titlePl: "Mistrzostwo",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A restrained resolving harmonic crystal tone, dignified discovery. Target duration 0.8–1.6 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 1.2,
    loop: false,
    clientRelPath: "public/game/sfx/development/mastery.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.variant",
    titlePl: "Wybór wariantu",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A quiet double click and small energy snap. Target duration 0.2–0.5 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/variant.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.module-install",
    titlePl: "Instalacja modułu",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A precise magnetic docking click followed by one clean electrical confirmation. Target duration 0.3–0.7 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.6,
    loop: false,
    clientRelPath: "public/game/sfx/development/module-install.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.module-remove",
    titlePl: "Odłączenie modułu",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A soft magnetic release and brief declining electrical chirp. Target duration 0.3–0.6 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/module-remove.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.scan",
    titlePl: "Skaner",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A short clean electronic scan sweep and subtle confirmation, no speech. Target duration 0.5–1.0 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.8,
    loop: false,
    clientRelPath: "public/game/sfx/development/scan.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.chronicle",
    titlePl: "Kronika",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. One substantial book opening, two gentle paper movements, no voices. Target duration 0.5–1.0 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.8,
    loop: false,
    clientRelPath: "public/game/sfx/development/chronicle.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.record",
    titlePl: "Zapis świadectwa",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A quill finishing a short line followed by a soft sealing stamp. Target duration 0.5–1.0 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.8,
    loop: false,
    clientRelPath: "public/game/sfx/development/record.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.consent",
    titlePl: "Potwierdzenie zgody",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A warm neutral confirmation chime with no celebratory fanfare. Target duration 0.3–0.7 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.6,
    loop: false,
    clientRelPath: "public/game/sfx/development/consent.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.project-start",
    titlePl: "Rozpoczęcie prac",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A small toolkit opening and one purposeful wooden placement. Target duration 0.5–1.0 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.8,
    loop: false,
    clientRelPath: "public/game/sfx/development/project-start.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.project-done",
    titlePl: "Projekt ukończony",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A warm localized restoration cadence ending with a gentle material settling sound. Target duration 0.8–1.6 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 1.2,
    loop: false,
    clientRelPath: "public/game/sfx/development/project-done.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.forge",
    titlePl: "Kucie",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. One measured hammer strike on a small anvil, controlled ring and fast decay. Target duration 0.3–0.8 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.6,
    loop: false,
    clientRelPath: "public/game/sfx/development/forge.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.repair",
    titlePl: "Naprawa broni",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A small metal seam fitting into place and one finishing tap. Target duration 0.4–0.9 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.7,
    loop: false,
    clientRelPath: "public/game/sfx/development/repair.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.attune",
    titlePl: "Zestrojenie broni",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A soft metallic resonance merging with a controlled KI harmonic. Target duration 0.6–1.2 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.9,
    loop: false,
    clientRelPath: "public/game/sfx/development/attune.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.name",
    titlePl: "Nazwanie broni",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A personal quiet resonant chime, dignified without spoken words. Target duration 0.7–1.4 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 1.1,
    loop: false,
    clientRelPath: "public/game/sfx/development/name.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.temper",
    titlePl: "Hartowanie",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A brief forge hiss and a short firm metal resonance. Target duration 0.5–1.0 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.8,
    loop: false,
    clientRelPath: "public/game/sfx/development/temper.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.inherit",
    titlePl: "Przekazanie dziedzictwa",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A restrained mature harmonic cadence, warm and personal rather than epic. Target duration 1.0–2.0 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 1.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/inherit.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.escort-start",
    titlePl: "Start eskorty",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A small travel buckle closing and gentle departure cue. Target duration 0.4–0.8 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.6,
    loop: false,
    clientRelPath: "public/game/sfx/development/escort-start.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.escort-wait",
    titlePl: "Eskorta czeka",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A quiet neutral pause cue, no alarm or speech. Target duration 0.2–0.5 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/escort-wait.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.escort-safe",
    titlePl: "Eskorta dotarła",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A soft arrival cadence and one travel pack settling. Target duration 0.6–1.2 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.9,
    loop: false,
    clientRelPath: "public/game/sfx/development/escort-safe.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.cart-move",
    titlePl: "Wózek w ruchu",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. Slow small wooden cart wheel creaks and light axle rattle. Target duration 4–6 s. A seamless ambient loop with matching start/end energy, no obvious opening or ending, no isolated loud foreground events. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 5.0,
    loop: true,
    clientRelPath: "public/game/sfx/development/cart-move.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.protect-hit",
    titlePl: "Obiekt otrzymuje obrażenia",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. One restrained impact against a wooden supply container, no human pain. Target duration 0.2–0.5 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.5,
    loop: false,
    clientRelPath: "public/game/sfx/development/protect-hit.mp3",
  },
  {
    priority: "P2",
    id: "audio.development.protect-safe",
    titlePl: "Obiekt zabezpieczony",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. A latch fastening firmly and one soft confirmation. Target duration 0.3–0.7 s. Immediate clean onset, controlled short decay, clean ending, no silence padding. No loop. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 0.6,
    loop: false,
    clientRelPath: "public/game/sfx/development/protect-safe.mp3",
  },

  // === P3 (4 ambience loops) ===
  {
    priority: "P3",
    id: "audio.ambience.planetary",
    titlePl: "Otoczenie treningu — Verdantia",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. Quiet sheltered woodland training yard, distant leaves and a gentle water channel, no birds close to microphone. Sonic palette: forest green, amber, ochre, weathered wood and natural stone; living nature, practical craftsmanship. Target duration 20–30 s. A seamless ambient loop with matching start/end energy, no obvious opening or ending, no isolated loud foreground events. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 22.0,
    loop: true,
    clientRelPath: "public/game/sfx/ambience/planetary.mp3",
  },
  {
    priority: "P3",
    id: "audio.ambience.sage",
    titlePl: "Otoczenie treningu — Aetheria",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. Quiet stone scholarly courtyard, soft air through arches and a very subtle crystal resonance, no chanting. Sonic palette: ivory, emerald, turquoise and restrained gold; disciplined KI scholarship, carved stone, sacred gardens. Target duration 20–30 s. A seamless ambient loop with matching start/end energy, no obvious opening or ending, no isolated loud foreground events. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 22.0,
    loop: true,
    clientRelPath: "public/game/sfx/ambience/sage.mp3",
  },
  {
    priority: "P3",
    id: "audio.ambience.android",
    titlePl: "Otoczenie treningu — Nexus-9",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. Quiet clean workshop, low stable ventilation and sparse gentle relay activity, no alarms. Sonic palette: silver, graphite and electric cyan; precise cybernetic fantasy, glass, metal and energy circuits. Target duration 20–30 s. A seamless ambient loop with matching start/end energy, no obvious opening or ending, no isolated loud foreground events. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 22.0,
    loop: true,
    clientRelPath: "public/game/sfx/ambience/android.mp3",
  },
  {
    priority: "P3",
    id: "audio.ambience.legend",
    titlePl: "Otoczenie treningu — Pyra",
    prompt:
      "Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG. Quiet basalt training courtyard near a forge, soft distant ember crackle and air, no battle. Sonic palette: charcoal, crimson, blackened steel and restrained ember gold; honorable warrior culture, basalt and forge craftsmanship. Target duration 20–30 s. A seamless ambient loop with matching start/end energy, no obvious opening or ending, no isolated loud foreground events. No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies. Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass.",
    durationSeconds: 22.0,
    loop: true,
    clientRelPath: "public/game/sfx/ambience/legend.mp3",
  },
];

interface AudioManifestEntry {
  id: string;
  priority: "P0" | "P2" | "P3";
  version: "v001";
  status: "kandydat";
  titlePl: string;
  model: string;
  outputFormat: string;
  durationSeconds: number;
  loop: boolean;
  promptInfluence: number;
  catalogPrompt: string;
  apiText: string;
  apiTextLength: number;
  generatedAt: string;
  requestId: string | null;
  contentType: string | null;
  originalPath: string;
  clientPath: string;
  bytes: number;
  sha256: string;
}

const ELEVENLABS_MAX_CHARS = 450;

/**
 * ElevenLabs `/v1/sound-generation` enforces a strict 450-character maximum on `text`.
 * The catalog notes ("Rzeczywiste możliwości modelu/wersji/API trzeba sprawdzić przed
 * automatyzacją") include export/validation instructions at the tail of each prompt.
 * This helper keeps the complete sonic description and trims only trailing export/meta
 * boilerplate so every prompt fits <= 450 characters cleanly.
 */
export function fitElevenLabsText(catalogPrompt: string): string {
  let text = catalogPrompt
    .replace(
      /\s*Do not combine unrelated events into one clip\. Deliver the highest quality available audio.*$/i,
      "",
    )
    .replace(/\s*Format and exact duration will be validated after export.*$/i, "")
    .trim();

  if (text.length > ELEVENLABS_MAX_CHARS) {
    text = text
      .replace(
        /^Create ONE original sound effect for KI LEGENDS, a polished anime fantasy 2D action RPG\.\s*/i,
        "Anime fantasy 2D RPG sound effect: ",
      )
      .replace(
        /\s*Clear on a small phone speaker at low volume, restrained dynamics, no excessive sub-bass\./i,
        " Restrained dynamics, no heavy sub-bass.",
      )
      .trim();
  }

  if (text.length > ELEVENLABS_MAX_CHARS) {
    text = text
      .replace(
        /\s*No spoken words, singing, copyrighted melodies, trailer music, UI voiceover, clipping or harsh sustained high frequencies\./i,
        " No voices, music, or clipping.",
      )
      .replace(
        /\s*A seamless ambient loop with matching start\/end energy, no obvious opening or ending, no isolated loud foreground events\./i,
        " Seamless ambient loop, no loud foreground events.",
      )
      .trim();
  }

  if (text.length > ELEVENLABS_MAX_CHARS) {
    throw new Error(`Prompt still exceeds ${ELEVENLABS_MAX_CHARS} chars (${text.length}): ${text}`);
  }
  return text;
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function generateOne(
  spec: AudioPromptSpec,
  apiKey: string,
  rootDir: string,
): Promise<AudioManifestEntry> {
  const apiText = fitElevenLabsText(spec.prompt);
  const url = `https://api.elevenlabs.io/v1/sound-generation?output_format=${OUTPUT_FORMAT}`;
  const body: Record<string, unknown> = {
    text: apiText,
    model_id: MODEL_ID,
    duration_seconds: spec.durationSeconds,
    prompt_influence: PROMPT_INFLUENCE,
    loop: spec.loop,
  };

  let res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  // Fallback if `loop` field is rejected by an older endpoint validator
  if (res.status === 422) {
    const errText = await res.text();
    console.warn(`422 on ${spec.id} (${errText}), retrying without loop parameter...`);
    const fallbackBody = {
      text: apiText,
      model_id: MODEL_ID,
      duration_seconds: spec.durationSeconds,
      prompt_influence: PROMPT_INFLUENCE,
    };
    res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(fallbackBody),
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs HTTP ${res.status} for ${spec.id}: ${errText}`);
  }

  const requestId =
    res.headers.get("request-id") ??
    res.headers.get("x-request-id") ??
    res.headers.get("history-item-id") ??
    null;
  const contentType = res.headers.get("content-type");
  const arrayBuffer = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  if (buf.byteLength < 512) {
    throw new Error(`Unexpectedly small audio payload (${buf.byteLength} bytes) for ${spec.id}`);
  }

  const originalRelPath = `art/production/development/v001/audio/originals/${spec.id}.v001.mp3`;
  const originalAbsPath = join(rootDir, originalRelPath);
  const clientAbsPath = join(rootDir, spec.clientRelPath);

  mkdirSync(join(rootDir, "art/production/development/v001/audio/originals"), { recursive: true });
  mkdirSync(join(rootDir, "public/game/sfx/development"), { recursive: true });
  mkdirSync(join(rootDir, "public/game/sfx/ambience"), { recursive: true });

  writeFileSync(originalAbsPath, buf);
  writeFileSync(clientAbsPath, buf);

  const digest = sha256Hex(buf);
  return {
    id: spec.id,
    priority: spec.priority,
    version: "v001",
    status: "kandydat",
    titlePl: spec.titlePl,
    model: MODEL_ID,
    outputFormat: OUTPUT_FORMAT,
    durationSeconds: spec.durationSeconds,
    loop: spec.loop,
    promptInfluence: PROMPT_INFLUENCE,
    catalogPrompt: spec.prompt,
    apiText,
    apiTextLength: apiText.length,
    generatedAt: new Date().toISOString(),
    requestId,
    contentType,
    originalPath: originalRelPath,
    clientPath: spec.clientRelPath,
    bytes: buf.byteLength,
    sha256: digest,
  };
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY environment variable.");
  }

  const filterArg = process.argv[2] ?? "all";
  const rootDir = process.cwd();
  const manifestPath = join(rootDir, "art/production/development/v001/audio-manifest.json");

  let existingEntries: Record<string, AudioManifestEntry> = {};
  if (existsSync(manifestPath)) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        items?: AudioManifestEntry[];
      };
      for (const item of parsed.items ?? []) {
        existingEntries[item.id] = item;
      }
    } catch {
      existingEntries = {};
    }
  }

  const partia1Ids = new Set([
    "audio.development.dummy-hit",
    "audio.development.exam-success",
    "audio.development.ki-charge",
  ]);

  const selected = AUDIO_PROMPTS.filter((p) => {
    if (filterArg === "partia1") return partia1Ids.has(p.id);
    if (filterArg === "P0") return p.priority === "P0";
    if (filterArg === "P2") return p.priority === "P2";
    if (filterArg === "P3") return p.priority === "P3";
    return true;
  });

  console.log(`Selected ${selected.length} audio prompts (filter=${filterArg}).`);

  for (const spec of selected) {
    const existing = existingEntries[spec.id];
    if (
      existing &&
      existsSync(join(rootDir, existing.originalPath)) &&
      existsSync(join(rootDir, existing.clientPath)) &&
      process.env.FORCE_REGEN !== "1"
    ) {
      console.log(
        `[SKIP] ${spec.id} already generated (${existing.bytes} B, req=${existing.requestId})`,
      );
      continue;
    }

    process.stdout.write(
      `[GEN] ${spec.priority} ${spec.id} (${spec.durationSeconds}s, loop=${spec.loop}) ... `,
    );
    const entry = await generateOne(spec, apiKey, rootDir);
    existingEntries[spec.id] = entry;
    console.log(
      `OK (${entry.bytes} B, req=${entry.requestId ?? "n/a"}, sha256=${entry.sha256.slice(0, 12)})`,
    );

    // Persist manifest incrementally after each item so progress is never lost
    const orderedItems = AUDIO_PROMPTS.map((p) => existingEntries[p.id]).filter(
      (x): x is AudioManifestEntry => Boolean(x),
    );
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          version: "v001",
          provider: "ElevenLabs Sound Effects API",
          endpoint: "POST https://api.elevenlabs.io/v1/sound-generation",
          model: MODEL_ID,
          outputFormat: OUTPUT_FORMAT,
          totalCatalogItems: AUDIO_PROMPTS.length,
          generatedCount: orderedItems.length,
          updatedAt: new Date().toISOString(),
          items: orderedItems,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }

  console.log(
    `Finished. Total recorded in audio-manifest.json: ${Object.keys(existingEntries).length}/${AUDIO_PROMPTS.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
