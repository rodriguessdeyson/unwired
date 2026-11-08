// ESP32 with BLE using the Nordic UART service. Shows up in the app as BLE.
// Works across the ESP32 family, including S3 and C3.
// Requires the Espressif "esp32" board package and its BLE library.

#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>

#define SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define RX_UUID "6e400002-b5a3-f393-e0a9-e50e24dcca9e"  // The app writes here
#define TX_UUID "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // The app reads from here

BLECharacteristic *tx;
volatile bool connected = false;
bool streaming = true;
String pendingCommand;
volatile bool hasCommand = false;
unsigned long lastSend = 0;
unsigned long sample = 0;

void send(const String &text) {
  // Packets of up to 20 bytes: the limit without negotiating a larger MTU.
  for (unsigned int start = 0; start < text.length(); start += 20) {
    String part = text.substring(start, start + 20);
    tx->setValue((uint8_t *)part.c_str(), part.length());
    tx->notify();
    delay(5);
  }
}

class ServerEvents : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { connected = true; }
  void onDisconnect(BLEServer *server) override {
    connected = false;
    server->getAdvertising()->start();
  }
};

class RxEvents : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    pendingCommand += String(characteristic->getValue().c_str());
    if (pendingCommand.indexOf('\n') >= 0 || pendingCommand.indexOf('\r') >= 0) hasCommand = true;
  }
};

void handleCommand() {
  String text = pendingCommand;
  pendingCommand = "";
  hasCommand = false;
  text.trim();
  if (text.isEmpty()) return;
  if (text == "LS") {
    streaming = true;
    send("OK\r\n");
  } else if (text == "DS") {
    streaming = false;
    send("OK\r\n");
  } else {
    send("ECO " + text + "\r\n");
  }
}

void setup() {
  Serial.begin(115200);
  BLEDevice::init("unWired BLE");
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerEvents());
  BLEService *service = server->createService(SERVICE_UUID);

  tx = service->createCharacteristic(TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  tx->addDescriptor(new BLE2902());
  BLECharacteristic *rx = service->createCharacteristic(
      RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new RxEvents());
  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("Advertising as \"unWired BLE\".");
}

void loop() {
  if (hasCommand) handleCommand();

  if (connected && streaming && millis() - lastSend >= 200) {
    lastSend = millis();
    sample++;
    // Replace these values with your own readings.
    char line[40];
    snprintf(line, sizeof(line), "T=%.2f H=%.2f\r\n", 44.0 + 18.0 * sin(sample / 11.0), 61.0 + 6.0 * sin(sample / 23.0));
    send(line);
  }
}
