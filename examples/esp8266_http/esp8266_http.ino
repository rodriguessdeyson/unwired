// ESP8266 in commands-only mode of the unWired Wi-Fi protocol.
// The app search finds it, or use Add Wi-Fi by IP > Automatic.
// The discovery reply has no tcp= field, so the app opens it as commands only:
// each command arrives as GET /set?c=<command>. There is no data going back,
// so there is no chart or received text.

#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <WiFiUdp.h>

const char *WIFI_NAME = "YOUR_NETWORK";
const char *WIFI_PASSWORD = "YOUR_PASSWORD";
const uint16_t DISCOVERY_PORT = 4210;
const int LED = LED_BUILTIN;

ESP8266WebServer server(80);
WiFiUDP udp;

// Example: /set?c=L&r=255&g=0&b=0
void handleSet() {
  String command = server.arg("c");
  if (command == "L") {
    digitalWrite(LED, LOW);  // The built-in LED is on at LOW.
    int red = server.arg("r").toInt();
    int green = server.arg("g").toInt();
    int blue = server.arg("b").toInt();
    Serial.printf("On: %d %d %d\n", red, green, blue);
  } else if (command == "D") {
    digitalWrite(LED, HIGH);
    Serial.println("Off");
  }
  // CHECK only needs the 200: the app sends it to test the connection.
  server.send(200, "text/plain", "OK");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  digitalWrite(LED, HIGH);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(300);
  Serial.println(WiFi.localIP());
  server.on("/set", handleSet);
  server.begin();
  udp.begin(DISCOVERY_PORT);
}

void loop() {
  server.handleClient();
  if (udp.parsePacket()) {
    char message[32];
    int length = udp.read(message, sizeof(message) - 1);
    if (length > 0) {
      message[length] = 0;
      if (String(message).indexOf("DISCOVER_UNWIRED") >= 0) {
        // A fixed id keeps the device's saved settings even if its IP changes.
        String id = WiFi.macAddress();
        id.replace(":", "");
        udp.beginPacket(udp.remoteIP(), udp.remotePort());
        udp.print("UNWIRED_ACK;id=" + id + ";name=unWired commands");
        udp.endPacket();
      }
    }
  }
}
