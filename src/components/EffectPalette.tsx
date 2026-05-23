import React, { useState } from 'react';
import { Palette, Play, Save, Plus, Trash2, Send, X } from 'lucide-react';

interface CustomEffect {
  id: string;
  name: string;
  colors: string[];
  speed: number;
}

export default function EffectPalette() {
  const [effects, setEffects] = useState<CustomEffect[]>([
    { id: 'custom-1', name: 'Neon Pulse', colors: ['#ff00ff', '#00ffff', '#0000ff'], speed: 1.5 },
    { id: 'custom-2', name: 'Cyber Sunrise', colors: ['#ff4e00', '#ffdd00', '#ff0055'], speed: 0.8 },
  ]);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  const addEffect = () => {
    const newEffect: CustomEffect = {
      id: `custom-${Date.now()}`,
      name: `New Sequence ${effects.length + 1}`,
      colors: ['#00F0FF', '#FF4E00'],
      speed: 1.0
    };
    setEffects([...effects, newEffect]);
  };

  const removeEffect = (id: string) => {
    setEffects(effects.filter(e => e.id !== id));
  };

  const updateEffect = (id: string, updates: Partial<CustomEffect>) => {
    setEffects(effects.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const addColor = (effectId: string) => {
    updateEffect(effectId, {
      colors: [...(effects.find(e => e.id === effectId)?.colors || []), '#FFFFFF']
    });
  };

  const removeColor = (effectId: string, index: number) => {
    const effect = effects.find(e => e.id === effectId);
    if (effect && effect.colors.length > 1) {
      const newColors = [...effect.colors];
      newColors.splice(index, 1);
      updateEffect(effectId, { colors: newColors });
    }
  };

  const sendToHardware = (effect: CustomEffect) => {
    // Simulated hardware dispatch
    const cmd = {
      command: 'custom_effect_sequence',
      colors: effect.colors.map(c => {
        // Simple hex to RGB string or whatever hardware uses
        return c;
      }),
      speed: effect.speed
    };
    console.log("[Hardware Comm] Sent pattern command:", cmd);
    
    // Attempt local API fetch commonly expected by such hardwares if running locally
    try {
      const espIp = localStorage.getItem('pov_dash_espIp') || '192.168.4.1';
      fetch(`http://${espIp}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
        mode: 'no-cors'
      }).catch(() => {});
    } catch {}
    
    setActiveEffect(effect.id);
  };

  return (
    <div className="bg-[#0B0C0E] w-full min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-xl font-mono font-bold text-[#00F0FF] uppercase tracking-widest flex items-center gap-3">
            <Palette className="w-6 h-6" />
            Custom Effect Palette
          </h2>
          <p className="text-[#8E9299] text-[11px] font-mono mt-2 tracking-wider">DESIGN, PREVIEW, AND DEPLOY MULTI-STAGE COLOR SEQUENCES DIRECTLY TO HARDWARE BUFFERS.</p>
        </div>
        <button
          onClick={addEffect}
          className="flex items-center justify-center gap-2 bg-[#15171A] hover:bg-[#2A2D33] text-[#00F0FF] border border-[#00F0FF]/30 hover:border-[#00F0FF] transition-all px-4 py-2 font-mono text-xs uppercase font-bold tracking-wider"
        >
          <Plus className="w-4 h-4" />
          New Sequence
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {effects.map((effect) => (
          <div key={effect.id} className={`bg-[#15171A] border flex flex-col group transition-all duration-300 ${activeEffect === effect.id ? 'border-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.1)]' : 'border-[#2A2D33]'}`}>
            <div className="p-4 border-b border-[#2A2D33] flex items-center justify-between bg-[#0E1012]">
              <input
                type="text"
                value={effect.name}
                onChange={(e) => updateEffect(effect.id, { name: e.target.value })}
                className="bg-transparent border-none text-[#E0E2E5] font-mono font-bold text-sm focus:outline-none focus:text-[#00F0FF] uppercase w-full md:w-auto"
              />
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[#8E9299] text-[10px] font-mono">RATE</span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    max="10"
                    value={effect.speed}
                    onChange={(e) => updateEffect(effect.id, { speed: parseFloat(e.target.value) || 1 })}
                    className="w-16 bg-[#1A1D24] border border-[#2A2D33] text-[11px] font-mono px-2 py-1 text-center text-[#E0E2E5] focus:outline-none focus:border-[#00F0FF]"
                  />
                </div>
                <button
                  onClick={() => removeEffect(effect.id)}
                  className="text-[#8E9299] hover:text-[#FF4E00] transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-6 flex-1">
              <div className="flex flex-wrap gap-4 mb-8">
                {effect.colors.map((color, i) => (
                  <div key={i} className="relative group/color flex items-center justify-center">
                    <div className="w-12 h-12 rounded-sm border-2 border-[#2A2D33] p-1 group-hover/color:border-[#00F0FF] transition-colors">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const newColors = [...effect.colors];
                          newColors[i] = e.target.value;
                          updateEffect(effect.id, { colors: newColors });
                        }}
                        className="w-full h-full border-0 p-0 cursor-pointer rounded-[2px] bg-transparent block"
                        style={{ boxShadow: `0 0 15px ${color}60` }}
                      />
                    </div>
                    {effect.colors.length > 1 && (
                      <button
                        onClick={() => removeColor(effect.id, i)}
                        className="absolute -top-2 -right-2 bg-[#FF4E00] hover:bg-white text-black rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-all z-10 font-bold"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                
                <button
                  onClick={() => addColor(effect.id)}
                  className="w-12 h-12 flex items-center justify-center border-2 border-dashed border-[#2A2D33] hover:border-[#00F0FF] text-[#8E9299] hover:text-[#00F0FF] rounded-sm transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Preview Ribbon */}
              <div className="space-y-2">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#8E9299] block">Interpolated Output Buffer</span>
                <div className="h-4 w-full rounded-sm overflow-hidden border border-[#2A2D33] flex bg-[#111]" style={{
                  background: effect.colors.length > 1 ? `linear-gradient(to right, ${effect.colors.join(', ')})` : effect.colors[0]
                }} />
              </div>
            </div>

            <div className="p-4 border-t border-[#2A2D33] flex items-center justify-between bg-[#0E1012]">
              <button
                onClick={() => setActiveEffect(activeEffect === effect.id ? null : effect.id)}
                className={`flex items-center gap-2 font-mono text-xs uppercase px-4 py-2 border transition-colors ${
                  activeEffect === effect.id 
                    ? 'bg-[#00F0FF] text-black border-[#00F0FF]' 
                    : 'bg-[#1A1D24] text-[#E0E2E5] hover:bg-[#2A2D33] border-[#2A2D33]'
                }`}
              >
                <Play className={`w-3.5 h-3.5 ${activeEffect === effect.id ? 'animate-pulse' : ''}`} fill={activeEffect === effect.id ? "currentColor" : "none"} />
                {activeEffect === effect.id ? 'Playing' : 'Preview'}
              </button>

              <button
                onClick={() => sendToHardware(effect)}
                className="flex items-center gap-2 text-[#00F0FF] font-mono text-xs uppercase px-4 py-2 border border-[#00F0FF]/30 hover:border-[#00F0FF] transition-all bg-[#00F0FF]/5 hover:bg-[#00F0FF]/10"
              >
                <Send className="w-3.5 h-3.5" />
                Deploy Buffer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
