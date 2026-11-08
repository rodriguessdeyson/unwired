// Turn an LED on and off from the app. Arduino Uno or Nano with an HC-05 or HC-06.
//
// HC-05 wiring: module TX to pin 10, module RX to pin 11 through a voltage
// divider (the module RX is 3.3 V), VCC to 5 V and GND to GND.
//
// LED wiring: none, this sketch uses the LED on the board. For your own LED, connect
// pin 7 to a 220 ohm resistor, the resistor to the long LED leg and the short leg
// to GND, then change LED_PIN to 7.
//
// In the app, send LED1=ON or LED1=OFF in the terminal.
// The LED1 block shows the current state: 1 is on, 0 is off.

#include <SoftwareSerial.h>

const long MODULE_BAUD = 9600;
const unsigned long SEND_INTERVAL_MS = 500;
const int LED_PIN = LED_BUILTIN;

SoftwareSerial bt(10, 11);  // RX, TX
String command;
bool streaming = true;
bool ledOn = false;
unsigned long lastSend = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  bt.begin(MODULE_BAUD);
}

void handleCommand(String text) {
  text.trim();
  if (text.length() == 0) return;

  if (text == "LED1=ON") {
    ledOn = true;
    digitalWrite(LED_PIN, HIGH);
    bt.print(F("LED1 ligado\r\n"));
  } else if (text == "LED1=OFF") {
    ledOn = false;
    digitalWrite(LED_PIN, LOW);
    bt.print(F("LED1 desligado\r\n"));
  } else if (text == "LS") {
    streaming = true;
    bt.print(F("OK\r\n"));
  } else if (text == "DS") {
    streaming = false;
    bt.print(F("OK\r\n"));
  } else {
    bt.print(F("Comando desconhecido: "));
    bt.print(text);
    bt.print(F("\r\n"));
  }
}

void readCommands() {
  while (bt.available()) {
    char received = bt.read();
    if (received == '\n' || received == '\r') {
      handleCommand(command);
      command = "";
    } else if (command.length() < 40) {
      command += received;
    }
  }
}

void loop() {
  readCommands();

  if (streaming && millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    bt.print(F("LED1="));
    bt.print(ledOn ? 1 : 0);
    bt.print(F("\r\n"));
  }
}
