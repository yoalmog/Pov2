import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudLightning, 
  Upload, 
  RefreshCw, 
  FileJson, 
  Image as ImageIcon, 
  Trash2, 
  Play, 
  ShieldCheck, 
  Download, 
  LogOut, 
  Key, 
  Terminal, 
  AlertCircle,
  FileCode2,
  Lock,
  CloudUpload
} from 'lucide-react';
import { googleSignIn, logout, initAuth, getAccessToken } from '../lib/driveAuth';
import { User } from 'firebase/auth';
import { SimulationConfig, FirmwareConfig } from '../types';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  size?: string;
}

interface DriveIntegrationProps {
  simConfig: SimulationConfig;
  onChangeSimConfig: (config: Partial<SimulationConfig>) => void;
  firmwareConfig: FirmwareConfig;
  onChangeFirmwareConfig: (config: Partial<FirmwareConfig>) => void;
}

export default function DriveIntegration({
  simConfig,
  onChangeSimConfig,
  firmwareConfig,
  onChangeFirmwareConfig
}: DriveIntegrationProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [exportName, setExportName] = useState('Hologram Matrix Concept');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' | null }>({ text: '', type: null });
  const [isCasting, setIsCasting] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setNeedsAuth(false);
        fetchDriveFiles(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    showStatus('INJECTING OAUTH BEAU-FORT AUTHENTICATED WRAPPERS...', 'info');
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        showStatus('GOOGLE OAUTH CREDENTIAL TUNNEL SECURED.', 'success');
        fetchDriveFiles(result.accessToken);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      showStatus(`AUTH HANDSHAKE FAULT: ${err.message || err}`, 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setFiles([]);
      showStatus('OAUTH TUNNEL SHUTDOWN SECURELY. LOCAL AUTH PURGED.', 'success');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const showStatus = (text: string, type: 'info' | 'success' | 'error' | null) => {
    setStatusMessage({ text, type });
    if (type !== 'error') {
      setTimeout(() => {
        setStatusMessage(prev => prev.text === text ? { text: '', type: null } : prev);
      }, 5000);
    }
  };

  const fetchDriveFiles = async (accessToken: string) => {
    setIsLoadingFiles(true);
    showStatus('SCANNING GOOGLE DRIVE HOLO-DEPOT REGISTRIES...', 'info');
    try {
      // Query to list .json configurations or normal image files
      const query = "trashed = false and (mimeType = 'application/json' or mimeType.startsWith('image/'))";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime)&orderBy=modifiedTime desc&pageSize=30`;
      
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!res.ok) {
        throw new Error(`Registry return fault: ${res.statusText}`);
      }
      const data = await res.json();
      setFiles(data.files || []);
      showStatus(`RETRIEVED ${data.files?.length || 0} COMPATIBLE ARTIFACTS.`, 'success');
    } catch (err: any) {
      console.error('Failed to fetch Drive files:', err);
      showStatus(`CLOUD SYNC ERROR: ${err.message || err}`, 'error');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Upload/Back up current application variables (Sim + Firmware Configs)
  const backupActiveProfile = async () => {
    if (!token) return;

    const confirmed = window.confirm(
      `BACKUP PROFILE INITIATION:\nYou are about to upload "${exportName}.json" to Google Drive.\nThis exports both active simulation configurations and compilation pins.\n\nConfigure commit?`
    );
    if (!confirmed) return;

    setIsUploading(true);
    showStatus('PACKETING SYSTEM WORKSPACE COMPACT BUFFERS...', 'info');

    try {
      const payload = {
        _schemaType: 'aero-sync-pov-profile',
        exportTimestamp: new Date().toISOString(),
        profileName: exportName,
        simConfig,
        firmwareConfig
      };

      const filename = `aero_sync_profile_${exportName.toLowerCase().replace(/\s+/g, '_')}.json`;
      const metadata = {
        name: filename,
        mimeType: 'application/json',
        description: 'ESP32 Aero-Sync POV Active Matrix Designer Setup Profile'
      };

      const boundary = 'AeroSyncBoundaryMultiplex993';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;

      const body = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(payload) +
        close_delim;

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: body
      });

      if (!res.ok) {
        throw new Error(`Upload fault: ${res.statusText}`);
      }

      showStatus(`EXPORT COMPLETE: PROVISIONED "${filename}" ON VIRTUAL DEPOT.`, 'success');
      fetchDriveFiles(token);
    } catch (err: any) {
      console.error('Backup error:', err);
      showStatus(`CLOUD EXPORT FAILED: ${err.message || err}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Download and Load JSON Hologram Profile into workspace
  const loadProfile = async (fileId: string, fileName: string) => {
    if (!token) return;

    const confirmed = window.confirm(
      `WORKSPACE REWRITE CONFIRMATION:\nYou are about to load "${fileName}" from Google Drive.\nThis replaces current active simulation presets and C++ pinout controls.\n\nExecute overwrite?`
    );
    if (!confirmed) return;

    showStatus(`DOWNLOADING DESIGN ARTIFACT: ${fileName}...`, 'info');
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(`Download endpoint failure: ${res.statusText}`);
      }
      const data = await res.json();

      if (data._schemaType === 'aero-sync-pov-profile') {
        if (data.simConfig) {
          onChangeSimConfig(data.simConfig);
        }
        if (data.firmwareConfig) {
          onChangeFirmwareConfig(data.firmwareConfig);
        }
        showStatus(`WORKSPACE FLUSHED. RE-INTEGRATED ADAPTING REGISTERS FROM "${data.profileName || fileName}".`, 'success');
      } else {
        // Fallback or generic parse
        showStatus('WARNING: INVALID OR NON-AERO PROFILE DETECTED. OVERWRITE HALTED.', 'error');
      }
    } catch (err: any) {
      console.error('Profile load error:', err);
      showStatus(`DESERIALIZATION FAILED: ${err.message || err}`, 'error');
    }
  };

  // Fetch image from Google Drive and cast directly into active Simulation projection texture
  const castCloudImage = async (fileId: string, fileName: string) => {
    if (!token) return;
    setIsCasting(fileId);
    showStatus(`CONVERTING CLOUD TEXTURE BUFFER: ${fileName}...`, 'info');
    
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(`Binary stream failed: ${res.statusText}`);
      }
      const blob = await res.blob();
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onChangeSimConfig({
          currentPattern: 'uploaded',
          uploadedImageBase64: base64
        });
        showStatus(`CAST SUCCESS: DEPLOYED "${fileName}" TO SIMULATOR DISPLAY.`, 'success');
        setIsCasting(null);
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error('Cast image error:', err);
      showStatus(`IMAGE CAST RESOLVING FAILED: ${err.message || err}`, 'error');
      setIsCasting(null);
    }
  };

  // Delete File on Google Drive
  const deleteFile = async (fileId: string, fileName: string) => {
    if (!token) return;

    const confirmed = window.confirm(
      `PERMANENT FILE DELETION:\nYou are about to DELETE "${fileName}" from Google Drive.\nThis action is irreversible.\n\nAuthorize destroy?`
    );
    if (!confirmed) return;

    showStatus(`DESTROYING FILE ${fileName}...`, 'info');
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(`Deletion fault code: ${res.statusText}`);
      }
      showStatus(`SUCCESSFULLY DELETED "${fileName}" FROM DEPOT.`, 'success');
      fetchDriveFiles(token);
    } catch (err: any) {
      console.error('File delete failed:', err);
      showStatus(`DESTRUCT FAULT: ${err.message || err}`, 'error');
    }
  };

  return (
    <div className="bg-[#15171A] border border-[#2A2D33] rounded-none p-6 md:p-8 w-full mt-2 select-none">
      
      {/* Tab Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#2A2D33] pb-6 mb-8">
        <div>
          <h2 className="text-xl font-mono font-bold text-[#00F0FF] uppercase tracking-widest flex items-center gap-3">
            <Cloud className="w-6 h-6 animate-pulse text-[#00F0FF]" />
            Holo-Cloud Sync Depot
          </h2>
          <p className="text-[#8E9299] text-[11px] font-mono mt-2 tracking-wider">
            BACKUP PHYSICAL PINOUT REGISTERS, AND LAUNCH CLOUD BINARY IMAGE PROJECTIONS TO ROTATING BUFFERS VIA GOOGLE DRIVE.
          </p>
        </div>

        {/* Auth Button */}
        <div>
          {needsAuth ? (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button relative overflow-hidden transition-all duration-300 hover:scale-[1.02] border border-[#00F0FF]/30 hover:border-[#00F0FF]"
              style={{
                background: '#0E1012',
                borderRadius: '0px',
                padding: '2px 16px',
                color: '#E0E2E5',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '1px'
              }}
            >
              <div className="flex items-center gap-3 font-mono font-bold uppercase tracking-wider text-[#00F0FF]">
                <Key className="w-4 h-4 text-[#00F0FF]" />
                {isLoggingIn ? 'Establishing Link...' : 'Sign in with Google'}
              </div>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 bg-[#0E1012] border border-[#2A2D33] p-2 rounded-none">
              <div className="flex items-center gap-2 px-2">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User Profile" referrerPolicy="no-referrer" className="w-5 h-5 rounded-full border border-[#00F0FF]/40" />
                ) : (
                  <div className="w-5 h-5 bg-[#2A2D33] rounded-full flex items-center justify-center text-[10px] text-[#00F0FF] font-bold">U</div>
                )}
                <span className="font-mono text-[10px] text-[#E0E2E5] tracking-tight">{user?.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 bg-[#15171A] hover:bg-[#FF4E00]/20 text-[#8E9299] hover:text-[#FF4E00] border border-[#2A2D33] hover:border-[#FF4E00]/30 transition-all font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-1"
                title="Disconnect Cloud Provider"
              >
                <LogOut className="w-3 h-3" />
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Connection Indicator HUD banner */}
      {statusMessage.text && (
        <div className={`flex items-start gap-3 p-4 mb-6 transition-all duration-300 pointer-events-none font-mono text-xs border ${
          statusMessage.type === 'error' 
            ? 'bg-[#FF4E00]/5 border-[#FF4E00]/30 text-[#FF4E00]' 
            : statusMessage.type === 'success'
            ? 'bg-[#00F0FF]/5 border-[#00F0FF]/30 text-[#00F0FF]'
            : 'bg-[#15171A] border-[#2A2D33] text-[#8E9299]'
        }`}>
          {statusMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0" />
          ) : statusMessage.type === 'success' ? (
            <ShieldCheck className="w-5 h-5 shrink-0 text-[#00F0FF]" />
          ) : (
            <Terminal className="w-5 h-5 shrink-0 animate-pulse text-[#8E9299]" />
          )}
          <div className="flex-1 uppercase tracking-widest leading-relaxed">
            <span className="text-[10px] font-bold text-[#8E9299] block mb-0.5">CLOUD DEPOT LOGS</span>
            {statusMessage.text}
          </div>
        </div>
      )}

      {/* Authenticated Workspace */}
      {needsAuth ? (
        <div className="flex flex-col items-center justify-center text-center py-20 border border-dashed border-[#2A2D33] bg-[#0E1012]/40 rounded-none">
          <Lock className="w-12 h-12 text-[#2A2D33] mb-4" />
          <h3 className="font-mono text-xs font-bold text-[#E0E2E5] uppercase tracking-widest mb-2">Workspace Cloud Bridge Locked</h3>
          <p className="text-[#8E9299] max-w-sm font-mono text-[10px] leading-relaxed tracking-wider px-6 uppercase">
            SIGN IN TO DEPLOY MULTIPLEX POLAR TRANSLATIONS, COMMIT FIRMWARE BACKUPS AND BROADCAST INTERACTIVE HARDWARE BUFFERS DIRECTLY TO GOOGLE DRIVE.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left panel: Save/Backup Commit Profile */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0E1012] border border-[#2A2D33] p-6 rounded-none relative">
              <span className="absolute top-3 right-3 font-mono text-[9px] text-[#00F0FF] tracking-wider font-semibold uppercase">SECURE TRANSFER</span>
              <h3 className="font-mono text-xs font-bold text-[#E0E2E5] uppercase tracking-widest mb-4 flex items-center gap-2">
                <CloudUpload className="w-4 h-4 text-[#00F0FF]" />
                Commit Active Backup
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-2 tracking-wider">Holographic Setup Profile Title</label>
                  <input
                    type="text"
                    value={exportName}
                    onChange={(e) => setExportName(e.target.value)}
                    className="w-full bg-[#15171A] border border-[#2A2D33] px-3 py-2 text-xs text-[#00F0FF] font-mono focus:border-[#00F0FF] focus:outline-none rounded-none tracking-wider placeholder:text-[#2A2D33] uppercase"
                    placeholder="e.g. Cyber Wave Matrix"
                  />
                  <span className="text-[9px] font-mono text-[#8E9299] block mt-1 tracking-wider">
                    Will be stored as <strong className="text-slate-400">aero_sync_profile_{exportName.toLowerCase().replace(/\s+/g, '_')}.json</strong>.
                  </span>
                </div>

                {/* Information preview of backup */}
                <div className="border border-[#2A2D33] bg-[#15171A] p-4 space-y-3 font-mono text-[10px]">
                  <span className="text-[#8E9299] uppercase font-bold text-[9px] tracking-widest block border-b border-[#2A2D33] pb-1 bg-[#1A1D24] -mx-4 -mt-4 px-4 py-1 flex items-center justify-between">
                    <span>Export Data Manifest</span>
                    <FileCode2 className="w-3.5 h-3.5 text-[#00F0FF]" />
                  </span>
                  
                  <div className="flex justify-between">
                    <span className="text-[#8E9299]">SIM PATTERN:</span>
                    <span className="text-[#00F0FF] font-bold">{simConfig.currentPattern.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8E9299]">ROTATION RATE:</span>
                    <span className="text-slate-300 font-bold">{simConfig.rpm} RPM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8E9299]">LED BRIGHTNESS:</span>
                    <span className="text-slate-300">{simConfig.brightness} / 255</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8E9299]">ARM CHIPSET & GPIO 1/2:</span>
                    <span className="text-slate-400">ESP32 // GP{firmwareConfig.pinLedArm1} / GP{firmwareConfig.pinLedArm2}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8E9299]">RESOLUTION:</span>
                    <span className="text-slate-400">270 DMA RESOLVED LEDS</span>
                  </div>
                </div>

                <button
                  onClick={backupActiveProfile}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 bg-[#00F0FF]/5 hover:bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 hover:border-[#00F0FF] transition-all py-3 font-mono text-xs uppercase font-bold tracking-widest disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading To Cloud...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Commit Backup To Drive
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="p-4 bg-[#0E1012] border border-[#2A2D33] text-[10px] uppercase tracking-wider text-[#8E9299] font-mono flex items-start gap-3">
              <CloudLightning className="w-5 h-5 text-[#00F0FF] shrink-0" />
              <div>
                <span className="font-bold text-slate-300 block mb-1">Interactive Hologram Mapping</span>
                Any images saved on your Google Drive can be selected to update the holographic sim immediately. Try saving graphics from other tools to cast them on the spinner!
              </div>
            </div>
          </div>

          {/* Right panel: Drive Browser List */}
          <div className="lg:col-span-7">
            <div className="bg-[#0E1012] border border-[#2A2D33] p-6 rounded-none h-full flex flex-col">
              <div className="flex items-center justify-between border-b border-[#2A2D33] pb-4 mb-4">
                <h3 className="font-mono text-xs font-bold text-[#E0E2E5] uppercase tracking-widest flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-[#00F0FF]" />
                  Secure Drive Registry Explorer
                </h3>
                
                <button
                  onClick={() => fetchDriveFiles(token!)}
                  disabled={isLoadingFiles}
                  className="p-1 px-2 border border-[#2A2D33] hover:border-[#00F0FF] bg-[#15171A] text-[#8E9299] hover:text-[#00F0FF] transition-all font-mono text-[9px] uppercase font-bold flex items-center gap-1 leading-none"
                  title="Rescan Cloud Files"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  Sync
                </button>
              </div>

              {/* List Content */}
              {isLoadingFiles && files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 font-mono text-[10px] text-[#8E9299]">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#00F0FF] mb-3" />
                  CONNECTING WITH CLOUD REGISTRIES...
                </div>
              ) : files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center font-mono text-xs text-[#8E9299] border border-dashed border-[#2A2D33] bg-[#15171A]/40">
                  <ImageIcon className="w-8 h-8 text-[#2A2D33] mb-3" />
                  <span className="uppercase text-[10px] text-[#E0E2E5] font-bold tracking-wider mb-2">No Compatible Artifacts Found</span>
                  <p className="uppercase text-[9px] px-6 leading-relaxed max-w-xs">
                    No JSON configurations or standard images detected in Google Drive yet. Use "Commit Setup Profile" to initialize.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1 scrollbar-thin">
                  {files.map((file) => {
                    const isProfile = file.mimeType === 'application/json' && file.name.startsWith('aero_sync_profile_');
                    const isGenericJson = file.mimeType === 'application/json' && !isProfile;
                    const isImage = file.mimeType.startsWith('image/');
                    
                    return (
                      <div 
                        key={file.id} 
                        className="bg-[#15171A] hover:bg-[#1A1D24] border border-[#2A2D33] hover:border-[#00F0FF]/30 transition-all p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-[#0E1012] border border-[#2A2D33] text-slate-400 group-hover:text-[#00F0FF]">
                            {isProfile ? (
                              <FileCode2 className="w-5 h-5 text-[#00F0FF]" />
                            ) : isGenericJson ? (
                              <FileJson className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-purple-400" />
                            )}
                          </div>
                          <div className="font-mono">
                            <span className="text-xs text-[#E0E2E5] font-bold block leading-snug break-all uppercase group-hover:text-white transition-colors">{file.name}</span>
                            <div className="flex items-center gap-3 text-[9px] text-[#8E9299] mt-1.5 uppercase tracking-wider">
                              <span className="px-1 py-0.5 bg-[#0E1012] border border-[#2A2D33] rounded-[2px] text-[#55F0FF] text-[8px] font-bold">
                                {isProfile ? 'HOLO PROFILE' : isImage ? 'IMAGE TEXTURE' : 'JSON FILE'}
                              </span>
                              <span>
                                {file.size ? `${(parseInt(file.size) / 1024).toFixed(1)} KB` : 'STREAM SIZE UNKNOWN'}
                              </span>
                              <span>
                                {file.createdTime ? new Date(file.createdTime).toLocaleDateString() : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action controllers */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {isProfile && (
                            <button
                              onClick={() => loadProfile(file.id, file.name)}
                              className="flex items-center gap-1.5 bg-[#00F0FF]/5 hover:bg-[#00F0FF] text-[#00F0FF] hover:text-black border border-[#00F0FF]/25 hover:border-transparent transition-all font-mono text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-none"
                              title="Restore preset profiles into environment"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Restore Workspace
                            </button>
                          )}

                          {isImage && (
                            <button
                              onClick={() => castCloudImage(file.id, file.name)}
                              disabled={isCasting === file.id}
                              className="flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500 text-purple-300 hover:text-black border border-purple-500/30 hover:border-transparent transition-all font-mono text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-none"
                              title="Convert and display onto rotation matrix"
                            >
                              {isCasting === file.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                              Cast Hologram
                            </button>
                          )}

                          <button
                            onClick={() => deleteFile(file.id, file.name)}
                            className="bg-[#1A1D24] text-[#8E9299] hover:bg-[#FF4E00]/20 hover:text-[#FF4E00] border border-[#2A2D33] hover:border-[#FF4E00]/30 transition-all p-1.5 rounded-none"
                            title="Delete file permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
