import React, { useState, useEffect } from 'react';
import { Aperture, Cpu, Power, Zap, DownloadCloud, Code2, MoveRight, Layers, ArrowRight, CheckCircle2, MonitorPlay, Wifi, Gauge } from 'lucide-react';
import { FirmwareConfig, SimulationConfig } from '../types';

interface SetupWizardProps {
  simConfig: SimulationConfig;
  onChangeSimConfig: (config: Partial<SimulationConfig>) => void;
  firmwareConfig: FirmwareConfig;
  onChangeFirmwareConfig: (config: Partial<FirmwareConfig>) => void;
  onComplete: () => void;
}

export default function SetupWizard({ simConfig, onChangeSimConfig, firmwareConfig, onChangeFirmwareConfig, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
  }, []);

  const completeStep = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      setIsVisible(false);
      setTimeout(onComplete, 300);
    }
  };

  const skip = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0C0E]/90 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-[#15171A] border border-[#2A2D33] shadow-2xl w-full max-w-2xl transform transition-all duration-300 ${isVisible ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2A2D33]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/50 flex items-center justify-center">
              <Aperture className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h2 className="font-mono text-sm uppercase tracking-widest text-[#00F0FF] font-bold">Aero-Sync Initialization</h2>
              <p className="font-mono text-[10px] text-[#8E9299] uppercase tracking-wider">Follow the setup sequence</p>
            </div>
          </div>
          <button 
            onClick={skip}
            className="font-mono text-[10px] text-[#8E9299] hover:text-[#E0E2E5] uppercase tracking-widest px-3 py-1 border border-transparent hover:border-[#2A2D33] transition-colors"
          >
            SKIP SETUP
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 md:p-8 h-[380px] overflow-y-auto overflow-x-hidden flex flex-col justify-center">
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[#1A1D21] border-2 border-[#00F0FF] flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                  <MonitorPlay className="w-8 h-8 text-[#00F0FF]" />
                </div>
              </div>
              <h3 className="font-mono text-xl text-center text-[#E0E2E5] uppercase tracking-widest mb-3">Welcome to Aero-Sync POV</h3>
              <p className="font-mono text-xs text-center text-[#8E9299] leading-relaxed max-w-md mx-auto uppercase mb-8">
                This guided wizard will assist you in setting up your holographic projection matrix, configuring the physical hardware layout, and preparing the firmware.
              </p>
              
              <div className="space-y-3 max-w-md mx-auto text-[#8E9299] text-xs font-mono uppercase">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#00F0FF]" />
                  <span>Configure Rotor & LED Layout</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#00F0FF]" />
                  <span>Select Initial Telemetry Pattern</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#00F0FF]" />
                  <span>Define Networking & MCU Params</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[#1A1D21] border-2 border-[#10B981] flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <Gauge className="w-8 h-8 text-[#10B981]" />
                </div>
              </div>
              <h3 className="font-mono text-xl text-center text-[#E0E2E5] uppercase tracking-widest mb-4">Hardware Profile</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
                <div className="space-y-2">
                  <label className="text-[10px] text-[#8E9299] font-mono uppercase tracking-wider">LEDs Per Strip</label>
                  <input 
                    type="range"
                    min="10" max="300" step="5"
                    value={firmwareConfig.ledsPerStrip}
                    onChange={(e) => onChangeFirmwareConfig({ ledsPerStrip: parseInt(e.target.value, 10) })}
                    className="w-full accent-[#10B981]"
                  />
                  <div className="text-right text-[#10B981] font-mono font-bold text-sm">{firmwareConfig.ledsPerStrip} px</div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-[#8E9299] font-mono uppercase tracking-wider">Target Spin Rate (RPM)</label>
                  <input 
                    type="range"
                    min="300" max="2400" step="100"
                    value={firmwareConfig.targetRpm}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      onChangeFirmwareConfig({ targetRpm: v });
                      onChangeSimConfig({ rpm: v });
                    }}
                    className="w-full accent-[#10B981]"
                  />
                  <div className="text-right text-[#10B981] font-mono font-bold text-sm">{firmwareConfig.targetRpm} RPM</div>
                </div>
              </div>

              <p className="font-mono text-[10px] text-center text-[#8E9299] mt-6 max-w-sm mx-auto uppercase border border-[#2A2D33] p-3">
                <strong className="text-[#10B981]">Note:</strong> Higher RPM yields less flicker but requires higher mechanical stability and more power.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[#1A1D21] border-2 border-[#FFB800] flex items-center justify-center shadow-[0_0_20px_rgba(255,184,0,0.2)]">
                  <Aperture className="w-8 h-8 text-[#FFB800]" />
                </div>
              </div>
              <h3 className="font-mono text-xl text-center text-[#E0E2E5] uppercase tracking-widest mb-4">Initial Display Pattern</h3>
              
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-w-lg mx-auto">
                {[
                  { id: 'test-card', label: 'Test Card' },
                  { id: 'logo', label: 'Cube Logo' },
                  { id: 'clock', label: 'Analog Clock' },
                  { id: 'spiral', label: 'Hypno Spiral' },
                  { id: 'fireball', label: 'Fireball' },
                  { id: 'sonar', label: 'Radar Sonar' },
                  { id: 'matrix', label: 'Matrix Code' },
                  { id: 'plasma', label: 'Plasma Flow' },
                  { id: 'rainbow', label: 'Rainbow Vortex' },
                  { id: 'eye', label: 'Sauron Eye' },
                  { id: 'kaleidoscope', label: 'Kaleidoscope' },
                  { id: 'lsd', label: 'Acid Trip' },
                  { id: 'wormhole', label: 'Wormhole' },
                  { id: 'audio-reactive', label: 'Audio Reactive' }
                ].map(ptn => (
                  <button
                    key={ptn.id}
                    onClick={() => onChangeSimConfig({ currentPattern: ptn.id })}
                    className={`p-3 border font-mono text-[10px] uppercase font-bold tracking-wider transition-colors ${
                      simConfig.currentPattern === ptn.id 
                      ? 'border-[#FFB800] text-[#FFB800] bg-[#FFB800]/10' 
                      : 'border-[#2A2D33] text-[#8E9299] hover:bg-[#2A2D33]/50 hover:text-[#E0E2E5]'
                    }`}
                  >
                    {ptn.label}
                  </button>
                ))}
              </div>

              {simConfig.currentPattern === 'test-card' && (
                <div className="mt-6 text-center font-mono text-[11px] text-[#8E9299] bg-[#1A1D21] p-3 border border-[#2A2D33] max-w-md mx-auto">
                  <span className="text-[#FFB800] block mb-1">Calibration Pattern Selected</span>
                  Optimized for verifying color gamut, motor timing, and strip alignment.
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[#1A1D21] border-2 border-[#9333EA] flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.2)]">
                  <Wifi className="w-8 h-8 text-[#9333EA]" />
                </div>
              </div>
              <h3 className="font-mono text-xl text-center text-[#E0E2E5] uppercase tracking-widest mb-4">Network & Telemetry</h3>
              
              <div className="max-w-md mx-auto space-y-4 font-mono text-xs">
                <div>
                  <label className="text-[10px] text-[#8E9299] uppercase tracking-wider block mb-1">WLAN SSID (Optional)</label>
                  <input 
                    type="text" 
                    value={firmwareConfig.ssid}
                    onChange={(e) => onChangeFirmwareConfig({ ssid: e.target.value })}
                    className="w-full bg-[#15171A] border border-[#2A2D33] focus:border-[#9333EA] focus:outline-none p-2 text-[#E0E2E5] transition-colors"
                    placeholder="IoT-Network-5G"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E9299] uppercase tracking-wider block mb-1">WLAN Password</label>
                  <input 
                    type="password" 
                    value={firmwareConfig.wifiPass}
                    onChange={(e) => onChangeFirmwareConfig({ wifiPass: e.target.value })}
                    className="w-full bg-[#15171A] border border-[#2A2D33] focus:border-[#9333EA] focus:outline-none p-2 text-[#E0E2E5] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E9299] uppercase tracking-wider block mb-1">Device Hostname</label>
                  <input 
                    type="text" 
                    value={firmwareConfig.hostname}
                    onChange={(e) => onChangeFirmwareConfig({ hostname: e.target.value })}
                    className="w-full bg-[#15171A] border border-[#2A2D33] focus:border-[#9333EA] focus:outline-none p-2 text-[#E0E2E5] transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer & Controls */}
        <div className="p-5 border-t border-[#2A2D33] bg-[#0E1012] flex items-center justify-between">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className={`h-1 w-6 transition-colors duration-300 ${
                  step >= i 
                  ? step === 1 ? 'bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]' 
                    : step === 2 ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]'
                    : step === 3 ? 'bg-[#FFB800] shadow-[0_0_8px_#FFB800]'
                    : 'bg-[#9333EA] shadow-[0_0_8px_#9333EA]'
                  : 'bg-[#2A2D33]'
                }`}
              />
            ))}
          </div>
          
          <div className="flex items-center gap-3">
             {step > 1 && (
               <button 
                 onClick={() => setStep(step - 1)}
                 className="font-mono text-[10px] uppercase font-bold tracking-wider px-4 py-2 hover:bg-[#2A2D33] transition-colors text-[#8E9299]"
               >
                 BACK
               </button>
             )}
            <button 
              onClick={completeStep}
              className={`flex items-center gap-2 text-[#000] font-mono text-[11px] uppercase tracking-widest font-bold px-6 py-2.5 transition-all ${
                step === 1 ? 'bg-[#00F0FF] hover:bg-[#E0E2E5] hover:shadow-[0_0_15px_#00F0FF]' :
                step === 2 ? 'bg-[#10B981] hover:bg-[#E0E2E5] hover:shadow-[0_0_15px_#10B981]' :
                step === 3 ? 'bg-[#FFB800] hover:bg-[#E0E2E5] hover:shadow-[0_0_15px_#FFB800]' :
                'bg-[#9333EA] hover:bg-[#E0E2E5] hover:shadow-[0_0_15px_#9333EA]'
              }`}
            >
              {step === 4 ? 'LAUNCH' : 'NEXT SEQUENCE'}
              {step === 4 ? <CheckCircle2 className="w-4 h-4 text-black" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
