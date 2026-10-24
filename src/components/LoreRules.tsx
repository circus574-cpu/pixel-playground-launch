import React from 'react';
import { BookOpen, ShieldAlert, Award, Compass, Cpu, FileText, CheckCircle2 } from 'lucide-react';

export const LoreRules: React.FC = () => {
  return (
    <div className="space-y-8 text-stone-100 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-stone-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-400">
          <BookOpen className="w-4 h-4" />
          Księga Przygody & Official Guidelines
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white mt-1">
          Ki Legends Adventure Lore & Stage 2 Protocol
        </h2>
        <p className="text-sm text-stone-400 mt-1">
          Direct transcription of canonical mechanics, progression curves, and world building constraints.
        </p>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stage 2 Gameplay Mandate */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Stage 2 Local PvE Progression
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Authorized by the project owner following the anime forest integration. The production world utilizes independent terrain and prop elements, rejecting single-concept illustrations in favor of modular runtime chunks.
          </p>
          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800/80 text-xs font-mono text-stone-400">
            • Local PvE progression only; no authoritative multiplayer claims<br />
            • Default zoomed-out orthographic camera with whole-stage HUD<br />
            • Collision footprints preserved in canonical region JSON
          </div>
        </div>

        {/* Combat & Stat Scaling */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Award className="w-4 h-4" />
            Progression & Stat Maths
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Character races (Planetary, Sage, Android, Legend) scale through 4 distinct development trees (29 nodes total) and a structured combat mathematics model.
          </p>
          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800/80 text-xs font-mono text-stone-400">
            • Movement speed scales at exactly +5% of base speed per level up to level 20<br />
            • Ki capacity and regen determine active combo frequency<br />
            • Armor DEF calculates percentage mitigation against monster ATK
          </div>
        </div>

        {/* World Topography & Safe Zones */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Compass className="w-4 h-4" />
            Continents & Safe Cities
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            The planetary atlas connects four planetary landmasses: Verdant, Aether, Nexus, and Pyra. Each continent houses a safe sanctuary city surrounded by wilderness.
          </p>
          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800/80 text-xs font-mono text-stone-400">
            • Safe cities span ~4000 × 2500 units where no hostile mobs spawn<br />
            • Wild zones contain the 40 bestiary monsters from the owner archive<br />
            • Presentation roads are baked into chunk textures without collision
          </div>
        </div>

        {/* GPU & Infrastructure Governance */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <ShieldAlert className="w-4 h-4" />
            Infrastructure Safeguards
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Strict boundaries govern rendering and instance control to protect project integrity and published history.
          </p>
          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800/80 text-xs font-mono text-stone-400">
            • GPU pod lifecycle is reserved exclusively for the owner<br />
            • Published git history is strictly preserved (no squashing/rebasing)<br />
            • Generated client files and source PDFs remain archival evidence
          </div>
        </div>
      </div>

      {/* PDF Reference Box */}
      <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold text-sm text-white">KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf</div>
            <div className="text-xs text-stone-400">Original binary adventure manuscript present in repository root.</div>
          </div>
        </div>
        <span className="px-3 py-1 bg-stone-800 border border-stone-700 rounded-lg text-xs font-mono text-stone-300">
          356 KB • Source Spec
        </span>
      </div>
    </div>
  );
};
