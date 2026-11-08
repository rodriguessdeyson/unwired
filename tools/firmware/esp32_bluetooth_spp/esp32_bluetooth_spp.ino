// Original ESP32 with Bluetooth SPP (RFCOMM). Shows up in the app as SPP.
// Not for ESP32-S3 or ESP32-C3, which only have BLE: use the BLE example there.
// Requires the Espressif "esp32" board package.

#include "BluetoothSerial.h"

#if !defined(CONFIG_BT_SPP_ENABLED)
#error This chip or package has no Bluetooth SPP. Use the BLE example.
#endif

BluetoothSerial bt;
String command;
bool streaming = true;
unsigned long lastSend = 0;
unsigned long sample = 0;

void handleCommand(String text) {
  text.trim();
  if (text.isEmpty()) return;
  if (text == "LS") {
    streaming = true;
    bt.print("OK\r\n");
  } else if (text == "DS") {
    streaming = false;
    bt.print("OK\r\n");
  } else {
    bt.printf("ECO %s\r\n", text.c_str());
  }
}

void setup() {
  Serial.begin(115200);
  bt.begin("unWired ESP32");
  Serial.println("Pair with \"unWired ESP32\" in Android settings.");
}

void loop() {
  while (bt.available()) {
    char received = bt.read();
    if (received == '\n' || received == '\r') {
      handleCommand(command);
      command = "";
    } else if (command.length() < 80) {
      command += received;
    }
  }

  if (streaming && bt.hasClient() && millis() - lastSend >= 200) {
    lastSend = millis();
    sample++;
    // Replace these values with your own readings.
    bt.printf("T=%.2f H=%.2f\r\n", 44.0 + 18.0 * sin(sample / 11.0), 61.0 + 6.0 * sin(sample / 23.0));
  }
}
