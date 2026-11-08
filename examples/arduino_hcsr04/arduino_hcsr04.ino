// Measure distance with an HC-SR04 ultrasonic sensor. Arduino Uno or Nano with an HC-05 or HC-06.
//
// HC-05 wiring: module TX to pin 10, module RX to pin 11 through a voltage
// divider (the module RX is 3.3 V), VCC to 5 V and GND to GND.
//
// HC-SR04 wiring: VCC to 5 V, TRIG to pin 7, ECHO to pin 6 and GND to GND.
//
// In the app, the Dist block shows the distance in centimeters.
// The sensor works from about 2 cm to 400 cm.

#include <SoftwareSerial.h>

const long MODULE_BAUD = 9600;
const unsigned long SEND_INTERVAL_MS = 200;  // Keep it above 60 ms so old echoes fade.
const unsigned long ECHO_TIMEOUT_US = 30000;  // About 5 m. Past that, give up.
const int TRIG_PIN = 7;
const int ECHO_PIN = 6;

SoftwareSerial bt(10, 11);  // RX, TX
String command;
bool streaming = true;
unsigned long lastSend = 0;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  bt.begin(MODULE_BAUD);
}

void handleCommand(String text) {
  text.trim();
  if (text == "LS") {
    streaming = true;
    bt.print(F("OK\r\n"));
  } else if (text == "DS") {
    streaming = false;
    bt.print(F("OK\r\n"));
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

void sendReading() {
  // A 10 microsecond pulse on TRIG fires the sensor.
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // ECHO stays high for as long as the sound takes to go and come back.
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);

  if (duration == 0) {
    bt.print(F("Sem eco: nada ao alcance do sensor.\r\n"));
    return;
  }

  bt.print(F("Dist="));
  bt.print(duration / 58.0, 1);  // Sound covers 1 cm, there and back, in about 58 us.
  bt.print(F("\r\n"));
}

void loop() {
  readCommands();

  if (streaming && millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendReading();
  }
}
