import React, { useState, useEffect } from 'react';
import { Cpu, Wifi, Shield, Settings, HelpCircle, HardDrive, Terminal, Layers, Compass, Activity, Timer, Wrench, ShieldCheck, Zap, Menu as MenuIcon, X, Palette, Cloud } from 'lucide-react';
import PovSimulator from './components/PovSimulator';
import FirmwareGenerator from './components/FirmwareGenerator';
import HardwareBOM from './components/HardwareBOM';
import MathEngine from './components/MathEngine';
import DashboardControl from './components/DashboardControl';
import SetupGuide from './components/SetupGuide';
import SetupWizard from './components/SetupWizard';
import EffectPalette from './components/EffectPalette';
import DriveIntegration from './components/DriveIntegration';
import { FirmwareConfig, SimulationConfig, DiagnosticData } from './types';

export default function App() {
  const getInitialFirmwareConfig = (): FirmwareConfig => {
    try {
      const saved = localStorage.getItem('pov_firmwareConfig');
      if (saved) return JSON.parse(saved);
    } catch {}
    
    return {
      ssid: 'WiFi-Hologram-Primary',
      wifiPass: 'ESP32DMAEngine',
      hostname: 'esp32s3-pov-node0',
      targetRpm: 1200,
      maxBrightness: 120, // 0..255
      numArms: 2,
      stripsPerArm: 3,
      ledsPerStrip: 45,
      ledType: 'WS2812B',
      pinLedArm1: 12,
      pinLedArm2: 13,
      pinHallSensor: 11,
      useLittleFS: true,
      dmaChannel: 1
    };
  };

  const [firmwareConfig, setFirmwareConfig] = useState<FirmwareConfig>(getInitialFirmwareConfig);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem('pov_firmwareConfig', JSON.stringify(firmwareConfig));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [firmwareConfig]);

  const getInitialSimConfig = (): SimulationConfig => {
    try {
      const saved = localStorage.getItem('pov_simConfig');
      if (saved) return JSON.parse(saved);
    } catch {}
    
    return {
      rpm: 1200,
      brightness: 120,
      motionBlur: 0.93,
      sensorJitterUs: 75,
      showLeds: true,
      currentPattern: 'clock',
      customText: 'SYS OPERATIONAL',
      ledPersistenceMs: 80,
      hwAcceleration: true
    };
  };

  const [simConfig, setSimConfig] = useState<SimulationConfig>(getInitialSimConfig);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem('pov_simConfig', JSON.stringify(simConfig));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [simConfig]);

  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData>({
    motorState: 'LOCKED',
    actualRpm: 1200,
    core0Load: 7.5,
    core1Load: 84.2,
    temperatureC: 42.5,
    busVoltage: 5.02,
    currentDrawAmps: 1.48,
    jitterUs: 32,
    fps: 60,
    framesRendered: 145020,
    wifiRssi: -54
  });

  const [sampledPolarData, setSampledPolarData] = useState<number[][][] | null>(() => {
    try {
      const saved = localStorage.getItem('pov_sampledPolarData');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  useEffect(() => {
    if (sampledPolarData) {
      try {
        localStorage.setItem('pov_sampledPolarData', JSON.stringify(sampledPolarData));
      } catch (e) {
        console.warn("Storage limit exceeded for Polar Data");
      }
    }
  }, [sampledPolarData]);

  const [showWizard, setShowWizard] = useState(() => {
    return localStorage.getItem('pov_wizard_completed') !== 'true';
  });

  // Sync firmware brightness slider with simulator brightness for intuitive linking
  const handleSimConfigChange = (newConfig: Partial<SimulationConfig>) => {
    setSimConfig((prev) => {
      const merged = { ...prev, ...newConfig };
      if (newConfig.brightness !== undefined) {
        setFirmwareConfig(f => ({ ...f, maxBrightness: newConfig.brightness! }));
      }
      return merged;
    });
  };

  const handleFirmwareConfigChange = (newConfig: Partial<FirmwareConfig>) => {
    setFirmwareConfig((prev) => {
      const merged = { ...prev, ...newConfig };
      if (newConfig.maxBrightness !== undefined) {
        setSimConfig(s => ({ ...s, brightness: newConfig.maxBrightness! }));
      }
      return merged;
    });
  };

  const handleSampleDataGenerated = (pixelArray: number[][][]) => {
    setSampledPolarData(pixelArray);
  };

  const [activeTab, setActiveTab] = useState<'simulator' | 'palette' | 'firmware' | 'hardware' | 'math' | 'guide' | 'cloud'>('simulator');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(() => {
    try {
      const saved = localStorage.getItem('pov_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved as any;
    } catch {}
    return 'system';
  });

  useEffect(() => {
    localStorage.setItem('pov_theme', theme);
    
    const applyTheme = (t: 'dark' | 'light' | 'system') => {
      const isLight = t === 'light' || (t === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
      if (isLight) {
        document.documentElement.classList.add('theme-light');
      } else {
        document.documentElement.classList.remove('theme-light');
      }
    };
    
    applyTheme(theme);
    
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handler = () => applyTheme('system');
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  const cycleTheme = () => {
    setTheme(t => {
      if (t === 'dark') return 'light';
      if (t === 'light') return 'system';
      return 'dark';
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-[#E0E2E5] flex flex-col font-sans selection:bg-[#00F0FF]/25 selection:text-[#00F0FF]" id="esp32-hologram-app-root">
      {/* Upper high-contrast structural header */}
      <header className="border-b border-[#2A2D33] bg-[#15171A] py-4 px-6 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#00F0FF] rounded-sm flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.2)] shrink-0 select-none">
              <span className="text-[#000] font-black text-sm tracking-tighter">POV</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-widest text-[#00F0FF]">AERO-SYNC CORE v4.2</span>
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm bg-[#2A2D33] text-[#8E9299] border border-[#2A2D33]">
                  STABLE
                </span>
              </div>
              <p className="font-mono text-[#8E9299] text-[11px] mt-0.5">ESP32-S3 // DUAL-CORE // DMA RETINAL RESOLVER // INTERRUPT POLAR TRANSFERS</p>
            </div>
          </div>

          {/* Quick specs banner */}
          <div className="flex items-center gap-4 md:gap-6 text-xs font-mono">
            <button
              onClick={cycleTheme}
              className="hidden sm:flex items-center gap-2 bg-[#15171A] hover:bg-[#2A2D33] text-[#8E9299] hover:text-[#E0E2E5] border border-[#2A2D33] hover:border-[#8E9299] transition-all px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider w-28 justify-center shrink-0"
            >
              {theme === 'dark' ? '☾ DARK' : theme === 'light' ? '☀ LIGHT' : '⚙ SYSTEM'}
            </button>
            <button
              onClick={() => setShowWizard(true)}
              className="hidden lg:flex items-center gap-2 bg-[#15171A] hover:bg-[#2A2D33] text-[#00F0FF] border border-[#00F0FF]/30 hover:border-[#00F0FF] transition-all px-4 py-1.5 font-mono text-[10px] uppercase font-bold tracking-wider"
            >
              LAUNCH WIZARD
            </button>
            
            <button 
              className="md:hidden flex items-center justify-center p-2 border border-[#2A2D33] bg-[#0E1012] text-[#8E9299] hover:text-[#00F0FF] hover:border-[#00F0FF] transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>

            <div className="hidden md:flex flex-col text-right">
              <span className="text-[#8E9299] text-[10px] uppercase tracking-wider">Rotor Matrix</span>
              <span className="text-slate-300 font-semibold font-mono">2 Arms // 6 Strips // 270 WS2812B</span>
            </div>
            <div className="h-8 w-px bg-[#2A2D33] hidden md:block" />
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[#8E9299] text-[10px] uppercase tracking-wider">I2S DMA Bus</span>
              <span className="text-[#00F0FF] font-bold">MULTITASK LOCK</span>
            </div>
            <div className="h-8 w-px bg-[#2A2D33] hidden sm:block" />
            <div className="flex flex-col text-right items-end">
              <div className="flex items-center space-x-1.5 mb-0.5">
                <div className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] animate-pulse"></div>
                <span className="text-[10px] uppercase font-bold text-[#E0E2E5]">WS:CONNECTED</span>
              </div>
              <span className="text-[10px] text-[#8E9299] hidden sm:inline">RSSI: -42dBm // 192.168.4.1</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Navigation Tabs */}
      <div className="border-b border-[#2A2D33] bg-[#0E1012] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 hidden md:flex gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {[
            { id: 'simulator', label: 'Dashboard & Sim', icon: <Terminal className="w-3.5 h-3.5" /> },
            { id: 'palette', label: 'Effect Palette', icon: <Palette className="w-3.5 h-3.5" /> },
            { id: 'firmware', label: 'Compile Firmware', icon: <HardDrive className="w-3.5 h-3.5" /> },
            { id: 'cloud', label: 'Cloud Depot (Drive)', icon: <Cloud className="w-3.5 h-3.5" /> },
            { id: 'hardware', label: 'Hardware BOM', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'math', label: 'Calculations', icon: <Activity className="w-3.5 h-3.5" /> },
            { id: 'guide', label: 'Setup Guide', icon: <HelpCircle className="w-3.5 h-3.5" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-2 px-6 py-3 font-mono text-[11px] uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-[#00F0FF] text-[#00F0FF] bg-[#1A1D24]'
                  : 'border-transparent text-[#8E9299] hover:text-[#E0E2E5] hover:bg-[#1A1D24]/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden flex flex-col absolute top-full left-0 right-0 bg-[#0E1012] border-b border-[#2A2D33] shadow-2xl">
            {[
              { id: 'simulator', label: 'Dashboard & Sim', icon: <Terminal className="w-4 h-4" /> },
              { id: 'palette', label: 'Effect Palette', icon: <Palette className="w-4 h-4" /> },
              { id: 'firmware', label: 'Compile Firmware', icon: <HardDrive className="w-4 h-4" /> },
              { id: 'cloud', label: 'Cloud Depot (Drive)', icon: <Cloud className="w-4 h-4" /> },
              { id: 'hardware', label: 'Hardware BOM', icon: <Layers className="w-4 h-4" /> },
              { id: 'math', label: 'Calculations', icon: <Activity className="w-4 h-4" /> },
              { id: 'guide', label: 'Setup Guide', icon: <HelpCircle className="w-4 h-4" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-start gap-3 px-6 py-4 font-mono text-xs uppercase tracking-wider transition-colors border-l-4 ${
                  activeTab === tab.id
                    ? 'border-[#00F0FF] text-[#00F0FF] bg-[#1A1D24]'
                    : 'border-transparent text-[#8E9299] hover:text-[#E0E2E5] hover:bg-[#1A1D24]/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <div className="flex border-t border-[#2A2D33]">
              <button
                onClick={() => { cycleTheme(); setIsMobileMenuOpen(false); }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 font-mono text-xs uppercase tracking-wider transition-colors border-l-4 border-transparent text-[#8E9299] hover:text-[#E0E2E5] hover:bg-[#1A1D24]/50 border-r border-[#2A2D33]"
              >
                {theme === 'dark' ? '☾ DARK' : theme === 'light' ? '☀ LIGHT' : '⚙ SYSTEM'}
              </button>
              <button
                onClick={() => { setShowWizard(true); setIsMobileMenuOpen(false); }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 font-mono text-xs uppercase tracking-wider transition-colors border-l-4 border-transparent text-[#00F0FF] hover:bg-[#1A1D24]/50"
              >
                <Zap className="w-4 h-4" />
                WIZARD
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Viewport */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            <div className="lg:col-span-6 xl:col-span-5 h-full">
              <PovSimulator 
                config={simConfig} 
                onChangeConfig={handleSimConfigChange}
                onSampleDataGenerated={handleSampleDataGenerated}
              />
            </div>
            <div className="lg:col-span-6 xl:col-span-7 h-full">
              <DashboardControl 
                simulationConfig={simConfig}
                onChangeSimConfig={handleSimConfigChange}
                firmwareConfig={firmwareConfig}
                onChangeFirmwareConfig={handleFirmwareConfigChange}
                diagnosticData={diagnosticData}
              />
            </div>
          </div>
        )}

        {activeTab === 'palette' && (
          <EffectPalette />
        )}

        {activeTab === 'firmware' && (
          <FirmwareGenerator 
            config={firmwareConfig} 
            onChangeConfig={handleFirmwareConfigChange}
            sampledPolarData={sampledPolarData}
            simConfig={simConfig}
            onChangeSimConfig={handleSimConfigChange}
          />
        )}

        {activeTab === 'cloud' && (
          <DriveIntegration 
            simConfig={simConfig}
            onChangeSimConfig={handleSimConfigChange}
            firmwareConfig={firmwareConfig}
            onChangeFirmwareConfig={handleFirmwareConfigChange}
          />
        )}

        {activeTab === 'hardware' && (
          <HardwareBOM initialLedsCount={270} />
        )}

        {activeTab === 'math' && (
          <MathEngine />
        )}

        {activeTab === 'guide' && (
          <SetupGuide />
        )}
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-[#2A2D33] bg-[#000] py-5 px-6 font-mono text-xs text-[#8E9299]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-center sm:text-left">
            &copy; 2026 ESP32 POV Display Platform Systems. Calibrated for High G-Load Centrifugal Dynamics.
          </span>
          <span className="flex items-center gap-2 text-[#00F0FF] py-1 px-3 bg-[#15171A] border border-[#2A2D33] rounded-sm text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            FREERTOS INTERRUPT ISOLATION HIGH PRIORITY SHIELD ACTIVE
          </span>
        </div>
      </footer>
      
      {/* Setup Wizard Modal Overlay */}
      {showWizard && (
        <SetupWizard 
          simConfig={simConfig}
          onChangeSimConfig={handleSimConfigChange}
          firmwareConfig={firmwareConfig}
          onChangeFirmwareConfig={handleFirmwareConfigChange}
          onComplete={() => {
            setShowWizard(false);
            localStorage.setItem('pov_wizard_completed', 'true');
          }} 
        />
      )}
    </div>
  );
}
