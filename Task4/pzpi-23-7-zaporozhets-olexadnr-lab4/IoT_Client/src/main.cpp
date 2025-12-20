#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// ===== OLED =====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
const int I2C_SDA = 21;
const int I2C_SCL = 22;

// ===== WiFi (Wokwi) =====
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";

// ===== Buttons =====
const int PIN_START       = 13;
const int PIN_END         = 12;
const int PIN_BREAK_START = 14;
const int PIN_BREAK_END   = 27;

// ===== Persistent HTTP clients (IMPORTANT FIX) =====
WiFiClient plainClient;
WiFiClientSecure tlsClient;

// ===== Device / Auth / Backend config =====
String DEVICE_ID = "ESP32-TIME-TERM-01";

String API_BASE = "OFFLINE";  // "OFFLINE" or "http(s)://..."
String JWT_TOKEN = "";        // Bearer token
String AUTH_EMAIL = "";       // we'll treat as "login" for backend
String AUTH_PASS = "";        // password

// MODE=API -> uses /api/time-entries/*
// MODE=RAW -> sends to IOT_PATH (still with JWT)
String MODE = "API";
String IOT_PATH = "/api/iot/events";

// ===== State machine =====
enum WorkState { IDLE, WORKING, ON_BREAK };
WorkState state = IDLE;

// ===== Timing =====
unsigned long workStartMs = 0;
unsigned long breakStartMs = 0;
unsigned long totalBreakMs = 0;

// ===== Last event / status =====
String lastEvent = "-";
int lastHttpCode = 0;
String lastHttpMsg = "";

// ===== Offline queue =====
struct EventItem {
  String urlPath;
  String json;
  bool needsAuth;
};
EventItem queueBuf[10];
int qHead = 0, qTail = 0;

bool queueIsEmpty() { return qHead == qTail; }
bool queueIsFull() { return ((qTail + 1) % 10) == qHead; }

int queueCount() {
  if (qTail >= qHead) return qTail - qHead;
  return 10 - (qHead - qTail);
}

void enqueue(const String& urlPath, const String& json, bool needsAuth) {
  if (queueIsFull()) qHead = (qHead + 1) % 10;
  queueBuf[qTail].urlPath = urlPath;
  queueBuf[qTail].json = json;
  queueBuf[qTail].needsAuth = needsAuth;
  qTail = (qTail + 1) % 10;
}

bool dequeue(EventItem& out) {
  if (queueIsEmpty()) return false;
  out = queueBuf[qHead];
  qHead = (qHead + 1) % 10;
  return true;
}

// ===== Helpers =====
String stateShort() {
  if (state == IDLE) return "IDLE";
  if (state == WORKING) return "WORK";
  return "BREAK";
}

String two(int v) { return (v < 10 ? "0" : "") + String(v); }

String fmtMmSs(unsigned long ms) {
  unsigned long sec = ms / 1000UL;
  int mm = (int)(sec / 60UL);
  int ss = (int)(sec % 60UL);
  return two(mm) + ":" + two(ss);
}

unsigned long currentBreakMs() {
  if (state == ON_BREAK) return totalBreakMs + (millis() - breakStartMs);
  return totalBreakMs;
}

unsigned long currentWorkNetMs() {
  if (state == IDLE) return 0;
  unsigned long worked = millis() - workStartMs;
  unsigned long br = currentBreakMs();
  if (worked > br) return worked - br;
  return 0;
}

String joinUrl(const String& base, const String& path) {
  if (base.endsWith("/") && path.startsWith("/")) return base.substring(0, base.length() - 1) + path;
  if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
  return base + path;
}

String makeEventJson(const String& type, long workedMinutes, long breakMinutes) {
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["type"] = type;
  doc["state"] = stateShort();
  doc["workedMinutes"] = workedMinutes;
  doc["breakMinutes"] = breakMinutes;
  doc["tsMs"] = (unsigned long)millis();

  String out;
  serializeJson(doc, out);
  return out;
}

String endpointForType(const String& type) {
  if (MODE == "RAW") return IOT_PATH;

  if (type == "START_WORK") return "/api/time-entries/start-work";
  if (type == "END_WORK") return "/api/time-entries/end-work";
  if (type == "BREAK_START") return "/api/time-entries/break-start";
  if (type == "BREAK_END") return "/api/time-entries/break-end";
  return IOT_PATH;
}

bool hasUsableBase() {
  return !(API_BASE == "" || API_BASE == "OFFLINE");
}

