import cGeneric from '../../../tools/examples/c_generic/unwired.c' with { loader: 'text' };
import micropythonUart from '../../../tools/examples/micropython_uart/main.py' with { loader: 'text' };
import micropythonWifi from '../../../tools/examples/micropython_wifi/main.py' with { loader: 'text' };
import nodeTcp from '../../../tools/examples/node_tcp/device.mjs' with { loader: 'text' };
import pythonTcp from '../../../tools/examples/python_tcp/device.py' with { loader: 'text' };
import arduinoDht11 from '../../../tools/firmware/arduino_dht11/arduino_dht11.ino' with { loader: 'text' };
import arduinoHc05 from '../../../tools/firmware/arduino_hc05/arduino_hc05.ino' with { loader: 'text' };
import arduinoHcsr04 from '../../../tools/firmware/arduino_hcsr04/arduino_hcsr04.ino' with { loader: 'text' };
import arduinoLed from '../../../tools/firmware/arduino_led/arduino_led.ino' with { loader: 'text' };
import arduinoLm35 from '../../../tools/firmware/arduino_lm35/arduino_lm35.ino' with { loader: 'text' };
import esp32Ble from '../../../tools/firmware/esp32_ble_uart/esp32_ble_uart.ino' with { loader: 'text' };
import esp32Spp from '../../../tools/firmware/esp32_bluetooth_spp/esp32_bluetooth_spp.ino' with { loader: 'text' };
import esp32Wifi from '../../../tools/firmware/esp32_wifi/esp32_wifi.ino' with { loader: 'text' };
import esp8266Http from '../../../tools/firmware/esp8266_http/esp8266_http.ino' with { loader: 'text' };

export interface CodeExample {
  /** Chave do título e da descrição em guide.examples. */
  id: string;
  /** `project` faz algo com um componente; `board` mostra como conectar uma placa. */
  group: 'project' | 'board';
  language: string;
  link: 'SPP' | 'BLE' | 'WIFI';
  file: string;
  code: string;
}

export const EXAMPLES: CodeExample[] = [
  { id: 'arduinoLed', group: 'project', language: 'Arduino', link: 'SPP', file: 'arduino_led.ino', code: arduinoLed },
  { id: 'arduinoDht11', group: 'project', language: 'Arduino', link: 'SPP', file: 'arduino_dht11.ino', code: arduinoDht11 },
  { id: 'arduinoLm35', group: 'project', language: 'Arduino', link: 'SPP', file: 'arduino_lm35.ino', code: arduinoLm35 },
  { id: 'arduinoHcsr04', group: 'project', language: 'Arduino', link: 'SPP', file: 'arduino_hcsr04.ino', code: arduinoHcsr04 },
  { id: 'arduinoHc05', group: 'board', language: 'Arduino', link: 'SPP', file: 'arduino_hc05.ino', code: arduinoHc05 },
  { id: 'esp32Spp', group: 'board', language: 'Arduino', link: 'SPP', file: 'esp32_bluetooth_spp.ino', code: esp32Spp },
  { id: 'esp32Ble', group: 'board', language: 'Arduino', link: 'BLE', file: 'esp32_ble_uart.ino', code: esp32Ble },
  { id: 'esp32Wifi', group: 'board', language: 'Arduino', link: 'WIFI', file: 'esp32_wifi.ino', code: esp32Wifi },
  { id: 'esp8266Http', group: 'board', language: 'Arduino', link: 'WIFI', file: 'esp8266_http.ino', code: esp8266Http },
  { id: 'micropythonWifi', group: 'board', language: 'MicroPython', link: 'WIFI', file: 'main.py', code: micropythonWifi },
  { id: 'micropythonUart', group: 'board', language: 'MicroPython', link: 'SPP', file: 'main.py', code: micropythonUart },
  { id: 'pythonTcp', group: 'board', language: 'Python', link: 'WIFI', file: 'device.py', code: pythonTcp },
  { id: 'nodeTcp', group: 'board', language: 'Node.js', link: 'WIFI', file: 'device.mjs', code: nodeTcp },
  { id: 'cGeneric', group: 'board', language: 'C', link: 'SPP', file: 'unwired.c', code: cGeneric },
];

export const LANGUAGES = [...new Set(EXAMPLES.map((example) => example.language))];
