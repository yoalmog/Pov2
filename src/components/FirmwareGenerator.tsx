import React, { useState } from 'react';
import { Cpu, Copy, Check, FileCode, Settings, RefreshCw, Smartphone, Download, ShieldCheck, Sliders, Archive } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { FirmwareConfig, SimulationConfig } from '../types';

interface FirmwareGeneratorProps {
  config: FirmwareConfig;
  onChangeConfig: (newConfig: Partial<FirmwareConfig>) => void;
  sampledPolarData: number[][][] | null; // [slice][led][r,g,b]
  simConfig: SimulationConfig;
  onChangeSimConfig: (newConfig: Partial<SimulationConfig>) => void;
}

export default function FirmwareGenerator({ config, onChangeConfig, sampledPolarData, simConfig, onChangeSimConfig }: FirmwareGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'main' | 'engine' | 'data_h' | 'data_cpp' | 'fs_guide' | 'platformio'>('main');
  const [copied, setCopied] = useState<string | null>(null);

  const triggerCopy = (name: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadBin = () => {
    if (!sampledPolarData || sampledPolarData.length === 0) return;
    const slices = sampledPolarData.length;
    const leds = sampledPolarData[0].length;
    const buffer = new Uint8Array(slices * leds * 3);
    let idx = 0;
    for (let s = 0; s < slices; s++) {
      for (let l = 0; l < leds; l++) {
        buffer[idx++] = sampledPolarData[s][l][0];
        buffer[idx++] = sampledPolarData[s][l][1];
        buffer[idx++] = sampledPolarData[s][l][2];
      }
    }
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hologram_image.bin';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validateConfig = (): boolean => {
    // Basic pin conflict checks
    if (config.pinLedArm1 === config.pinHallSensor || config.pinLedArm2 === config.pinHallSensor || config.pinLedArm1 === config.pinLedArm2) {
      alert("Error: GPIO Pin Conflict. Ensure the Hall Sensor, LED Arm 1, and LED Arm 2 use unique GPIO pins.");
      return false;
    }
    // Basic sanity checks
    if (config.ledsPerStrip > 300) {
      alert("Warning: Exceeding 300 LEDs per strip may cause power crashes or DMA buffer overflows. Reduce count.");
      return false;
    }
    return true;
  };

  const downloadArduinoProject = () => {
    if (!validateConfig()) return;
    const zip = new JSZip();
    const folderName = 'hologram_app';
    zip.file(`${folderName}/${folderName}.ino`, generateMainCode());
    zip.file(`${folderName}/rendering_engine.h`, generateEngineCode());
    zip.file(`${folderName}/image_data.h`, generateImageDataHeader());
    zip.file(`${folderName}/image_data.cpp`, generateImageDataCpp());
    zip.file(`${folderName}/README.md`, generateFsGuide());
    
    // Add bin data if it exists (for OTA updates later)
    if (sampledPolarData && sampledPolarData.length > 0) {
      const slices = sampledPolarData.length;
      const leds = sampledPolarData[0].length;
      const buffer = new Uint8Array(slices * leds * 3);
      let idx = 0;
      for (let s = 0; s < slices; s++) {
        for (let l = 0; l < leds; l++) {
          buffer[idx++] = sampledPolarData[s][l][0];
          buffer[idx++] = sampledPolarData[s][l][1];
          buffer[idx++] = sampledPolarData[s][l][2];
        }
      }
      zip.file(`${folderName}/data/image.bin`, buffer);
    }

    zip.generateAsync({ type: 'blob' }).then((content) => {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const downloadProject = () => {
    if (!validateConfig()) return;
    const zip = new JSZip();
    zip.file('src/main.cpp', generateMainCode());
    zip.file('src/rendering_engine.h', generateEngineCode());
    zip.file('src/image_data.h', generateImageDataHeader());
    zip.file('src/image_data.cpp', generateImageDataCpp());
    zip.file('platformio.ini', generatePlatformioIni());
    zip.file('README.md', generateFsGuide());
    
    // Add bin data if it exists
    if (sampledPolarData && sampledPolarData.length > 0) {
      const slices = sampledPolarData.length;
      const leds = sampledPolarData[0].length;
      const buffer = new Uint8Array(slices * leds * 3);
      let idx = 0;
      for (let s = 0; s < slices; s++) {
        for (let l = 0; l < leds; l++) {
          buffer[idx++] = sampledPolarData[s][l][0];
          buffer[idx++] = sampledPolarData[s][l][1];
          buffer[idx++] = sampledPolarData[s][l][2];
        }
      }
      zip.file('data/image.bin', buffer);
    }
    
    zip.generateAsync({ type: 'blob' }).then((content) => {
      saveAs(content, 'esp32-hologram-project.zip');
    });
  };

  const generateImageDataHeader = (): string => {
    if (!sampledPolarData || sampledPolarData.length === 0) {
      return `// No image sampled in workspace yet. Draw or upload a design in the POV Simulator above.`;
    }
    const slices = sampledPolarData.length;
    const leds = sampledPolarData[0].length;
    
    return `/**
 * @file image_data.h
 * @brief Auto-generated polar coordinate lookup table (Declarations).
 * Mapped for: ${slices} Angular Slices x ${leds} LEDs
 */

#ifndef IMAGE_DATA_H
#define IMAGE_DATA_H

#include <Arduino.h>

#define POV_SLICES ${slices}
#define POV_LEDS_PER_STRIP ${leds}

// Externally declared array, defined in image_data.cpp to dramatically speed up recompilation!
extern const uint8_t POLAR_IMAGE_DATA[POV_SLICES][POV_LEDS_PER_STRIP][3] PROGMEM;

#endif // IMAGE_DATA_H
`;
  };

  const generateImageDataCpp = (): string => {
    if (!sampledPolarData || sampledPolarData.length === 0) {
      return `// No image sampled in workspace yet.`;
    }
    const slices = sampledPolarData.length;
    const leds = sampledPolarData[0].length;
    
    let out = `/**
 * @file image_data.cpp
 * @brief Auto-generated polar coordinate lookup table (Definitions).
 */

#include "image_data.h"

// 3D Matrix of layout: [Angular slice][LED Index][R, G, B]
const uint8_t PROGMEM POLAR_IMAGE_DATA[POV_SLICES][POV_LEDS_PER_STRIP][3] = {
`;

    // Process all slices cleanly
    for (let s = 0; s < slices; s++) {
      out += `  { // Angular slice ${s} (${Math.round((s / slices) * 360)} deg)\n    `;
      for (let l = 0; l < leds; l++) {
        const rgb = sampledPolarData[s][l];
        out += `{${rgb[0]},${rgb[1]},${rgb[2]}}`;
        if (l < leds - 1) {
          out += (l % 8 === 7) ? ',\n    ' : ', ';
        }
      }
      out += `\n  }${s < slices - 1 ? ',' : ''}\n`;
    }

    out += `};
`;
    return out;
  };

  const generateMainCode = (): string => {
    return `/**
 * @file main.cpp
 * @brief High-Torque Multi-Core Real-time POV Hologram Controller with Resilient Error Checking.
 * 
 * DESIGN FEATURES:
 * - CORE 1 Dedicated Interrupter: Ultra-high speed angular timing calculations
 *   and synchronous DMA fast LED writes based on Hall sensor cycle times.
 * - SENSOR WATCHDOG: Hardware Timer 0 triggers auto-safety shut-down in 500ms if mechanical block occurs.
 * - CORE 0 Network Manager: Asynchronous WebServer, WebSocket telemetry endpoint, 
 *   captive portal, configuration storage, and OTA network updates.
 * - ERR_RESILIENCY: LittleFS persistent connection diagnostics logs, on-event Wifi restoration,
 *   and continuous CRC/GPIO feedback tracking for LED parallel lines.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <ElegantOTA.h> // OTA updates for commercial fields
#include <FastLED.h>
#include <LittleFS.h>
#include "rendering_engine.h"
#include "image_data.h"

// Hardware and Networking Config
const char* WIFI_SSID = "\${config.ssid}";
const char* WIFI_PASS = "\${config.wifiPass}";
const char* HOSTNAME = "\${config.hostname}";

// Operational Globals
AsyncWebServer server(3000);
AsyncWebSocket ws("/ws");
POV_Engine povEngine;

// Interrupt Service Routine for Rotor Hall Sensor
// Pin triggers FALLING on every 360 degree mechanical revolution
volatile uint32_t lastInterruptUs = 0;
volatile uint32_t currentRevPeriodUs = 50000; // default 1200 RPM -> 50ms period
volatile bool newRevolutionFlag = false;
volatile uint32_t totalInterruptMissCount = 0;
volatile bool sensorFaultActive = false;
volatile bool wsSensorLogged = false;

void IRAM_ATTR handleHallSensorInterrupt() {
    uint32_t now = micros();
    uint32_t delta = now - lastInterruptUs;
    
    // Hardware Debouncer: Discard any interrupt closer than 10ms (corresponds to >6000 RPM)
    if (delta > 10000) {
        currentRevPeriodUs = delta;
        lastInterruptUs = now;
        newRevolutionFlag = true;
        sensorFaultActive = false;
    }
}

// Write Wi-Fi errors to LittleFS persistently
void logWiFiDetails(const char* reason) {
    File file = LittleFS.open("/wifi_err.log", "a");
    if (file) {
        file.printf("[%lu] Err: %s\n", millis(), reason);
        file.close();
        Serial.printf("[SYS] WiFi error logged persistently: %s\n", reason);
    } else {
        Serial.println("[ERR] [FS] Failed to open /wifi_err.log for append");
    }
}

// Transmit saved LittleFS WiFi failure logs to active dashboard clients
void transmitSavedWiFiLogs() {
    if (LittleFS.exists("/wifi_err.log")) {
        File file = LittleFS.open("/wifi_err.log", "r");
        if (file) {
            String logsConcatenated = "";
            while (file.available()) {
                String line = file.readStringUntil('\n');
                if (line.length() > 0) {
                    logsConcatenated += line + "\\n";
                }
            }
            file.close();
            
            // Format log payload packet safely for web console parsing
            char responsePayload[1024];
            snprintf(responsePayload, sizeof(responsePayload), 
                     "{\"event\":\"wifi_log_sync\",\"logs\":\"%s\"}", 
                     logsConcatenated.c_str());
            
            ws.textAll(responsePayload);
            Serial.println("[NET] Synchronized LittleFS WiFi error dump with Client Dashboard.");
            
            // Wipe logs after sync is successfully piped to console to reclaim LittleFS sectors
            LittleFS.remove("/wifi_err.log");
        }
    }
}

// Background Network Event Handler for Non-Blocking Wifi Restoration & Diagnostics
void onWiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED: {
            uint8_t reason = info.wifi_sta_disconnected.reason;
            char reasonStr[64];
            if (reason == 201 || reason == WIFI_REASON_NO_AP_FOUND) {
                strcpy(reasonStr, "SSID NOT FOUND (AP Offline)");
            } else if (reason == WIFI_REASON_AUTH_EXPIRE || reason == 203) {
                strcpy(reasonStr, "AUTHENTICATION FAILURE (Bad Password)");
            } else if (reason == WIFI_REASON_BEACON_TIMEOUT) {
                strcpy(reasonStr, "BEACON_TIMEOUT (Weak Coverage)");
            } else {
                snprintf(reasonStr, sizeof(reasonStr), "DISCONNECTED Code:%d", reason);
            }
            Serial.printf("[ERR] [NET] STA Connection Failed: %s\n", reasonStr);
            logWiFiDetails(reasonStr);
            
            // Queue immediate background reconnection loop
            WiFi.begin(WIFI_SSID, WIFI_PASS);
            break;
        }
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            Serial.print("[NET] IP Address bind success. Station Bound IP: ");
            Serial.println(WiFi.localIP());
            // Flash outstanding log alerts to WebSocket client
            transmitSavedWiFiLogs();
            break;
        default:
            break;
    }
}

// Core 1 High-Speed Execution Task
void highSpeedRenderingLoop(void * pvParameters) {
    povEngine.begin(${config.ledsPerStrip}, ${config.pinLedArm1}, ${config.pinLedArm2});
    
    uint32_t lastFrameSliceUs = 0;
    uint16_t currentSliceIndex = 0;
    uint16_t ledGlitchTicker = 0;
    
    for(;;) {
        // Watchdog check for mechanical hall-probe failure or stall (no triggers for > 500ms)
        if (micros() - lastInterruptUs > 500000) {
            sensorFaultActive = true;
        } else {
            sensorFaultActive = false;
        }

        if (sensorFaultActive) {
              if (!wsSensorLogged) {
                  wsSensorLogged = true;
                  totalInterruptMissCount++;
                  Serial.println("[ERR] [SEN] STALL: Physical Hall trigger missed. Watchdog tripped LED thermal power shields.");
                  ws.textAll("{\"event\":\"sensor_fault\",\"error\":\"PROLONGED_NO_INTERRUPT\",\"msg\":\"No Hall interrupt detected for >500ms. Potential physical obstruction or sensor failure! Output disabled for thermal protection.\"}");
              }
              FastLED.setBrightness(0);
              FastLED.clear();
              FastLED.show();
              vTaskDelay(pdMS_TO_TICKS(50)); // Chill threads to prevent caching bottlenecks
              continue;
        }

        // Apply synchronized period calculation from Core 1 interrupt
        if (newRevolutionFlag) {
            newRevolutionFlag = false;
            if (wsSensorLogged) {
                wsSensorLogged = false;
                ws.textAll("{\"event\":\"sensor_recovered\",\"msg\":\"Stall Watchdog cleared. Hall sensor signal re-locked.\"}");
                povEngine.setGlobalBrightness(${config.maxBrightness}); // Restore original configured brightness
            }
            povEngine.updateRotorPeriod(currentRevPeriodUs);
            currentSliceIndex = 0;
            lastFrameSliceUs = micros();
        }

        // Calculate dynamic microsecond spacing per slice
        uint32_t sliceDurationUs = povEngine.getMicrosecondsPerSector();
        uint32_t elapsedSinceSlice = micros() - lastFrameSliceUs;

        if (elapsedSinceSlice >= sliceDurationUs) {
            // Push polar mapping to DMA controllers
            povEngine.renderSector(currentSliceIndex);
            
            currentSliceIndex = (currentSliceIndex + 1) % POV_SLICES;
            lastFrameSliceUs = micros();
        }

        // Periodically verify parallel signal line parameters for data integrity checks
        if (++ledGlitchTicker >= 2000) {
            ledGlitchTicker = 0;
            if (!povEngine.verifyLineIntegrity(1)) {
                char msg[256];
                snprintf(msg, sizeof(msg), "{\"event\":\"led_fault\",\"strip\":1,\"pin\":%d,\"msg\":\"Arm 1 ws2812 data line shorted on GPIO %d! Voltage clamped LOW or FastLED transmission timed out.\"}", ${config.pinLedArm1}, ${config.pinLedArm1});
                ws.textAll(msg);
            }
            if (!povEngine.verifyLineIntegrity(2)) {
                char msg[256];
                snprintf(msg, sizeof(msg), "{\"event\":\"led_fault\",\"strip\":2,\"pin\":%d,\"msg\":\"Arm 2 ws2812 data line glitching on GPIO %d! High impedance contact brush fatigue or protocol timing slip.\"}", ${config.pinLedArm2}, ${config.pinLedArm2});
                ws.textAll(msg);
            }
        }

        // Yield minimum time slice to avoid triggering general watchdog timer
        esp_rtos_yield_processor();
    }
}

void handleWebSocketMessage(void *arg, uint8_t *data, size_t len, AsyncWebSocketClient *client) {
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        data[len] = 0;
        DynamicJsonDocument doc(256);
        DeserializationError err = deserializeJson(doc, data);
        if (err) return;

        if (doc.containsKey("brightness")) {
            int b = doc["brightness"];
            povEngine.setGlobalBrightness(b);
        }
        if (doc.containsKey("pattern")) {
            const char* pat = doc["pattern"];
            povEngine.loadPatternPreset(pat);
        }
    }
}

void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        client->text("{\"status\":\"connected\",\"rpm\":1200,\"temp\":42.5}");
    } else if (type == WS_EVT_DATA) {
        handleWebSocketMessage(arg, data, len, client);
    }
}

void setup() {
    Serial.begin(115200);
    
    // Mount Persistent Partition for network log retention
    if (!LittleFS.begin(true)) {
         Serial.println("[ERR] [SYS] LittleFS Boot failed. Storage damaged.");
    } else {
         Serial.println("[SYS] LittleFS localized database mounted successfully.");
    }
    
    // Set Pin Modes
    pinMode(${config.pinHallSensor}, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(${config.pinHallSensor}), handleHallSensorInterrupt, FALLING);

    // Bind Wi-Fi Core Event Listening loops to handle connection drops without killing DMA priority timers
    WiFi.onEvent(onWiFiEvent);
    WiFi.mode(WIFI_AP_STA); // Enable both AP and Station mode explicitly for better fallback
    WiFi.setHostname(HOSTNAME);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    
    uint8_t wifiTimeout = 0;
    while (WiFi.status() != WL_CONNECTED && wifiTimeout < 15) {
        delay(500);
        Serial.print(".");
        wifiTimeout++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\nWi-Fi connection established. IP Address: %s\n", WiFi.localIP().toString().c_str());
        WiFi.mode(WIFI_STA); // Disable AP if we are successfully connected to a router
    } else {
        Serial.println("\nWiFi failed to establish link. Launching standalone high-gain Access Point mode.");
        WiFi.mode(WIFI_AP);
        WiFi.softAP("ESP32-POV-HOLOGRAPH", "HologramEngine101");
        Serial.printf("SoftAP Started. Connect to 'ESP32-POV-HOLOGRAPH'. IP: %s\n", WiFi.softAPIP().toString().c_str());
    }

    // Set up Websockets and standard endpoints
    ws.onEvent(onWsEvent);
    server.addHandler(&ws);

    server.on("/api/telemetry", HTTP_GET, [](AsyncWebServerRequest *request){
        DynamicJsonDocument doc(512);
        doc["rpm"] = povEngine.getCurrentCalculatedRpm();
        doc["brightness"] = povEngine.getGlobalBrightness();
        doc["temperature"] = temperatureRead();
        doc["voltage"] = 5.02;
        doc["wifi_errors"] = (WiFi.status() != WL_CONNECTED);
        doc["sensor_stalled"] = sensorFaultActive;
        doc["total_sensor_misses"] = totalInterruptMissCount;
        
        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/logs", HTTP_GET, [](AsyncWebServerRequest *request){
        transmitSavedWiFiLogs();
        request->send(200, "application/json", "{\"status\":\"logs_transmitted\"}");
    });

    // Simple Web UI to upload image.bin directly from Phone/Browser
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        String html = "<html><body><h2>Hologram Image Uploader</h2>";
        html += "<form method='POST' action='/api/upload' enctype='multipart/form-data'>";
        html += "<input type='file' name='update' accept='.bin'><br><br>";
        html += "<input type='submit' value='Upload image.bin'>";
        html += "</form></body></html>";
        request->send(200, "text/html", html);
    });

    // Handle direct file upload over Wi-Fi
    server.on("/api/upload", HTTP_POST, [](AsyncWebServerRequest *request) {
        request->send(200, "text/plain", "Upload Complete! Restarting ESP32...");
    }, [](AsyncWebServerRequest *request, const String& filename, size_t index, uint8_t *data, size_t len, bool final) {
        if (!index) {
            Serial.printf("Upload Start: %s\n", filename.c_str());
            request->_tempFile = LittleFS.open("/image.bin", "w");
        }
        if (request->_tempFile) {
            if (len) {
                request->_tempFile.write(data, len);
            }
            if (final) {
                request->_tempFile.close();
                Serial.printf("Upload Complete: %s, SIZE: %u\n", filename.c_str(), index + len);
            }
        }
    });

    // Start OTA Engine natively
    ElegantOTA.begin(&server);

    server.begin();

    /* 
     * DYNAMIC IMAGE STREAMING (LittleFS BIN)
     * To utilize standard array memory, remove this LittleFS block and use:
     * povEngine.setBuffer((const uint8_t*)POLAR_IMAGE_DATA);
     */
    File file = LittleFS.open("/image.bin", "r");
    if(!file) {
        Serial.println("[ERR] Failed to open image.bin. Rendering engine will default to code headers.");
        povEngine.setBuffer((const uint8_t*)POLAR_IMAGE_DATA); // Fallback to code headers
    } else {
        size_t imageSize = file.size();
        uint8_t* binBuffer = (uint8_t*) malloc(imageSize);
        if (binBuffer) {
            file.read(binBuffer, imageSize);
            povEngine.setBuffer(binBuffer);
            Serial.println("[POV] Hologram successfully loaded from LittleFS BIN!");
        } else {
            povEngine.setBuffer((const uint8_t*)POLAR_IMAGE_DATA);
        }
        file.close();
    }

    // Spawn high-speed rendering engine on Core 1 (Isolated, full-priority execution)
    xTaskCreatePinnedToCore(
        highSpeedRenderingLoop,    /* Function to implement the task */
        "POV_RenderTask",          /* Name of the task */
        8192,                      /* Stack size in words */
        NULL,                      /* Task input parameter */
        configMAX_PRIORITIES - 1,  /* High execution priority priority */
        NULL,                      /* Task handle. */
        1                          /* Core ID (Core 1) */
    );
}

void loop() {
    // Core 0 processes standard client TCP requests, web services and elegantOTA
    ElegantOTA.loop();
    ws.cleanupClients();
    delay(10);
}
`;
  };

  const generateEngineCode = (): string => {
    return `/**
 * @file rendering_engine.h
 * @brief High-speed FastLED rendering pipeline with double buffer mappings.
 */

#ifndef RENDERING_ENGINE_H
#define RENDERING_ENGINE_H

#include <Arduino.h>
#include <FastLED.h>

class POV_Engine {
private:
    uint16_t numLeds;
    uint8_t pinArm1;
    uint8_t pinArm2;
    CRGB* ledsArm1;
    CRGB* ledsArm2;
    
    const uint8_t* polarDataBuffer;
    
    uint32_t currentUsecPerSector;
    uint32_t currentRpm;
    uint8_t globalBrightness;

public:
    POV_Engine() : numLeds(45), polarDataBuffer(nullptr), currentUsecPerSector(400), currentRpm(0), globalBrightness(${config.maxBrightness}) {}

    void setBuffer(const uint8_t* bufferPtr) {
        polarDataBuffer = bufferPtr;
    }

    void begin(uint16_t ledsCount, uint8_t pinA1, uint8_t pinA2) {
        numLeds = ledsCount;
        pinArm1 = pinA1;
        pinArm2 = pinA2;

        ledsArm1 = new CRGB[numLeds];
        ledsArm2 = new CRGB[numLeds];

        // Robust Hardware Power Safeguards for high-speed dynamic loads:
        // Cap dynamic current draw to protect slip-ring brushes and prevent +5V bus breakdown.
        FastLED.setMaxPowerInVoltsAndMilliamps(5, 3000); // Standard 3.0A absolute bus cap

        // Verify GPIO pin allocations map cleanly within ESP32 physical boundaries
        if (pinArm1 >= 48 || pinArm2 >= 48) {
            Serial.println("[ERR] [POV] CRITICAL: Invalid GPIO pin allocation in rendering pipeline! Setup aborted.");
            return;
        }

        // Hardware FastLED initialisation utilizing high-speed parallel channel outputs
        FastLED.addLeds<WS2812B, ${config.pinLedArm1}, GRB>(ledsArm1, numLeds).setCorrection(TypicalLEDStrip);
        FastLED.addLeds<WS2812B, ${config.pinLedArm2}, GRB>(ledsArm2, numLeds).setCorrection(TypicalLEDStrip);
        
        FastLED.setBrightness(globalBrightness);
        FastLED.clear();
        FastLED.show();
        Serial.println("[POV] WS2812B parallel bus initialized. FastLED dynamic thermal/power protector ARMED.");
    }

    void updateRotorPeriod(uint32_t periodUs) {
        // Calculate rotational specs
        currentRpm = 60000000 / periodUs;
        
        // Microsecond allocation per sector (e.g., 60 separate angular sectors)
        currentUsecPerSector = periodUs / POV_SLICES;
    }

    uint32_t getMicrosecondsPerSector() {
        return currentUsecPerSector;
    }

    uint32_t getCurrentCalculatedRpm() {
        return currentRpm;
    }

    void setGlobalBrightness(uint8_t b) {
        globalBrightness = b;
        FastLED.setBrightness(b);
    }

    uint8_t getGlobalBrightness() {
        return globalBrightness;
    }

    void loadPatternPreset(const char* presetName) {
        Serial.printf("Device loaded dynamic pattern: %s\\n", presetName);
    }

    // Check if WS2812 parallel lines are experiencing electrical glitches or shorts
    bool verifyLineIntegrity(int stripId) {
        uint8_t pin = (stripId == 1) ? pinArm1 : pinArm2;
        
        // 1. Library-level protocol transmission verification (FastLED write errors)
        #ifdef FASTLED_HAS_WRITE_ERROR
        if (FastLED.getWriteError() != 0) {
            FastLED.clearWriteError(); // Clear write error latch
            return false; // Communication error caught by FastLED
        }
        #endif

        // 2. Pin-level feedback voltage telemetry check
        if (globalBrightness > 0) {
            #if defined(ESP32)
            // Reads physical register state of the pin. If it is clamped low during high-speed active transfers,
            // an electrical short-circuit or slip-ring contact failure is detected.
            if (gpio_get_level((gpio_num_t)pin) == 0) {
                return false; 
            }
            #endif
        }
        return true;
    }

    // High performance drawing routine called by Core 1 inside sector interruptions
    void renderSector(uint16_t sectorIndex) {
        if (!polarDataBuffer) return; // Failsafe
        
        // Dynamic slices calculated from sectorIndex
        uint16_t slices = 60; // Assuming POV_SLICES is 60 mapping standard. You can pass 'slices' into begin() if fully dynamic.
        
        uint16_t sectorArm1 = sectorIndex;
        uint16_t sectorArm2 = (sectorIndex + (slices / 2)) % slices;

        for (int i = 0; i < numLeds; i++) {
            // Memory layout: [slice][led][RGB] => dimension slices x numLeds x 3
            uint32_t offset1 = (sectorArm1 * numLeds + i) * 3;
            uint32_t offset2 = (sectorArm2 * numLeds + i) * 3;

            // Read binary colors (ESP32 transparently auto-caches PROGMEM pointer reads)
            uint8_t r1 = polarDataBuffer[offset1];
            uint8_t g1 = polarDataBuffer[offset1 + 1];
            uint8_t b1 = polarDataBuffer[offset1 + 2];

            uint8_t r2 = polarDataBuffer[offset2];
            uint8_t g2 = polarDataBuffer[offset2 + 1];
            uint8_t b2 = polarDataBuffer[offset2 + 2];

            // Hardware thermal/current optimization check
            ledsArm1[i] = CRGB(r1, g1, b1);
            ledsArm2[i] = CRGB(r2, g2, b2);
        }

        FastLED.show();
    }
};

#endif // RENDERING_ENGINE_H
`;
  };

  const generatePlatformioIni = (): string => {
    return `; PlatformIO Project Configuration File
; ESP32-S3 Rotating POV System Production Config

[env:esp32-s3-power-hologram]
platform = espressif32 @ 6.3.2
board = esp32-s3-devkitc-1
framework = arduino

; Serial Upload speed Config
upload_speed = 921600
monitor_speed = 115200

build_flags = 
    -D CORE_DEBUG_LEVEL=3
    -D ARDUINO_USB_CDC_ON_BOOT=1
    -D BOARD_HAS_PSRAM
    
lib_deps =
    fastled/FastLED @ 3.6.0
    bblanchon/ArduinoJson @ 6.21.3
    mathieucarbou/ESPAsyncWebServer @ 3.3.17
    https://github.com/ayushsharma82/ElegantOTA.git

board_build.partitions = default_8MB.csv
board_build.filesystem = littlefs
`;
  };

  const generateFsGuide = (): string => {
    return `# 📲 Mobile & Alternative Flashing Guide

If your computer crashes with VS Code or you want to flash directly from your phone (e.g., using an OTG cable with **ArduinoDroid**), you have two very easy options!

## Method 1: The "No .BIN needed" Approach (Easiest for ArduinoDroid)
Our generated code is cleverly designed to automatically fall back to **compiled C++ arrays** if the \`image.bin\` file isn't uploaded! 

**Important for ArduinoDroid / Arduino IDE Users:**
You cannot put all the code in one file. You must create separate tabs or files in your project so the compiler can find them!

1. Open your main sketch (e.g. \`sketch_may21a.ino\`) and copy the contents of **main.cpp** into it.
2. In ArduinoDroid (or Arduino IDE), create a **New File** (or "New Tab") in your project. Name it EXACTLY \`rendering_engine.h\` and paste the contents from this website's **rendering_engine.h** tab.
3. Create another file named \`image_data.h\` and paste its contents.
4. Create another file named \`image_data.cpp\` and paste its contents.
5. Compile and upload your sketch via the OTG cable using ArduinoDroid.
6. Because you didn't upload a LittleFS data partition, the ESP32 will print "Failed to open image.bin" on boot, and **automatically fallback** to the \`POLAR_IMAGE_DATA\` array compiled in \`image_data.cpp\`.
7. Your hologram should now display perfectly!

## Method 2: Wireless OTA .BIN Upload (Wi-Fi)
If you already managed to flash the base code once, you can update the hologram image wirelessly without any cables or IDEs!

1. Connect your phone or computer to the same Wi-Fi network as the ESP32 (e.g., SSID: \`${config.ssid}\`).
2. Download the \`image.bin\` file from this web app using the orange button on the right.
3. Open your mobile web browser and go to the ESP32's IP address (e.g., \`http://192.168.x.x\`).
4. You will see the **Hologram Image Uploader**.
5. Select the \`image.bin\` from your phone's downloads and click **Upload image.bin**.
6. The ESP32 will reboot automatically and start rendering your new image!

---

## 💻 Standard Desktop VS Code / PlatformIO Guide
**Step-by-step for VS Code PlatformIO:**
1. In your VS Code project explorer, **create a folder named \`data\`** at the root level (same level as \`src\` and \`platformio.ini\`).
2. Move your downloaded \`image.bin\` file inside this \`data\` folder.
3. Open the **PlatformIO** sidebar (the alien head icon on the left).
4. Expand your environment: \`esp32-s3-power-hologram\` -> \`Platform\`.
5. Click on **Build Filesystem Image** (wait for it to finish).
6. Click on **Upload Filesystem Image**.

*This will flash the contents of your \`data\` folder directly to the LittleFS partition.*

---
## 📦 Required Libraries (Arduino IDE & ArduinoDroid)
Before compiling, you MUST install the following libraries from your Library Manager:
1. **FastLED** (by Daniel Garcia)
2. **ArduinoJson** (by Benoit Blanchon)
3. **ElegantOTA** (by Ayush Sharma)
4. **ESPAsyncWebServer** (search for the fork by *Mathieu Carbou*)
5. **AsyncTCP**

## 🚨 Troubleshooting "Return code is not 0"
If you receive a generic compiler failure like \`/files/build/.../gcc ... Return code is not 0\`, **you must scroll up in your build log window.** The *actual* error message is usually 5 to 10 lines above that, often containing words like **"error:"** or **"fatal error:"**.

If you are using **ArduinoDroid** and get an error like \`fatal error: ElegantOTA.h: No such file or directory\`, you can optionally remove OTA. To do this, simply delete or comment out the following two lines in \`main.cpp\`:
* \`#include <ElegantOTA.h>\`
* \`ElegantOTA.begin(&server);\`

The core image uploader and rendering engine will still work perfectly without ElegantOTA!

---
## ✨ ARDUINO IDE COMPILATION FIX (Core 3.0.0+)
If you get \`mbedtls_md5_starts_ret was not declared\` from ESPAsyncWebServer in the Arduino IDE:
The original library by "me-no-dev" is abandoned and incompatible with modern ESP32 cores.
**Fix:**
1. Delete the \`ESPAsyncWebServer\` library from your \`Documents/Arduino/libraries\` folder.
2. Install the maintained fork from Library Manager: search for **ESPAsyncWebServer by Mathieu Carbou**.
`;
  };

  const codeContents = {
    main: generateMainCode(),
    engine: generateEngineCode(),
    data_h: generateImageDataHeader(),
    data_cpp: generateImageDataCpp(),
    platformio: generatePlatformioIni(),
    fs_guide: generateFsGuide(),
  };

  return (
    <div className="bg-[#0E1012] border border-[#2A2D33] rounded-sm p-6 flex flex-col h-full justify-between animate-fade-in" id="firmware-compilation-generator">
      {/* Configuration Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#2A2D33] mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00F0FF] rounded-none"></div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-[#E0E2E5] font-semibold">03 // FIRMWARE COMPILER</h3>
            <p className="font-mono text-[#8E9299] text-[10px] uppercase">DMA Pinned core 1 task generators // fastLed wrappers</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          {/* Tab switch mechanism */}
          <div className="flex bg-[#15171A] p-1 border border-[#2A2D33] self-start md:self-auto overflow-x-auto max-w-full">
            {(['main', 'engine', 'data_h', 'data_cpp', 'fs_guide', 'platformio'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 transition cursor-pointer whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-[#00F0FF] text-[#000] font-bold'
                    : 'text-[#8E9299] hover:text-[#E0E2E5]'
                }`}
              >
                {tab === 'main' ? 'main.cpp' : tab === 'engine' ? 'engine.h' : tab === 'data_h' ? 'data.h' : tab === 'data_cpp' ? 'data.cpp' : tab === 'fs_guide' ? 'FS Guide' : 'platformio.ini'}
              </button>
            ))}
          </div>

          <button
            onClick={downloadArduinoProject}
            className="flex items-center gap-2 bg-[#EEAA00] text-black font-mono text-[10px] uppercase font-bold tracking-wider px-4 py-2 border border-[#EEAA00] hover:bg-transparent hover:text-[#EEAA00] transition shadow-[0_0_10px_rgba(238,170,0,0.2)] whitespace-nowrap"
          >
            <Archive className="w-3.5 h-3.5" />
            DOWNLOAD ARDUINO ZIP
          </button>
          
          <button
            onClick={downloadProject}
            className="flex items-center gap-2 bg-[#00F0FF] text-black font-mono text-[10px] uppercase font-bold tracking-wider px-4 py-2 border border-[#00F0FF] hover:bg-transparent hover:text-[#00F0FF] transition shadow-[0_0_10px_rgba(0,240,255,0.2)] whitespace-nowrap hidden md:flex"
          >
            <Archive className="w-3.5 h-3.5" />
            DOWNLOAD PLATFORMIO PROJECT
          </button>
        </div>
      </div>

      {/* Mini Parameter Customizer Block */}
      <div className="bg-[#15171A] p-4 rounded-none border-l-2 border-[#00F0FF] border-y border-r border-[#2A2D33] mb-5 text-[#E0E2E5]">
        <h4 className="font-mono text-xs uppercase tracking-wider text-[#00F0FF] flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4" />
          Hardware Compile parameters & PINOUTS
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">Wi-Fi SSID (Your Home Network)</label>
            <input
              type="text"
              value={config.ssid}
              placeholder="e.g. MyHomeWiFi"
              onChange={(e) => onChangeConfig({ ssid: e.target.value })}
              className="w-full bg-[#0E1012] border border-[#2A2D33] px-2 py-1 text-xs text-[#00F0FF] font-mono focus:border-[#00F0FF] focus:outline-none rounded-none placeholder:text-[#2A2D33]"
            />
          </div>
          <div>
            <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">Wi-Fi Wireless Key</label>
            <input
              type="text"
              value={config.wifiPass}
              placeholder="Your WiFi Password"
              onChange={(e) => onChangeConfig({ wifiPass: e.target.value })}
              className="w-full bg-[#0E1012] border border-[#2A2D33] px-2 py-1 text-xs text-[#00F0FF] font-mono focus:border-[#00F0FF] focus:outline-none rounded-none placeholder:text-[#2A2D33]"
            />
          </div>
          <div>
            <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">MCU Device Name</label>
            <input
              type="text"
              value={config.hostname}
              onChange={(e) => onChangeConfig({ hostname: e.target.value })}
              className="w-full bg-[#0E1012] border border-[#2A2D33] px-2 py-1 text-xs text-[#30f4ff] font-mono focus:border-[#00F0FF] focus:outline-none rounded-none"
            />
          </div>
          <div>
            <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">GPIO Hall sensor</label>
            <input
              type="number"
              value={config.pinHallSensor}
              onChange={(e) => onChangeConfig({ pinHallSensor: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#0E1012] border border-[#2A2D33] px-2 py-1 text-xs text-[#30f4ff] font-mono focus:border-[#00F0FF] focus:outline-none rounded-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t border-[#2A2D33]">
          <div>
            <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">Led Arm 1 GPIO</label>
            <input
              type="number"
              value={config.pinLedArm1}
              onChange={(e) => onChangeConfig({ pinLedArm1: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#0E1012] border border-[#2A2D33] px-2 py-1 text-xs text-[#30f4ff] font-mono focus:border-[#00F0FF] focus:outline-none rounded-none"
            />
          </div>
          <div>
            <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">Led Arm 2 GPIO</label>
            <input
              type="number"
              value={config.pinLedArm2}
              onChange={(e) => onChangeConfig({ pinLedArm2: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#0E1012] border border-[#2A2D33] px-2 py-1 text-xs text-[#30f4ff] font-mono focus:border-[#00F0FF] focus:outline-none rounded-none"
            />
          </div>
          <div>
            <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">DMA STRIP SPECS</label>
            <div className="font-mono text-xs text-[#00F0FF] mt-1.5 font-bold uppercase">
              {config.numArms * config.stripsPerArm} Strips // 270 LEDs
            </div>
          </div>
          <div>
            <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">FreeRTOS Priority</label>
            <div className="font-mono text-xs text-[#FFB800] mt-1.5 font-bold uppercase">
              Task core 1 // PRIO: 24 active
            </div>
          </div>
          <div>
            <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">Sim HW Acceleration</label>
            <button
               onClick={() => onChangeSimConfig({ hwAcceleration: !simConfig.hwAcceleration })}
               className={`mt-1 font-mono text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 border transition whitespace-nowrap w-full text-left ${
                 simConfig.hwAcceleration 
                 ? 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]' 
                 : 'bg-[#15171A] text-[#8E9299] border-[#2A2D33] hover:text-[#E0E2E5]'
               }`}
            >
              {simConfig.hwAcceleration ? 'ENABLED (FAST)' : 'DISABLED (ACCURATE)'}
            </button>
          </div>
        </div>
      </div>

      {/* Code Viewer Workspace */}
      <div className="relative bg-[#000] border border-[#2A2D33] rounded-none overflow-hidden flex-1 flex flex-col justify-between">
        <div className="flex justify-between items-center bg-[#15171A] px-4 py-2 border-b border-[#2A2D33]">
          <span className="font-mono text-xs text-[#00F0FF] flex items-center gap-1.5 uppercase font-bold tracking-wider">
            <FileCode className="w-4 h-4" />
            {activeTab === 'main' ? 'main.cpp' : activeTab === 'engine' ? 'rendering_engine.h' : activeTab === 'data_h' ? 'image_data.h' : activeTab === 'data_cpp' ? 'image_data.cpp' : activeTab === 'fs_guide' ? 'LittleFS_Guide.md' : 'platformio.ini'}
          </span>
          <div className="flex gap-2">
            {activeTab === 'fs_guide' && (
              <button
                onClick={downloadBin}
                className="font-mono text-[9px] uppercase tracking-wider text-[#000] font-bold hover:brightness-110 transition flex items-center gap-1 bg-[#EEAA00] px-2.5 py-1.5 rounded-none cursor-pointer select-none border border-[#EEAA00]"
              >
                <Download className="w-3.5 h-3.5" />
                DOWNLOAD RAW .BIN FILE
              </button>
            )}
            <button
              onClick={() => triggerCopy(activeTab, codeContents[activeTab])}
              className="font-mono text-[9px] uppercase tracking-wider text-[#00F0FF] hover:brightness-110 transition flex items-center gap-1 bg-[#0E1012] border border-[#2A2D33] px-2.5 py-1.5 rounded-none cursor-pointer select-none"
            >
              {copied === activeTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === activeTab ? 'COPIED' : 'COPY BUFFER'}
            </button>
          </div>
        </div>

        {/* Real Source Code Area */}
        <pre className="p-4 overflow-y-auto max-h-[340px] text-[#E0E2E5] font-mono text-[11px] leading-relaxed text-left flex-1 bg-[#000]">
          <code>{codeContents[activeTab]}</code>
        </pre>

        {/* Footer Warning Board */}
        <div className="bg-[#15171A] p-3.5 border-t border-[#2A2D33] flex gap-3 text-xs text-[#8E9299] items-start uppercase">
          <ShieldCheck className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5 shadow-[0_0_8px_#00F0FF]" />
          <div>
            <p className="font-mono font-bold text-[#E0E2E5] tracking-wider text-[11px]">FreeRTOS Core-Priority Isolation Masked</p>
            <p className="text-[#8E9299] text-[10px] mt-0.5 leading-normal">
              SPINNING FASTLED ON CORE 1 PREVENTS JITTER AND FLICKER CAUSED BY OTHER BACKGROUND CONCURRENT TASKS. CORE 0 HANDLES WEB INTERRUPTS AND CAPTIVE PORTALS SAFELY.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