// ===== HTTP (supports OFFLINE) =====
bool httpPostJson(const String& url, const String& json, bool addAuth) {
  lastHttpMsg = "";

  if (!hasUsableBase()) {
    lastHttpCode = 299;
    Serial.println("[SIM] OFFLINE mode: event stored/printed");
    Serial.print("[SIM] url="); Serial.println(url);
    Serial.print("[SIM] payload="); Serial.println(json);
    return true;
  }

  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  int code = -1;
  String resp;

  // IMPORTANT FIX: use persistent clients (tlsClient/plainClient)
  if (url.startsWith("https://")) {
    http.begin(tlsClient, url);
  } else {
    http.begin(plainClient, url);
  }

  http.addHeader("Content-Type", "application/json");
  if (addAuth && JWT_TOKEN.length() > 0) {
    http.addHeader("Authorization", "Bearer " + JWT_TOKEN);
  }

  Serial.print("[HTTP] POST ");
  Serial.println(url);

  code = http.POST(json);
  resp = http.getString();
  http.end();

  lastHttpCode = code;
  lastHttpMsg = resp;

  Serial.print("[HTTP] code="); Serial.print(code);
  if (resp.length() > 0) {
    Serial.print(" resp=");
    Serial.println(resp);
  } else {
    Serial.println();
  }

  return code >= 200 && code < 300;
}

// avoid spam
unsigned long lastQueueTryMs = 0;

void flushQueueIfPossible() {
  if (!hasUsableBase()) return;

  unsigned long now = millis();
  if (now - lastQueueTryMs < 2000) return;
  lastQueueTryMs = now;

  if (queueIsEmpty()) return;

  EventItem item;
  if (!dequeue(item)) return;

  if (item.needsAuth && JWT_TOKEN.length() == 0) {
    enqueue(item.urlPath, item.json, item.needsAuth);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    enqueue(item.urlPath, item.json, item.needsAuth);
    return;
  }

  String url = joinUrl(API_BASE, item.urlPath);
  Serial.println("[QUEUE] sending stored event...");
  if (!httpPostJson(url, item.json, item.needsAuth)) {
    Serial.println("[QUEUE] failed, put back");
    enqueue(item.urlPath, item.json, item.needsAuth);
  } else {
    Serial.println("[QUEUE] sent");
  }
}

// ===== OLED UI (2 pages, auto rotate) =====
int page = 0;
unsigned long lastPageSwitchMs = 0;
unsigned long lastOledTickMs = 0;

String shortDevId() {
  if (DEVICE_ID.length() <= 10) return DEVICE_ID;
  return DEVICE_ID.substring(0, 10) + "..";
}

String shortBase() {
  if (!hasUsableBase()) return "OFFLINE";
  if (API_BASE.length() <= 16) return API_BASE;
  return API_BASE.substring(0, 16) + "..";
}

String shortMode() {
  if (MODE == "API") return "API";
  return "RAW";
}

void drawSummary() {
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.print(stateShort());

  display.setTextSize(1);
  display.setCursor(0, 22);
  display.print("Work ");
  display.print(fmtMmSs(currentWorkNetMs()));

  display.setCursor(0, 34);
  display.print("Break ");
  display.print(fmtMmSs(currentBreakMs()));

  display.setCursor(0, 46);
  display.print("Last ");
  display.print(lastEvent);

  display.setCursor(0, 56);
  display.print("WiFi:");
  display.print((WiFi.status() == WL_CONNECTED) ? "OK" : "NO");
  display.print(" H:");
  display.print(lastHttpCode);
  display.print(" Q:");
  display.print(queueCount());
}

void drawConfig() {
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.print("CFG ");

  display.setCursor(0, 12);
  display.print("Dev : ");
  display.print(shortDevId());

  display.setCursor(0, 24);
  display.print("Base: ");
  display.print(shortBase());

  display.setCursor(0, 36);
  display.print("Mode: ");
  display.print(shortMode());

  display.setCursor(0, 48);
  display.print("Auth: ");
  display.print(JWT_TOKEN.length() > 0 ? "TOKEN" : "NONE");

  display.setCursor(0, 58);
  display.print("Type HELP / STATUS");
}

void oledRender(bool force = false) {
  unsigned long now = millis();

  if (!force && now - lastOledTickMs < 200) return;
  lastOledTickMs = now;

  if (now - lastPageSwitchMs > 5000) {
    page = (page + 1) % 2;
    lastPageSwitchMs = now;
  }

  display.clearDisplay();
  if (page == 0) drawSummary();
  else drawConfig();
  display.display();
}

