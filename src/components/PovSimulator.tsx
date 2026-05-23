import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RefreshCw, Upload, Eye, EyeOff, Gauge } from 'lucide-react';
import { SimulationConfig } from '../types';

interface PovSimulatorProps {
  config: SimulationConfig;
  onChangeConfig: (newConfig: Partial<SimulationConfig>) => void;
  onSampleDataGenerated?: (pixelArray: number[][][]) => void; // Send polar data back to generate firmware header
}

export default function PovSimulator({ config, onChangeConfig, onSampleDataGenerated }: PovSimulatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [fps, setFps] = useState(60);
  const lastTimeRef = useRef<number>(0);
  const currentRpmRef = useRef<number>(0);
  const powerDrawRef = useRef<HTMLDivElement>(null);
  const powerBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Image element for uploaded files
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio reactive refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (config.micEnabled && !audioCtxRef.current) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          micStreamRef.current = stream;
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContext) return;
          const ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyser);
          
          analyser.fftSize = 256;
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
          audioDataRef.current = dataArray;
        }).catch(err => {
          console.error("Microphone access denied or error:", err);
          // Auto disable mic if permission denied
          if (onChangeConfig) {
            onChangeConfig({ micEnabled: false });
          }
        });
      }
    } else if (!config.micEnabled && audioCtxRef.current) {
      if (audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
      audioCtxRef.current = null;
      analyserRef.current = null;
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
    }

    return () => {
      // Don't clean up on every render, only unmount
    };
  }, [config.micEnabled, onChangeConfig]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Load image from config base64 on change
  useEffect(() => {
    if (config.uploadedImageBase64) {
      const img = new Image();
      img.onload = () => {
        setUploadedImage(img);
      };
      img.src = config.uploadedImageBase64;
    }
  }, [config.uploadedImageBase64]);

  // Read uploaded image pixels
  useEffect(() => {
    if (uploadedImage) {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 120, 120);
        
        // Draw image keeping ratio
        const scale = Math.min(120 / uploadedImage.width, 120 / uploadedImage.height);
        const w = uploadedImage.width * scale;
        const h = uploadedImage.height * scale;
        const x = (120 - w) / 2;
        const y = (120 - h) / 2;
        ctx.drawImage(uploadedImage, x, y, w, h);
        offscreenCanvasRef.current = canvas;
        
        // Generate pre-sampled polar data for C++ array header
        generatePolarPreset(canvas);
      }
    } else {
      offscreenCanvasRef.current = null;
      // Trigger preset code refresh
      generatePolarPreset(null);
    }
  }, [uploadedImage, config.currentPattern]);

  // Helper: Generates polar data that firmware code generator can display
  const generatePolarPreset = (sourceCanvas: HTMLCanvasElement | null) => {
    if (!onSampleDataGenerated) return;
    
    // We want 60 angular slices, 45 radial LEDs
    // Arm 1 handles indices 0..44, Arm 2 handles another 180 deg.
    // For simplicity, we sample a 3D matrix: [arm][slice_index][led_index] -> RGB (3 bytes)
    const slices = 60;
    const leds = 45;
    const res: number[][][] = []; // [slice][led][r,g,b]
    
    let ctx: CanvasRenderingContext2D | null = null;
    if (sourceCanvas) {
      ctx = sourceCanvas.getContext('2d');
    }
    
    for (let s = 0; s < slices; s++) {
      const angle = (s / slices) * Math.PI * 2;
      const sliceLeds: number[][] = [];
      
      for (let l = 0; l < leds; l++) {
        const radiusFraction = l / leds; // 0.0 to 1.0
        // Find corresponding coordinate in 120x120 canvas
        const posX = Math.cos(angle) * radiusFraction * 58 + 60;
        const posY = Math.sin(angle) * radiusFraction * 58 + 60;
        
        let r = 0, g = 0, b = 0;
        
        if (ctx) {
          try {
            const data = ctx.getImageData(Math.floor(posX), Math.floor(posY), 1, 1).data;
            r = data[0];
            g = data[1];
            b = data[2];
          } catch (e) {
            // Out of bounds
          }
        } else {
          // Generate procedural pattern for header code
          const pattern = config.currentPattern;
          if (pattern === 'spiral') {
            const spiralVal = (angle * 3 + radiusFraction * 12) % (Math.PI * 2);
            if (spiralVal < 1.5) {
              r = Math.floor(255 * radiusFraction);
              g = 0;
              b = 255;
            }
          } else if (pattern === 'test-card') {
            const ring = Math.floor(radiusFraction * 6);
            if (ring % 2 === 0) {
              r = s % 3 === 0 ? 255 : 0;
              g = s % 3 === 1 ? 255 : 0;
              b = s % 3 === 2 ? 255 : 0;
            } else {
              r = 100; g = 100; b = 100;
            }
          } else if (pattern === 'audio-reactive') {
             r = 0; g = Math.floor(Math.abs(Math.sin((radiusFraction + angle) * 5)) * 255); b = 255;
          } else if (pattern === 'nuclear') {
            const normalizedAngle = angle % (Math.PI * 2);
            const isInBlade = (normalizedAngle % (Math.PI * 2 / 3)) < (Math.PI / 3);
            if (isInBlade && radiusFraction > 0.25 && radiusFraction < 0.85) {
              r = 255; g = 190; b = 0; // Hazard Yellow
            } else if (radiusFraction < 0.15) {
              r = 255; g = 190; b = 0;
            }
          } else if (pattern === 'fireball') {
            const rotatedAngle = angle % (Math.PI * 2);
            if (radiusFraction > 0.1) {
              const flameIntensity = Math.exp(-rotatedAngle * 1.5) * (1 - radiusFraction) * 3.5;
              if (flameIntensity > 0.4) {
                r = Math.floor(Math.min(255, 255 * flameIntensity));
                g = Math.floor(Math.min(255, 120 * flameIntensity * (1 - radiusFraction)));
                b = 10;
              }
            }
          } else if (pattern === 'sonar') {
            if (Math.abs(radiusFraction - 0.3) < 0.05 || Math.abs(radiusFraction - 0.6) < 0.05 || Math.abs(radiusFraction - 0.9) < 0.05) {
              r = 0; g = 150; b = 0;
            } else {
              r = 0; g = 10; b = 0;
            }
          } else if (pattern === 'matrix') {
            const inStream = Math.cos((angle * 10) % (Math.PI * 2) * 8) > 0.8;
            if (inStream) {
               r = 0; g = 150; b = 0;
            }
          } else if (pattern === 'plasma') {
            const noise = 
              Math.sin(radiusFraction * 12) +
              Math.cos(angle * 4) +
              Math.sin((Math.cos(angle)*radiusFraction) * 5 + (Math.sin(angle)*radiusFraction) * 5);
            const val = (noise + 3) / 6;
            r = Math.floor(Math.sin(val * Math.PI) * 255);
            g = Math.floor(Math.sin(val * Math.PI + 2) * 255);
            b = Math.floor(Math.sin(val * Math.PI + 4) * 255);
          } else if (pattern === 'rainbow') {
            const spiral = angle * 2 + radiusFraction * 15;
            r = Math.floor((Math.sin(spiral) * 0.5 + 0.5) * 255);
            g = Math.floor((Math.sin(spiral + 2 * Math.PI / 3) * 0.5 + 0.5) * 255);
            b = Math.floor((Math.sin(spiral + 4 * Math.PI / 3) * 0.5 + 0.5) * 255);
          } else if (pattern === 'eye') {
            const isPupil = radiusFraction < 0.4 && Math.abs(Math.sin(angle)) < 0.15;
            if (isPupil) {
               r = 0; g = 0; b = 0;
            } else if (radiusFraction < 0.5) {
               const noise = Math.sin(angle * 30) * Math.cos(angle * 15);
               r = 220 + noise * 30;
               g = 50 + noise * 20;
               b = 0;
            } else if (radiusFraction < 0.8) {
               const noise = Math.cos(angle * 10) * (0.8 - radiusFraction);
               r = 150 * noise * 2; g = 0; b = 0;
            }
          } else if (pattern === 'kaleidoscope') {
            const time = 0; // Not animating real-time in 1D sampler here
            const slices = 6;
            const sliceAngle = (Math.PI * 2) / slices;
            let positiveAngle = angle;
            if (positiveAngle < 0) positiveAngle += Math.PI * 2;
            const foldedA = Math.abs((positiveAngle % sliceAngle) - (sliceAngle / 2));
            const nxFolded = Math.cos(foldedA) * radiusFraction;
            const nyFolded = Math.sin(foldedA) * radiusFraction;
            const noise = Math.sin(nxFolded * 10 - time * 2) * Math.cos(nyFolded * 10 + time * 3) + Math.sin(radiusFraction * 15 - time * 5);
            const v = (noise + 3) / 6;
            r = Math.floor((Math.sin(v * Math.PI) * 0.5 + 0.5) * 255);
            g = Math.floor((Math.sin(v * Math.PI + 2) * 0.5 + 0.5) * 255);
            b = Math.floor((Math.sin(v * Math.PI + 4) * 0.5 + 0.5) * 255);
          } else if (pattern === 'lsd') {
            const time = 0;
            const nx = Math.cos(angle) * radiusFraction;
            const ny = Math.sin(angle) * radiusFraction;
            const v1 = Math.sin(nx * 10 + time);
            const v2 = Math.cos(ny * 10 + time * 0.5);
            const v3 = Math.sin(radiusFraction * 20 - time);
            const v = v1 + v2 + v3;
            r = Math.floor((Math.sin(v) * 0.5 + 0.5) * 255);
            g = Math.floor((Math.sin(v + 2) * 0.5 + 0.5) * 255);
            b = Math.floor((Math.sin(v + 4) * 0.5 + 0.5) * 255);
          } else if (pattern === 'fractal-flame') {
            const nx = Math.cos(angle) * radiusFraction;
            const ny = Math.sin(angle) * radiusFraction;
            let zz = Math.abs(Math.sin(nx * 8) * Math.cos(ny * 8)) + Math.abs(Math.cos(nx * 4 + ny * 4));
            r = Math.min(255, Math.floor(zz * 100));
            g = Math.min(255, Math.floor(Math.pow(zz, 1.5) * 50));
            b = Math.min(255, Math.floor(zz * 20));
          } else if (pattern === 'hyper-crystal') {
            const nx = Math.cos(angle) * radiusFraction;
            const ny = Math.sin(angle) * radiusFraction;
            const f1 = Math.sin((nx + ny) * 12);
            const f2 = Math.cos((nx - ny) * 12);
            const f3 = Math.sin(Math.sqrt(nx*nx + ny*ny) * 20);
            const w = (f1 + f2 + f3 + 3) / 6;
            r = Math.min(255, Math.floor((Math.sin(w*Math.PI*4) * 0.5 + 0.5) * 255));
            g = Math.min(255, Math.floor((Math.cos(w*Math.PI*2) * 0.5 + 0.5) * 255));
            b = 255;
          } else if (pattern === 'wormhole') {
            const depth = 1 / (radiusFraction + 0.01);
            const aOffset = angle + depth * 0.5;
            const val = Math.sin(aOffset * 5) * Math.cos(depth * 3);
            if (val > 0.5) {
              r = 255; g = 0; b = 200;
            } else if (val > -0.5 && val < 0.5) {
              r = Math.min(255, Math.floor(depth * 20)); g = 0; b = Math.min(255, Math.floor(depth * 40));
            } else {
              r = 0; g = 0; b = 0;
            }
          } else {
            // Default concentric rings
            if (Math.abs(radiusFraction - 0.5) < 0.05 || Math.abs(radiusFraction - 0.8) < 0.04) {
              r = 0; g = 255; b = 255;
            }
          }
        }
        
        sliceLeds.push([r, g, b]);
      }
      res.push(sliceLeds);
    }
    
    onSampleDataGenerated(res);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64 = event.target.result as string;
        const img = new Image();
        img.onload = () => {
          setUploadedImage(img);
          onChangeConfig({ currentPattern: 'uploaded', uploadedImageBase64: base64 });
        };
        img.src = base64;
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: !config.hwAcceleration });
    if (!ctx) return;

    let animationId: number;
    let localAngle = rotationAngle;

    const render = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // FPS tracking
      if (dt > 0) {
        setFps(Math.round(1 / dt));
      }

      // Audio processing
      let currentAudioLevel = 0;
      let freqData: Uint8Array | null = null;
      if (config.micEnabled && analyserRef.current && audioDataRef.current) {
        analyserRef.current.getByteFrequencyData(audioDataRef.current);
        freqData = audioDataRef.current;
        let sum = 0;
        for (let i = 0; i < audioDataRef.current.length; i++) {
          sum += audioDataRef.current[i];
        }
        currentAudioLevel = sum / (audioDataRef.current.length * 255);
      }

      // 1. Exponential retinal persistence decay (Physics-accurate & Frame-rate independent)
      // Standard overlays flicker or fade too fast if frame times (dt) fluctuate.
      // We calculate continuous exponential decay based on LED persistence in milliseconds.
      const persistenceMs = config.ledPersistenceMs || 80;
      const decayFraction = Math.max(0.01, Math.min(0.99, Math.exp(-dt * (1000 / persistenceMs))));
      const decayOpacity = 1 - decayFraction;

      ctx.fillStyle = `rgba(8, 8, 12, ${isPlaying && config.rpm > 100 ? decayOpacity : 1})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) - 20;

      // Helper to sample coordinates (normalized x/y: -1.0 to 1.0)
      const samplePattern = (nx: number, ny: number, angleRad: number, radiusFract: number) => {
        // Procedural samplers
        const pattern = config.currentPattern;

        // Custom image uploader
        if (pattern === 'uploaded' && offscreenCanvasRef.current) {
          const offscreen = offscreenCanvasRef.current;
          const oCtx = offscreen.getContext('2d');
          if (oCtx) {
            // Find coordinate on 120x120 canvas
            const sX = Math.floor(nx * 58 + 60);
            const sY = Math.floor(ny * 58 + 60);
            if (sX >= 0 && sX < 120 && sY >= 0 && sY < 120) {
              const p = oCtx.getImageData(sX, sY, 1, 1).data;
              return { r: p[0], g: p[1], b: p[2] };
            }
          }
          return { r: 50, g: 50, b: 60 };
        }

        // Animated Spiral
        if (pattern === 'spiral') {
          const t = timestamp / 400;
          const dist = Math.sqrt(nx * nx + ny * ny);
          const angle = Math.atan2(ny, nx) - t;
          const wave = Math.sin(6 * Math.log(dist + 0.05) - angle * 2);
          if (wave > 0.4) {
            return {
              r: Math.floor(100 + 155 * Math.sin(t)),
              g: Math.floor(50 + 80 * Math.cos(dist * 6)),
              b: 255
            };
          }
          return { r: 0, g: 0, b: 0 };
        }

        if (pattern === 'audio-reactive') {
          // Audio visualizer using frequency bins & microphone
          if (!config.micEnabled) {
             return { r: 10, g: 10, b: 20 };
          }
          // Read from our computed freqData
          if (freqData && freqData.length > 0) {
             // We want frequencies to radiate outward from center
             const binIndex = Math.floor(radiusFract * (freqData.length * 0.5)); // focus on lower half of FFT frequencies
             const val = Math.min(255, freqData[binIndex] * 1.5) / 255.0; 
             
             // Base ripple color based on global audioLevel
             const anglePhase = angleRad + timestamp * 0.005;
             const volumeReact = currentAudioLevel * 2.0;
             const r = Math.floor(255 * val * (1 - radiusFract));
             const g = Math.floor(255 * val * Math.sin(anglePhase) * volumeReact);
             const b = Math.floor(255 * val * Math.cos(anglePhase + radiusFract));
             return { r: Math.max(0, Math.min(255, r)), g: Math.max(0, Math.min(255, g)), b: Math.max(0, Math.min(255, b)) };
          }
          return { r: 0, g: 0, b: 0 };
        }

        // Diagnostic Grid Test Card
        if (pattern === 'test-card') {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          
          // Concentric circles
          if (Math.abs(rFract - 0.25) < 0.015 || Math.abs(rFract - 0.5) < 0.015 || Math.abs(rFract - 0.75) < 0.015 || Math.abs(rFract - 0.95) < 0.015) {
            return { r: 0, g: 255, b: 255 }; // Cyan gridlines
          }
          // Crosshairs
          if (Math.abs(nx) < 0.015 || Math.abs(ny) < 0.015) {
            return { r: 255, g: 0, b: 128 }; // Magenta lines
          }

          // Pie slices color wheel
          const slice = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8);
          if (rFract < 0.8) {
            switch (slice) {
              case 0: return { r: 255, g: 0, b: 0 };
              case 1: return { r: 255, g: 128, b: 0 };
              case 2: return { r: 255, g: 255, b: 0 };
              case 3: return { r: 0, g: 255, b: 0 };
              case 4: return { r: 0, g: 255, b: 255 };
              case 5: return { r: 0, g: 0, b: 255 };
              case 6: return { r: 128, g: 0, b: 255 };
              case 7: return { r: 255, g: 0, b: 255 };
            }
          }
          return { r: 20, g: 20, b: 25 };
        }

        // Real-Time Tech Clock Face
        if (pattern === 'clock') {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          const positiveAngle = a < 0 ? a + Math.PI * 2 : a;
          const d = new Date();
          const ms = d.getMilliseconds() / 1000;
          const sec = d.getSeconds() + ms;
          const min = d.getMinutes() + sec / 60;
          const hour = (d.getHours() % 12) + min / 60;

          // Outermost gear ticker
          if (rFract > 0.88 && rFract < 0.94) {
            const ticks = 60;
            const tAngle = Math.floor((positiveAngle / (Math.PI * 2)) * ticks);
            const isTick = (tAngle % 5 === 0) ? (positiveAngle % (Math.PI * 2 / ticks) < 0.04) : (positiveAngle % (Math.PI * 2 / ticks) < 0.012);
            if (isTick) return { r: 0, g: 200, b: 255 };
          }

          // Second Hand (Neon Pulsing Dot + Line)
          const secAngle = (sec / 60) * Math.PI * 2 - Math.PI / 2;
          const secDiff = Math.abs(positiveAngle - (secAngle < 0 ? secAngle + Math.PI * 2 : secAngle));
          if (secDiff < 0.04 && rFract < 0.85 && rFract > 0.15) {
            return { r: 255, g: 80, b: 0 }; // Vivid orange sweep
          }

          // Minute Hand (Cyan)
          const minAngle = (min / 60) * Math.PI * 2 - Math.PI / 2;
          const minDiff = Math.abs(positiveAngle - (minAngle < 0 ? minAngle + Math.PI * 2 : minAngle));
          if (minDiff < 0.06 && rFract < 0.72 && rFract > 0.15) {
            return { r: 0, g: 255, b: 200 };
          }

          // Hour Hand (Cyan-Blue thick)
          const hourAngle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
          const hourDiff = Math.abs(positiveAngle - (hourAngle < 0 ? hourAngle + Math.PI * 2 : hourAngle));
          if (hourDiff < 0.09 && rFract < 0.5 && rFract > 0.15) {
            return { r: 0, g: 150, b: 255 };
          }

          // Concentric neon rings
          if (Math.abs(rFract - 0.85) < 0.01 || Math.abs(rFract - 0.15) < 0.015) {
            return { r: 0, g: 100, b: 255 };
          }

          // Hologram Text Indicator "UTC ONLINE" / "SYS OK"
          if (rFract > 0.18 && rFract < 0.45) {
            // Render text procedural ring
            // Let's draw horizontal indicator directly over the center disk
            if (Math.abs(ny) < 0.08 && Math.abs(nx) < 0.4) {
              return { r: 0, g: 255, b: 150 }; // Green HUD bar
            }
          }

          return { r: 5, g: 10, b: 15 };
        }

        // Rotating Nuclear warning circle
        if (pattern === 'nuclear') {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          const positiveAngle = (a < 0 ? a + Math.PI * 2 : a) + timestamp / 500;
          const modAngle = positiveAngle % (Math.PI * 2);

          // Standard tri-foil hazard shape
          const inTriLeif = (modAngle % (Math.PI * 2 / 3)) < (Math.PI / 3);
          if (rFract < 0.15) {
            return { r: 255, g: 180, b: 0 }; // Yellow center cap
          }
          if (rFract > 0.28 && rFract < 0.82 && inTriLeif) {
            return { r: 255, g: 180, b: 0 }; // Yellow blades
          }
          if (Math.abs(rFract - 0.88) < 0.015) {
            return { r: 255, g: 180, b: 0 }; // Yellow outer ring
          }
          return { r: 5, g: 5, b: 5 };
        }

        // Earth Globe Globe spinning
        if (pattern === 'globe') {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          const posAngle = a < 0 ? a + Math.PI * 2 : a;
          const rotationOffset = timestamp / 1400; // Continents drift
          const mapX = (posAngle + rotationOffset) % (Math.PI * 2);
          
          // Generate procedural continents
          const longitudeVal = Math.sin(mapX * 3.5) * Math.cos(rFract * Math.PI) * 1.5;
          const noiseGrid = Math.cos(mapX * 1.5 + rFract * 4) + Math.sin(mapX * 5 - rFract * 8);
          
          if (rFract < 0.85) {
            if (longitudeVal + noiseGrid > 0.2) {
              return { r: 34, g: 197, b: 94 }; // Green landmass
            } else {
              return { r: 29, g: 78, b: 216 }; // Blue ocean
            }
          }
          if (Math.abs(rFract - 0.87) < 0.01) {
            return { r: 255, g: 255, b: 255 }; // Atmosphere glow
          }
          return { r: 0, g: 0, b: 0 };
        }

        // Fireball / Comet Ring
        if (pattern === 'fireball') {
          const a = Math.atan2(ny, nx);
          const positiveAngle = a < 0 ? a + Math.PI * 2 : a;
          const rotateOffset = timestamp / 200;
          const rotatedAngle = (positiveAngle + rotateOffset) % (Math.PI * 2);
          
          if (radiusFract > 0.1) {
            const noise = Math.sin(rotatedAngle * 4 - radiusFract * 10) * Math.cos(rotatedAngle * 8 + radiusFract * 5);
            // Main tail calculation depending on rotation angle
            // So we see a sweeping tail
            const flameIntensity = Math.exp(-rotatedAngle * 1.5) * (1 - radiusFract) * 3.5;
            
            if (flameIntensity + noise * 0.2 > 0.4) {
              return { 
                r: Math.min(255, 255 * flameIntensity), 
                g: Math.min(255, 120 * flameIntensity * (1 - radiusFract)), 
                b: 10 
              };
            }
          }
          return { r: 5, g: 1, b: 0 };
        }

        // Radar / Sonar Pulse
        if (pattern === 'sonar') {
          const a = Math.atan2(ny, nx);
          const positiveAngle = a < 0 ? a + Math.PI * 2 : a;
          const rotateOffset = timestamp / 800;
          // Radar sweeps around
          const scanAngle = (rotationAngle * 0.1 - rotateOffset * 3) % (Math.PI * 2);
          const scanAnglePos = (scanAngle < 0) ? scanAngle + Math.PI * 2 : scanAngle;
          
          let diff = scanAnglePos - positiveAngle;
          if (diff < 0) diff += Math.PI * 2;
          
          const inSweep = diff > 0 && diff < Math.PI / 2;
          
          // Concentric target rings at 0.3, 0.6, 0.9 radius
          if (Math.abs(radiusFract - 0.3) < 0.015 || Math.abs(radiusFract - 0.6) < 0.015 || Math.abs(radiusFract - 0.9) < 0.015) {
            return { r: 0, g: 150, b: 0 };
          }
          
          // Crosshairs
          if (Math.abs(nx) < 0.005 || Math.abs(ny) < 0.005) {
            return { r: 0, g: 80, b: 0 };
          }
          
          // Fixed pseudo-random "blips" based on coordinates
          const isBlip = Math.sin(radiusFract * 80) * Math.cos(positiveAngle * 25) > 0.97 && radiusFract < 0.9 && radiusFract > 0.1;
          
          if (inSweep) {
             const sweepIntensity = 1 - (diff / (Math.PI / 2));
             if (isBlip) return { r: 100, g: 255, b: 100 }; // Bright blips
             return { r: 0, g: Math.floor(100 * sweepIntensity), b: 0 }; // Fading sweep trail
          }
          
          // Lingering blip green glow
          if (isBlip && diff < Math.PI) {
            return { r: 0, g: Math.floor(180 * (1 - diff/Math.PI)), b: 0 };
          }
          
          return { r: 0, g: 10, b: 0 };
        }

        // Circular Text Ring
        if (pattern === 'matrix') {
          const a = Math.atan2(ny, nx);
          const positiveAngle = a < 0 ? a + Math.PI * 2 : a;
          const rotateOffset = timestamp / 1000;
          const rotatedAngle = (positiveAngle * 10 - rotateOffset * 3) % (Math.PI * 2);
          
          const fall = (radiusFract * 8 - (timestamp / 500) * (Math.sin(positiveAngle * 10) * 0.5 + 0.5)) % 1.0;
          const inStream = Math.cos(rotatedAngle * 8) > 0.8;
          
          if (inStream) {
             const intensity = fall < 0 ? 1 + fall : fall; // 0 to 1 down the stream
             // Occasional bright "head"
             if (intensity > 0.9) return { r: 150, g: 255, b: 150 };
             return { r: 0, g: Math.floor(intensity * 255), b: 0 };
          }
          return { r: 0, g: 0, b: 0 };
        }

        if (pattern === 'plasma') {
          const a = Math.atan2(ny, nx);
          const time = timestamp / 800;
          
          const noise = 
            Math.sin(radiusFract * 12 + time) +
            Math.cos(a * 4 + time * 0.5) +
            Math.sin(nx * 5 + ny * 5 + time);

          const val = (noise + 3) / 6; // normalize roughly 0-1
          
          return {
            r: Math.floor(Math.sin(val * Math.PI) * 255),
            g: Math.floor(Math.sin(val * Math.PI + 2) * 255),
            b: Math.floor(Math.sin(val * Math.PI + 4) * 255)
          };
        }

        if (pattern === 'rainbow') {
          const a = Math.atan2(ny, nx);
          const time = timestamp / 1000;
          
          const spiral = a * 2 + radiusFract * 15 - time * 5;
          
          return {
            r: Math.floor((Math.sin(spiral) * 0.5 + 0.5) * 255),
            g: Math.floor((Math.sin(spiral + 2 * Math.PI / 3) * 0.5 + 0.5) * 255),
            b: Math.floor((Math.sin(spiral + 4 * Math.PI / 3) * 0.5 + 0.5) * 255)
          };
        }

        if (pattern === 'eye') {
          const time = timestamp / 500;
          // Sauron-like eye
          const a = Math.atan2(ny, nx);
          const distFromCenter = radiusFract;
          
          // Slit pupil
          const isPupil = distFromCenter < 0.4 && Math.abs(Math.sin(a)) < 0.15;
          if (isPupil) return { r: 0, g: 0, b: 0 };
          
          // Iris iris
          if (distFromCenter < 0.5) {
            const noise = Math.sin(a * 30 + time * 2) * Math.cos(a * 15 - time);
            return {
               r: 220 + noise * 30,
               g: 50 + noise * 20,
               b: 0
            };
          }
          
          // Outskirts
          if (distFromCenter < 0.8) {
            const noise = Math.cos(a * 10 - time) * (0.8 - distFromCenter);
            return { r: 150 * noise * 2, g: 0, b: 0 };
          }
          return { r: 0, g: 0, b: 0 };
        }

        if (pattern === 'kaleidoscope') {
          const a = Math.atan2(ny, nx);
          const time = timestamp / 1000;
          const slices = 6;
          const sliceAngle = (Math.PI * 2) / slices;
          let positiveAngle = a;
          if (positiveAngle < 0) positiveAngle += Math.PI * 2;
          const foldedA = Math.abs((positiveAngle % sliceAngle) - (sliceAngle / 2));
          const nxFolded = Math.cos(foldedA) * radiusFract;
          const nyFolded = Math.sin(foldedA) * radiusFract;
          const noise = Math.sin(nxFolded * 10 - time * 2) * Math.cos(nyFolded * 10 + time * 3) + Math.sin(radiusFract * 15 - time * 5);
          const v = (noise + 3) / 6;
          return {
            r: Math.floor((Math.sin(v * Math.PI) * 0.5 + 0.5) * 255),
            g: Math.floor((Math.sin(v * Math.PI + 2) * 0.5 + 0.5) * 255),
            b: Math.floor((Math.sin(v * Math.PI + 4) * 0.5 + 0.5) * 255)
          };
        }

        if (pattern === 'lsd') {
          const time = timestamp / 800;
          const v1 = Math.sin(nx * 10 + time);
          const v2 = Math.cos(ny * 10 + time * 0.5);
          const v3 = Math.sin(radiusFract * 20 - time);
          const v = v1 + v2 + v3;
          return {
            r: Math.floor((Math.sin(v) * 0.5 + 0.5) * 255),
            g: Math.floor((Math.sin(v + 2) * 0.5 + 0.5) * 255),
            b: Math.floor((Math.sin(v + 4) * 0.5 + 0.5) * 255)
          };
        }

        if (pattern === 'fractal-flame') {
          const time = timestamp / 1000;
          let zz = Math.abs(Math.sin(nx * 8 + time) * Math.cos(ny * 8 - time * 0.5)) + Math.abs(Math.cos(nx * 4 - ny * 4 + time * 1.5));
          return {
            r: Math.min(255, Math.floor(zz * 120 + Math.sin(time) * 40)),
            g: Math.min(255, Math.floor(Math.pow(zz, 1.5) * 60)),
            b: Math.min(255, Math.floor(zz * 30 + Math.cos(time * 0.7) * 40))
          };
        }

        if (pattern === 'hyper-crystal') {
          const time = timestamp / 1200;
          const f1 = Math.sin((nx + ny) * 12 + time * 3);
          const f2 = Math.cos((nx - ny) * 12 - time * 2);
          const f3 = Math.sin(radiusFract * 20 + time * 4);
          const w = (f1 + f2 + f3 + 3) / 6;
          return {
            r: Math.min(255, Math.floor((Math.sin(w*Math.PI*4 + time) * 0.5 + 0.5) * 255)),
            g: Math.min(255, Math.floor((Math.cos(w*Math.PI*2 - time) * 0.5 + 0.5) * 255)),
            b: Math.min(255, Math.floor(w * 255 + 50))
          };
        }

        if (pattern === 'wormhole') {
          const time = timestamp / 500;
          const a = Math.atan2(ny, nx);
          const depth = 1 / (radiusFract + 0.01);
          const aOffset = a + depth * 0.5;
          const val = Math.sin(aOffset * 5 + time * 2) * Math.cos(depth * 3 - time * 4);
          if (val > 0.5) return { r: 255, g: 0, b: 200 };
          if (val > -0.5 && val < 0.5) return { r: Math.min(255, depth * 20), g: 0, b: Math.min(255, depth * 40) };
          return { r: 0, g: 0, b: 0 };
        }

        if (pattern === 'custom-text' && config.customText) {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          const positiveAngle = a < 0 ? a + Math.PI * 2 : a;
          
          // Render character outline around the outer band (0.65 to 0.85 radius)
          if (rFract > 0.65 && rFract < 0.85) {
            const txt = config.customText.toUpperCase();
            const charSpacing = (Math.PI * 2) / Math.max(txt.length, 12);
            const index = Math.floor(positiveAngle / charSpacing);
            const offsetInChar = (positiveAngle % charSpacing) / charSpacing; // 0..1
            
            // Simple modular segment font emulation
            const char = txt[index % txt.length] || ' ';
            if (char !== ' ' && offsetInChar > 0.2 && offsetInChar < 0.8) {
              // Standard pixelated visual dots
              const rowIdx = Math.floor((rFract - 0.65) / 0.04); // 0..5 rows
              // Dummy display matrices for characters to make it look hyper realistic
              const alphabet: Record<string, number[]> = {
                'A': [0x1F, 0x0A, 0x0A, 0x0A, 0x1F],
                'B': [0x1F, 0x15, 0x15, 0x15, 0x0A],
                'C': [0x0E, 0x11, 0x11, 0x11, 0x11],
                'D': [0x1F, 0x11, 0x11, 0x11, 0x0E],
                'E': [0x1F, 0x15, 0x15, 0x11, 0x11],
                'H': [0x1F, 0x04, 0x04, 0x04, 0x1F],
                'I': [0x11, 0x11, 0x1F, 0x11, 0x11],
                'L': [0x1F, 0x10, 0x10, 0x10, 0x10],
                'O': [0x0E, 0x11, 0x11, 0x11, 0x0E],
                'P': [0x1F, 0x09, 0x09, 0x09, 0x06],
                'S': [0x12, 0x15, 0x15, 0x15, 0x09],
                'T': [0x01, 0x01, 0x1F, 0x01, 0x01],
                'U': [0x1F, 0x10, 0x10, 0x10, 0x1F],
                'X': [0x1B, 0x04, 0x04, 0x04, 0x1B],
                'Y': [0x03, 0x04, 0x18, 0x04, 0x03],
                'Z': [0x11, 0x19, 0x15, 0x13, 0x11]
              };
              const colIdx = Math.floor(offsetInChar * 5); // 5 cols
              const code = alphabet[char] ? alphabet[char][colIdx] : 0x15;
              if ((code & (1 << rowIdx)) !== 0) {
                return { r: 255, g: 0, b: 128 }; // Magenta text glow
              }
            }
          }
          if (Math.abs(rFract - 0.6) < 0.015 || Math.abs(rFract - 0.9) < 0.015) {
            return { r: 0, g: 180, b: 255 }; // Light blue borders
          }
          return { r: 0, g: 0, b: 0 };
        }

        // Default: Concentric procedural energy core
        if (Math.sin(radiusFract * 15 - timestamp / 150) > 0.75) {
          return { r: 0, g: 255, b: 180 };
        }
        return { r: 5, g: 5, b: 8 };
      };

      // 2. Physics-Based Rotational Mechanics & Sub-Stepping Frame Interpolation
      const targetRpm = config.rpm;
      
      // Implement Motor Velocity Ramp-up (Inertia)
      if (!currentRpmRef.current) currentRpmRef.current = 0;
      let currentRpm = currentRpmRef.current;
      
      const maxAccel = 600 * dt; // max RPM change per second
      if (isPlaying) {
        if (currentRpm < targetRpm) {
          currentRpm = Math.min(targetRpm, currentRpm + maxAccel);
        } else if (currentRpm > targetRpm) {
          currentRpm = Math.max(targetRpm, currentRpm - maxAccel);
        }
      } else {
        currentRpm = Math.max(0, currentRpm - maxAccel * 0.8); // Coast to stop when paused
      }
      currentRpmRef.current = currentRpm;
      
      const rpm = currentRpm;
      const anglePerSec = (rpm / 60) * Math.PI * 2; // Rad per sec
      const angleThisFrame = anglePerSec * dt;
      
      // Calculate how many sub-steps are needed based on speed to ensure complete spatial fill
      // Max 60 sub-steps per render cycle to avoid locking the UI thread
      let numSubsteps = 1;
      if (rpm > 50) {
        numSubsteps = Math.min(32, Math.ceil(Math.abs(angleThisFrame) * 200)); // Dynamic sub-stepping!
      }

      const pulseFreq = timestamp / 300;
      const baseJitterRad = ((Math.random() - 0.5) * config.sensorJitterUs / 1000000) * anglePerSec; // Real sensor microsecond jitter

      const numArms = 2;
      const stripsPerArm = 3;
      const ledsPerStrip = 45;
      
      let frameLedCurrentMa = 0; // Accumulate power draw for this frame

      // Step through all angular subdivisions of this frame slice
      for (let step = 0; step < numSubsteps; step++) {
        const stepFactor = numSubsteps > 1 ? step / (numSubsteps - 1) : 1;
        const currentSweptAngle = localAngle + angleThisFrame * stepFactor + baseJitterRad;

        // Draw 2 Arms (Arm A: currentSweptAngle, Arm B: currentSweptAngle + PI)
        for (let arm = 0; arm < numArms; arm++) {
          const armAngle = currentSweptAngle + (arm * Math.PI * 2 / numArms);

          // Draw 3 Parallel LED Strips per arm: Left, Center, Right
          // Placed adjacent to simulate commercial dense rendering and antialiasing
          for (let strip = 0; strip < stripsPerArm; strip++) {
            // High-end stagger: Center strip is straight, Left/Right are offset by a tiny radial stagger (1.8 degrees)
            const stripStaggerRad = (strip - (stripsPerArm - 1) / 2) * 0.024;
            const absoluteStripAngle = armAngle + stripStaggerRad;

            // Draw 45 LEDs per strip (Outwards from central axis of spin)
            // Starts at radius 8px buffer, extends to maxRadius
            for (let i = 0; i < ledsPerStrip; i++) {
              const ledRadiusFract = (i + 1) / ledsPerStrip; // 0.02 to 1.0
              const ledRadius = 8 + ledRadiusFract * maxRadius;

              // Calculate (x,y) coordinates in Cartesian space
              const ledX = centerX + Math.cos(absoluteStripAngle) * ledRadius;
              const ledY = centerY + Math.sin(absoluteStripAngle) * ledRadius;

              // Normalized Cartesian coordinate for pattern sampling (-1 to +1 relative to radius)
              const normX = Math.cos(absoluteStripAngle) * ledRadiusFract;
              const normY = Math.sin(absoluteStripAngle) * ledRadiusFract;

              // Sample the pattern at this space
              const rgb = samplePattern(normX, normY, absoluteStripAngle, ledRadiusFract);

              // Apply device brightness multiplier
              const brightnessMul = config.brightness / 255;
              const r = Math.floor(rgb.r * brightnessMul);
              const g = Math.floor(rgb.g * brightnessMul);
              const b = Math.floor(rgb.b * brightnessMul);
              
              // Accumulate power: max 60mA per pixel at full white
              frameLedCurrentMa += ((r + g + b) / (255 * 3)) * 60;

              // Skip rendering black LEDs entirely to optimize drawing performance
              if (r < 5 && g < 5 && b < 5) continue;

              // Compute glow properties for physical visual rendering
              // In rotating systems, outer LEDs travel significantly faster and appear slightly blurred
              const physicalVelocityFactor = ledRadiusFract * (rpm / 1200);
              const size = isPlaying && rpm > 100 
                ? 1.2 + physicalVelocityFactor * 1.5 // Outer LEDs draw wider radial arcs (smears slightly)
                : 2.5; // Large crisp dots when stopped

              const pulseCoeff = Math.abs(Math.sin(pulseFreq + i * 0.1));
              const intensityGlow = config.showLeds ? 1.0 : (0.55 + pulseCoeff * 0.15);

              if (isPlaying && rpm > 100) {
                // Highly realistic continuous arc sweep
                ctx.beginPath();
                const subStepAngleSize = angleThisFrame / numSubsteps;
                // Add a tiny overlap of 0.005 radians to ensure smooth rendering boundaries without micro-gaps
                const startA = absoluteStripAngle - subStepAngleSize - 0.005;
                const endA = absoluteStripAngle + 0.005;
                ctx.arc(centerX, centerY, ledRadius, startA, endA, false);
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${intensityGlow})`;
                ctx.lineWidth = size;
                ctx.lineCap = 'round';
                ctx.stroke();
              } else {
                // Draw physical LED pixel dot when stopped or at standby
                ctx.beginPath();
                ctx.arc(ledX, ledY, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${intensityGlow})`;
                ctx.fill();
              }

              // Add subtle specular highlights on top of LEDs for highly realistic high-density feel
              if (config.showLeds && (!isPlaying || rpm < 400)) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(ledX - 0.5, ledY - 0.5, 1, 1);
              }
            }
          }
        }
      }

      // Average the frame current across substeps (since we rendered them multiple times in space and time)
      const instantAmps = (frameLedCurrentMa / numSubsteps) / 1000;
      // Add basal system power (ESP32 + motors ~ 1.5A when spinning, 0.4A stall)
      const systemAmps = (rpm > 100 ? 1.5 : 0.4); 
      const totalAmps = instantAmps + systemAmps;
      
      if (powerDrawRef.current && powerBarRef.current) {
        powerDrawRef.current.innerText = totalAmps.toFixed(2) + ' A';
        const maxAmps = 25; // 270 leds * 60mA = ~16A + logic
        const barWidth = Math.min(100, (totalAmps / maxAmps) * 100);
        
        let color = '#00F0FF';
        if (totalAmps > 15) color = '#FFB800';
        if (totalAmps > 20) color = '#dc2626';
        
        powerBarRef.current.style.width = `${barWidth}%`;
        powerBarRef.current.style.backgroundColor = color;
      }

      // 3. Optional Overlay: Draw physical PCB lines (Arms) when stopped or running slow
      if (config.showLeds && (rpm < 300 || !isPlaying)) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(localAngle);
        
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)'; // Ghost green outline of physical PCB substrate
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(-maxRadius - 5, 0);
        ctx.lineTo(maxRadius + 5, 0);
        ctx.stroke();

        // Draw central spindle mount / bearing hub
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw physical Hall sensor package
        ctx.fillStyle = '#dc2626'; // Red hall element on stator
        ctx.fillRect(centerX - 10, -5, 6, 10);
        
        ctx.restore();
      }

      // Step rotation angle forward
      if (isPlaying) {
        localAngle = (localAngle + angleThisFrame) % (Math.PI * 2);
        setRotationAngle(localAngle);
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [config, isPlaying]);

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRpmSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRpm = parseInt(e.target.value);
    onChangeConfig({ rpm: newRpm });
  };

  const handleBlurSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBlur = parseFloat(e.target.value);
    // Bi-directionally sync physical ledPersistenceMs (20ms to 400ms range)
    const pms = Math.round(20 + (newBlur * 380));
    onChangeConfig({ motionBlur: newBlur, ledPersistenceMs: pms });
  };

  const handlePersistenceSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pms = parseInt(e.target.value);
    // Sync motionBlur (0.05 to 0.99 range)
    const newBlur = Math.min(0.99, Math.max(0.05, (pms - 20) / 380));
    onChangeConfig({ ledPersistenceMs: pms, motionBlur: newBlur });
  };

  return (
    <div className="bg-[#0E1012] border border-[#2A2D33] rounded-sm p-6 flex flex-col h-full justify-between" id="pov-simulator-panel">
      {/* Title Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#2A2D33]">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00F0FF] rounded-none"></div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-[#E0E2E5] font-semibold">01 // ROTATIONAL POV PHYSICS</h3>
            <p className="font-mono text-[#8E9299] text-[10px] uppercase">Retinal Photon Integration & Slew Speed</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#15171A] px-3 py-1.5 border border-[#2A2D33]">
          <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] animate-pulse"></span>
          <span className="font-mono text-[11px] text-[#00F0FF] font-bold">{fps} FPS</span>
        </div>
      </div>

      {/* Main Simulator Canvas Surface */}
      <div className="relative flex-1 flex items-center justify-center p-4 min-h-[300px] h-[360px] bg-[#000] overflow-hidden border border-[#2A2D33]">
        
        {/* Hologram Grid HUD background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(#00F0FF 1.5px, transparent 1.5px)`, backgroundSize: '16px 16px' }}></div>
        
        {/* Rotation alignment concentric HUD tracks */}
        <div className="absolute inset-4 border border-dashed border-[#2A2D33]/15 rounded-full pointer-events-none" />
        <div className="absolute inset-14 border border-dashed border-[#2A2D33]/10 rounded-full pointer-events-none" />
        <div className="absolute inset-28 border border-dashed border-[#2A2D33]/5 rounded-full pointer-events-none" />

        <canvas
          id="pov-canvas-viewport"
          key={config.hwAcceleration ? 'hw-on' : 'hw-off'}
          ref={canvasRef}
          width={400}
          height={400}
          className="w-[330px] h-[330px] md:w-[350px] md:h-[350px] rounded-full relative z-10 select-none bg-[#000]/40"
        />

        {/* Dynamic Telemetry HUD */}
        <div className="absolute bottom-3 left-4 right-4 z-20 flex justify-between pointer-events-none select-none">
          <div className="font-mono text-[9px] text-[#8E9299] flex flex-col bg-[#0E1012]/90 p-1.5 border border-[#2A2D33] uppercase">
            <span>R-COORDINATE: 0..44</span>
            <span>THETA-DIV: 60 SLICES</span>
            <span>DMA CORE: AR1+AR2</span>
          </div>
          <div className="font-mono text-[9px] text-[#8E9299] flex flex-col bg-[#0E1012]/90 p-1.5 border border-[#2A2D33] items-end uppercase">
            <span className="text-[#00F0FF] font-bold">MODE: {isPlaying && Math.abs(currentRpmRef.current) > 10 ? 'ROTATING_DMA' : 'STALLED_LOCK'}</span>
            <span>OMEGA: {((currentRpmRef.current * 2 * Math.PI) / 60).toFixed(1)} RAD/S</span>
            <span>STRIPS: 3X STAGGER</span>
          </div>
        </div>
      </div>

      {/* Dynamic Power Consumption Bar Chart */}
      <div className="mt-4 border border-[#2A2D33] p-3 bg-[#15171A]">
        <div className="flex justify-between items-center mb-1">
          <span className="font-mono text-[#8E9299] text-[10px] uppercase tracking-wider flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5"/> Instant Power Draw</span>
          <span className="font-mono text-[11px] font-bold text-[#E0E2E5]" ref={powerDrawRef}>0.00 A</span>
        </div>
        <div className="h-2 w-full bg-[#1A1D21] border border-[#2A2D33] overflow-hidden rounded-none relative">
          <div ref={powerBarRef} className="h-full bg-[#00F0FF] transition-all duration-75 ease-linear w-0"></div>
          <div className="absolute inset-y-0 left-[60%] w-px bg-white/20"></div>
          <div className="absolute inset-y-0 left-[80%] w-px bg-white/40"></div>
        </div>
        <div className="flex justify-between mt-1 opacity-50">
          <span className="font-mono text-[8px] text-[#8E9299]">0A</span>
          <span className="font-mono text-[8px] text-[#8E9299] ml-16">15A</span>
          <span className="font-mono text-[8px] text-[#8E9299]">25A MAX</span>
        </div>
      </div>

      {/* Control Panel Area */}
      <div className="mt-5 space-y-4">
        {/* Speed Adjustment Slider */}
        <div>
          <div className="flex justify-between items-center mb-1 font-mono text-xs">
            <span className="text-[#8E9299] uppercase tracking-wider">Target Rotor Velocity</span>
            <span className="text-[#00F0FF] bg-[#15171A] border border-[#2A2D33] px-2 py-0.5 rounded-none font-bold">
              {config.rpm} RPM {config.rpm === 0 ? '(STALL)' : `(${(config.rpm / 60).toFixed(1)} HZ)`}
            </span>
          </div>
          <input
            id="rpm-range-slider"
            type="range"
            min={0}
            max={1800}
            step={50}
            value={config.rpm}
            onChange={handleRpmSliderChange}
            className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#00F0FF] outline-none"
          />
          <div className="grid grid-cols-4 font-mono text-[9px] text-[#8E9299] mt-1 uppercase text-center">
            <span className="text-left">0 RPM</span>
            <span>600 (FLICKER)</span>
            <span>1200 (STABLE)</span>
            <span className="text-right">1800 (POV HD)</span>
          </div>
        </div>

        {/* Retinal Fade / Motion Blur Retention */}
        <div>
          <div className="flex justify-between items-center mb-1 font-mono text-xs">
            <span className="text-[#8E9299] uppercase tracking-wider">Retinal Integration (Persistence)</span>
            <span className="text-[#00F0FF] bg-[#15171A] border border-[#2A2D33] px-2 py-0.5 rounded-none font-bold">
              {(config.motionBlur * 100).toFixed(0)}%
            </span>
          </div>
          <input
            id="blur-range-slider"
            type="range"
            min={0.05}
            max={0.99}
            step={0.02}
            value={config.motionBlur}
            onChange={handleBlurSliderChange}
            className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#00F0FF] outline-none"
          />
          <div className="grid grid-cols-3 font-mono text-[9px] text-[#8E9299] mt-1 uppercase text-center">
            <span className="text-left">INSTANT FLASH</span>
            <span>BALANCED DECAY</span>
            <span className="text-right">MAX PERSISTENCE</span>
          </div>
        </div>

        {/* Finer Retinal Constant Controller */}
        <div>
          <div className="flex justify-between items-center mb-1 font-mono text-xs">
            <span className="text-[#8E9299] uppercase tracking-wider">Decay Time Constant (Physical)</span>
            <span className="text-[#FFB800] bg-[#15171A] border border-[#2A2D33] px-2 py-0.5 rounded-none font-bold">
              {config.ledPersistenceMs || 80} ms
            </span>
          </div>
          <input
            id="persistence-range-slider"
            type="range"
            min={20}
            max={400}
            step={5}
            value={config.ledPersistenceMs || 80}
            onChange={handlePersistenceSliderChange}
            className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#FFB800] outline-none"
          />
          <div className="grid grid-cols-3 font-mono text-[9px] text-[#8E9299] mt-1 uppercase text-center">
            <span className="text-left">20 ms (rapid discharge)</span>
            <span>120 ms (average human)</span>
            <span className="text-right">400 ms (slow embers)</span>
          </div>
        </div>

        {/* Playback controls & File dropper */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex gap-2">
            <button
              id="playback-toggle-btn"
              onClick={togglePlayback}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-none font-mono text-[11px] uppercase tracking-wider font-bold transition border cursor-pointer select-none ${
                isPlaying
                  ? 'bg-[#15171A] text-[#FF4E00] border-[#FF4E00] hover:bg-[#FF4E00]/10 shadow-[0_0_8px_rgba(255,78,0,0.1)]'
                  : 'bg-[#00F0FF] text-[#000] border-[#00F0FF] hover:brightness-110 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'PAUSE ROTOR' : 'SPIN ROTOR'}
            </button>
            <button
              id="show-pcb-toggle-btn"
              onClick={() => onChangeConfig({ showLeds: !config.showLeds })}
              className={`p-2.5 rounded-none border transition cursor-pointer ${
                config.showLeds 
                  ? 'bg-[#15171A] text-[#00F0FF] border-[#00F0FF]' 
                  : 'bg-[#1A1D21] text-[#8E9299] border-[#2A2D33] hover:bg-[#2A2D33]'
              }`}
              title="Show Arm Physical Overlays"
            >
              {config.showLeds ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-none flex items-center justify-center gap-2 py-2 px-3 transition text-center select-none ${
              isDragging
                ? 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]'
                : 'bg-[#15171A] text-[#8E9299] border-[#2A2D33] hover:bg-[#2A2D33] hover:border-[#8E9299]'
            }`}
          >
            <Upload className="w-4 h-4 text-[#00F0FF] shrink-0" />
            <div className="text-left leading-none">
              <span className="font-mono text-[10px] text-[#E0E2E5] block font-bold uppercase">UPLOAD MEDIA</span>
              <span className="font-mono text-[9px] text-[#8E9299] block mt-0.5">DRAG & DROP BIN/PNG</span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
