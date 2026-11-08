// ESP32 or ESP8266 over Wi-Fi: TCP stream, and the app finds it by itself.
// Fill in your network name and password before uploading.

#if defined(ESP32)
#include <WiFi.h>
#else
#include <ESP8266WiFi.h>
#endif
#include <WiFiUdp.h>

const char *WIFI_NAME = "YOUR_NETWORK";
const char *WIFI_PASSWORD = "YOUR_PASSWORD";
const uint16_t TCP_PORT = 8080;
const uint16_t DISCOVERY_PORT = 4210;

WiFiServer server(TCP_PORT);
WiFiClient client;
WiFiUDP udp;
String command;
bool streaming = true;
unsigned long lastSend = 0;
unsigned long sample = 0;

void answerDiscovery() {
  int size = udp.parsePacket();
  if (!size) return;
  char message[32];
  int length = udp.read(message, sizeof(message) - 1);
  if (length <= 0) return;
  message[length] = 0;
  if (String(message).indexOf("DISCOVER_UNWIRED") < 0) return;

  // The id comes from the MAC, so the profile saved in the app survives an IP change.
  String id = WiFi.macAddress();
  id.replace(":", "");
  String reply = "UNWIRED_ACK;id=" + id + ";name=unWired WiFi;tcp=" + String(TCP_PORT);
  udp.beginPacket(udp.remoteIP(), udp.remotePort());
  udp.print(reply);
  udp.endPacket();
}

void handleCommand(String text) {
  text.trim();
  if (text.length() == 0) return;
  if (text == "LS") {
    streaming = true;
    client.print("OK\r\n");
  } else if (text == "DS") {
    streaming = false;
    client.print("OK\r\n");
  } else {
    client.print("ECO " + text + "\r\n");
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print('.');
  }
  Serial.print("\nIP: ");
  Serial.println(WiFi.localIP());
  server.begin();
  udp.begin(DISCOVERY_PORT);
}

void loop() {
  answerDiscovery();

  if (!client || !client.connected()) {
    client = server.accept();
    return;
  }

  while (client.available()) {
    char received = client.read();
    if (received == '\n' || received == '\r') {
      handleCommand(command);
      command = "";
    } else if (command.length() < 80) {
      command += received;
    }
  }

  if (streaming && millis() - lastSend >= 200) {
    lastSend = millis();
    sample++;
    // Replace these values with your own readings.
    client.printf("T=%.2f H=%.2f\r\n", 44.0 + 18.0 * sin(sample / 11.0), 61.0 + 6.0 * sin(sample / 23.0));
  }
}
