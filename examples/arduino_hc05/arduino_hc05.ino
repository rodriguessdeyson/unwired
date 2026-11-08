// Arduino with an HC-05 or HC-06. Sends T and H and answers commands.
//
// Wiring: module TX to pin 10, module RX to pin 11 through a voltage divider
// (the module RX is 3.3 V), VCC to 5 V and GND to GND.
//
// If nothing happens, set MODULE_BAUD to the speed stored in the module.
// Factory default is usually 9600. Avoid 115200: SoftwareSerial is unreliable at that speed.

#include <SoftwareSerial.h>

const long MODULE_BAUD = 9600;
const unsigned long SEND_INTERVAL_MS = 200;
const int LED = LED_BUILTIN;

SoftwareSerial bt(10, 11);  // RX, TX
String command;
bool streaming = true;
unsigned long lastSend = 0;
unsigned long sample = 0;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
  bt.begin(MODULE_BAUD);
  Serial.println(F("unWired: ready"));
}

void handleCommand(String text) {
  text.trim();
  if (text.length() == 0) return;
  Serial.print(F("Command: "));
  Serial.println(text);

  if (text == "LS") {
    streaming = true;
    bt.print(F("OK\r\n"));
  } else if (text == "DS") {
    streaming = false;
    bt.print(F("OK\r\n"));
  } else if (text == "LED1=ON") {
    digitalWrite(LED, HIGH);
    bt.print(F("LED1 ligado\r\n"));
  } else if (text == "LED1=OFF") {
    digitalWrite(LED, LOW);
    bt.print(F("LED1 desligado\r\n"));
  } else {
    bt.print(F("ECO "));
    bt.print(text);
    bt.print(F("\r\n"));
  }
}

void loop() {
  while (bt.available()) {
    char received = bt.read();
    if (received == '\n' || received == '\r') {
      handleCommand(command);
      command = "";
    } else if (command.length() < 40) {
      command += received;
    }
  }

  if (streaming && millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sample++;
    // Replace these values with your own readings.
    float temperature = 44.0 + 18.0 * sin(sample / 11.0);
    float humidity = 61.0 + 6.0 * sin(sample / 23.0);
    bt.print(F("T="));
    bt.print(temperature, 2);
    bt.print(F(" H="));
    bt.print(humidity, 2);
    bt.print(F("\r\n"));
  }
}
