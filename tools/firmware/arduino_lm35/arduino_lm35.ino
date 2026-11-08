// Read temperature from an LM35. Arduino Uno or Nano with an HC-05 or HC-06.
// The LM35 measures temperature only. For humidity too, use the DHT11 example.
//
// HC-05 wiring: module TX to pin 10, module RX to pin 11 through a voltage
// divider (the module RX is 3.3 V), VCC to 5 V and GND to GND.
//
// LM35 wiring, with the flat side facing you and the legs down:
// left leg to 5 V, middle leg to A0, right leg to GND.
// If the sensor gets hot, it is reversed: disconnect it right away.
//
// In the app, the T block shows degrees Celsius.
// The reading depends on the board's real 5 V. If it looks off, measure the 5 V pin
// with a multimeter and use that value in REFERENCE_VOLTS.

#include <SoftwareSerial.h>

const long MODULE_BAUD = 9600;
const unsigned long SEND_INTERVAL_MS = 500;
const int SENSOR_PIN = A0;
const float REFERENCE_VOLTS = 5.0;
const int SAMPLES = 16;  // Averaging several readings steadies the value.

SoftwareSerial bt(10, 11);  // RX, TX
String command;
bool streaming = true;
unsigned long lastSend = 0;

void setup() {
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

float readTemperature() {
  long total = 0;
  for (int i = 0; i < SAMPLES; i++) {
    total += analogRead(SENSOR_PIN);
  }
  float volts = (total / (float)SAMPLES) * REFERENCE_VOLTS / 1024.0;
  return volts * 100.0;  // The LM35 outputs 10 mV per degree Celsius.
}

void loop() {
  readCommands();

  if (streaming && millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    bt.print(F("T="));
    bt.print(readTemperature(), 1);
    bt.print(F("\r\n"));
  }
}
