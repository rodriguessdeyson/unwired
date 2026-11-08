// Read temperature and humidity from a DHT11. Arduino Uno or Nano with an HC-05 or HC-06.
//
// Library: in the Arduino IDE, open Library Manager, install "DHT sensor library"
// by Adafruit and accept its dependencies.
//
// HC-05 wiring: module TX to pin 10, module RX to pin 11 through a voltage
// divider (the module RX is 3.3 V), VCC to 5 V and GND to GND.
//
// DHT11 wiring: VCC to 5 V, DATA to pin 2 and GND to GND. A bare 4-pin sensor also
// needs a 10k resistor between DATA and VCC. Modules on a small board already have it.
//
// In the app, the T block shows degrees Celsius and the H block shows % humidity.
// For a DHT22, change DHT_TYPE to DHT22.
//
// Reading the sensor pauses interrupts for a few milliseconds, so a command that
// arrives at that exact moment can be lost. If that happens, send it again.

#include <DHT.h>
#include <SoftwareSerial.h>

const long MODULE_BAUD = 9600;
const unsigned long SEND_INTERVAL_MS = 2000;  // The DHT11 needs at least 1 s between readings.
const int DHT_PIN = 2;
const int DHT_TYPE = DHT11;

SoftwareSerial bt(10, 11);  // RX, TX
DHT dht(DHT_PIN, DHT_TYPE);
String command;
bool streaming = true;
unsigned long lastSend = 0;

void setup() {
  bt.begin(MODULE_BAUD);
  dht.begin();
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
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    bt.print(F("Erro ao ler o DHT11. Confira os fios.\r\n"));
    return;
  }

  bt.print(F("T="));
  bt.print(temperature, 1);
  bt.print(F(" H="));
  bt.print(humidity, 1);
  bt.print(F("\r\n"));
}

void loop() {
  readCommands();

  if (streaming && millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendReading();
  }
}
