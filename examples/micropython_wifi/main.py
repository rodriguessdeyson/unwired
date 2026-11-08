# MicroPython on ESP32 or Raspberry Pi Pico W: TCP stream over Wi-Fi.
# In the app: Find devices > Add Wi-Fi by IP > TCP stream > the printed IP and port 8080.
import math
import network
import socket
import time

WIFI_NAME = "YOUR_NETWORK"
WIFI_PASSWORD = "YOUR_PASSWORD"
PORT = 8080

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(WIFI_NAME, WIFI_PASSWORD)
while not wlan.isconnected():
    time.sleep_ms(200)
print("IP:", wlan.ifconfig()[0])

server = socket.socket()
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(("0.0.0.0", PORT))
server.listen(1)


def serve(client):
    client.setblocking(False)
    streaming = True
    pending = b""
    sample = 0
    last_send = time.ticks_ms()

    while True:
        try:
            data = client.recv(64)
            if data == b"":
                return
        except OSError:
            data = None

        if data:
            pending += data
            lines = pending.replace(b"\r", b"\n").split(b"\n")
            pending = lines.pop()
            for line in lines:
                text = line.decode().strip()
                if text == "LS" or text == "DS":
                    streaming = text == "LS"
                    client.write(b"OK\r\n")
                elif text:
                    client.write(("ECO " + text + "\r\n").encode())

        if streaming and time.ticks_diff(time.ticks_ms(), last_send) >= 200:
            last_send = time.ticks_ms()
            sample += 1
            # Replace these values with your own readings.
            temperature = 44 + 18 * math.sin(sample / 11)
            humidity = 61 + 6 * math.sin(sample / 23)
            client.write("T={:.2f} H={:.2f}\r\n".format(temperature, humidity).encode())
        time.sleep_ms(5)


while True:
    client, _ = server.accept()
    try:
        serve(client)
    except OSError:
        pass
    client.close()