// ===== Serial commands =====
void printHelp() {
  Serial.println("Commands:");
  Serial.println("  CFG BASE=OFFLINE | http://... | https://...");
  Serial.println("  CFG MODE=API | RAW");
  Serial.println("  CFG IOTPATH=/api/iot/events        (for MODE=RAW)");
  Serial.println("  CFG TOKEN=<jwt>                    (set Bearer token)");
  Serial.println("  CFG EMAIL=<login>                  (for LOGIN: treated as login)");
  Serial.println("  CFG PASS=<password>                (for LOGIN)");
  Serial.println("  LOGIN                              (POST /api/auth/login)");
  Serial.println("  STATUS");
  Serial.println("  HELP");
}

void printStatus() {
  Serial.print("[STATUS] WiFi=");
  Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
  Serial.print("[STATUS] state="); Serial.println(stateShort());
  Serial.print("[STATUS] BASE="); Serial.println(API_BASE);
  Serial.print("[STATUS] MODE="); Serial.println(MODE);
  Serial.print("[STATUS] IOTPATH="); Serial.println(IOT_PATH);
  Serial.print("[STATUS] DEV="); Serial.println(DEVICE_ID);
  Serial.print("[STATUS] token="); Serial.println(JWT_TOKEN.length() > 0 ? "(set)" : "(none)");
  Serial.print("[STATUS] queueCount="); Serial.println(queueCount());
}

bool doLogin() {
  if (!hasUsableBase()) {
    Serial.println("[AUTH] BASE=OFFLINE, login skipped");
    return false;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[AUTH] no WiFi");
    return false;
  }
  if (AUTH_EMAIL.length() == 0 || AUTH_PASS.length() == 0) {
    Serial.println("[AUTH] set EMAIL(login) and PASS first");
    return false;
  }

  // FIX: your backend uses { login, password }
  StaticJsonDocument<256> doc;
  doc["login"] = AUTH_EMAIL;     // treat EMAIL field as "login"
  doc["password"] = AUTH_PASS;

  String body;
  serializeJson(doc, body);

  String url = joinUrl(API_BASE, "/api/auth/login");

  if (!httpPostJson(url, body, false)) {
    Serial.println("[AUTH] login failed");
    return false;
  }

  StaticJsonDocument<512> respDoc;
  DeserializationError err = deserializeJson(respDoc, lastHttpMsg);
  if (err) {
    Serial.println("[AUTH] can't parse response JSON");
    return false;
  }

  const char* t1 = respDoc["token"];
  const char* t2 = respDoc["accessToken"];
  if (t1 && String(t1).length() > 0) JWT_TOKEN = String(t1);
  else if (t2 && String(t2).length() > 0) JWT_TOKEN = String(t2);
  else {
    Serial.println("[AUTH] token field not found in response");
    return false;
  }

  Serial.println("[AUTH] token set");
  oledRender(true);
  return true;
}

void handleSerial() {
  if (!Serial.available()) return;

  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return;

  if (line == "HELP") { printHelp(); return; }
  if (line == "STATUS") { printStatus(); oledRender(true); return; }
  if (line == "LOGIN") { doLogin(); return; }

  if (!line.startsWith("CFG ")) {
    Serial.println("[SER] unknown command. Type HELP");
    return;
  }

  String kv = line.substring(4);
  int eq = kv.indexOf('=');
  if (eq < 0) {
    Serial.println("[CFG] invalid. Example: CFG BASE=OFFLINE");
    return;
  }

  String key = kv.substring(0, eq);
  String val = kv.substring(eq + 1);
  key.trim();
  val.trim();

  if (key == "BASE") API_BASE = val;
  else if (key == "MODE") MODE = val;
  else if (key == "IOTPATH") IOT_PATH = val;
  else if (key == "TOKEN") JWT_TOKEN = val;
  else if (key == "EMAIL") AUTH_EMAIL = val;   // treated as login
  else if (key == "PASS") AUTH_PASS = val;
  else if (key == "DEV") DEVICE_ID = val;
  else {
    Serial.println("[CFG] unknown key. Use BASE/MODE/IOTPATH/TOKEN/EMAIL/PASS/DEV");
    return;
  }

  Serial.println("[CFG] updated");
  printStatus();
  oledRender(true);
}

// ===== Business logic =====
void sendOrQueue(const String& tag, const String& type, long workedMin, long breakMin) {
  lastEvent = tag;

  String urlPath = endpointForType(type);
  String json = makeEventJson(type, workedMin, breakMin);

  Serial.print("[EV] "); Serial.print(type);
  Serial.print(" -> "); Serial.println(urlPath);
  Serial.println(json);

  // IMPORTANT: for both API and RAW we usually need JWT
  bool needsAuth = hasUsableBase();

  if (!hasUsableBase()) {
    enqueue(urlPath, json, needsAuth);
    lastHttpCode = 299;
    oledRender(true);
    return;
  }

  if (needsAuth && JWT_TOKEN.length() == 0) {
    Serial.println("[EV] no token, queued");
    enqueue(urlPath, json, needsAuth);
    lastHttpCode = 498;
    oledRender(true);
    return;
  }

  String url = joinUrl(API_BASE, urlPath);
  if (!httpPostJson(url, json, needsAuth)) {
    enqueue(urlPath, json, needsAuth);
  }

  oledRender(true);
}

void onStartWork() {
  if (state != IDLE) {
    Serial.println("[BL] StartWork denied");
    lastEvent = "DENY_START";
    oledRender(true);
    return;
  }
  state = WORKING;
  workStartMs = millis();
  totalBreakMs = 0;
  sendOrQueue("START", "START_WORK", 0, 0);
}

void onEndWork() {
  if (state == IDLE) {
    Serial.println("[BL] EndWork denied");
    lastEvent = "DENY_END";
    oledRender(true);
    return;
  }

  if (state == ON_BREAK) totalBreakMs += (millis() - breakStartMs);

  unsigned long workedMs = (millis() - workStartMs);
  long breakMin = (long)(totalBreakMs / 60000UL);
  long workedMin = (long)((workedMs > totalBreakMs ? (workedMs - totalBreakMs) : 0) / 60000UL);

  state = IDLE;
  sendOrQueue("END", "END_WORK", workedMin, breakMin);
}

void onBreakStart() {
  if (state != WORKING) {
    Serial.println("[BL] BreakStart denied");
    lastEvent = "DENY_BS";
    oledRender(true);
    return;
  }
  state = ON_BREAK;
  breakStartMs = millis();
  sendOrQueue("B+ ", "BREAK_START", 0, (long)(totalBreakMs / 60000UL));
}

void onBreakEnd() {
  if (state != ON_BREAK) {
    Serial.println("[BL] BreakEnd denied");
    lastEvent = "DENY_BE";
    oledRender(true);
    return;
  }
  totalBreakMs += (millis() - breakStartMs);
  state = WORKING;
  sendOrQueue("B- ", "BREAK_END", 0, (long)(totalBreakMs / 60000UL));
}

// ===== Buttons edge detect =====
bool prevStart = true, prevEnd = true, prevBS = true, prevBE = true;

void connectWiFiWithTimeout(unsigned long timeoutMs) {
  Serial.println("Connecting WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeoutMs) {
    delay(200);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected.");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connect timeout (offline allowed).");
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_START, INPUT_PULLUP);
  pinMode(PIN_END, INPUT_PULLUP);
  pinMode(PIN_BREAK_START, INPUT_PULLUP);
  pinMode(PIN_BREAK_END, INPUT_PULLUP);

  Wire.begin(I2C_SDA, I2C_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Time Terminal");
  display.println("Booting...");
  display.display();

  // IMPORTANT: configure TLS client once
  tlsClient.setInsecure();

  connectWiFiWithTimeout(7000);

  printHelp();
  printStatus();

  lastPageSwitchMs = millis();
  oledRender(true);
}

void loop() {
  handleSerial();
  flushQueueIfPossible();

  bool curStart = digitalRead(PIN_START);
  bool curEnd   = digitalRead(PIN_END);
  bool curBS    = digitalRead(PIN_BREAK_START);
  bool curBE    = digitalRead(PIN_BREAK_END);

  if (prevStart && !curStart) onStartWork();
  if (prevEnd   && !curEnd)   onEndWork();
  if (prevBS    && !curBS)    onBreakStart();
  if (prevBE    && !curBE)    onBreakEnd();

  prevStart = curStart;
  prevEnd = curEnd;
  prevBS = curBS;
  prevBE = curBE;

  oledRender(false);
  delay(30);
}
