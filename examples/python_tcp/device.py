# Fake sensor for unWired over Wi-Fi, for a PC or Raspberry Pi.
# Run: python device.py
# In the app: Find devices > Add Wi-Fi by IP > TCP stream > this PC's IP and port 8080.
import math
import select
import socket
import time

PORT = 8080
SEND_EVERY = 0.2


def handle_command(text):
    """Returns the reply and whether the device should keep streaming (None = no change)."""
    if text == "LS":
        return "OK", True
    if text == "DS":
        return "OK", False
    return f"ECO {text}", None


def serve(client):
    streaming = True
    pending = b""
    sample = 0
    next_send = time.monotonic()

    while True:
        timeout = max(0, next_send - time.monotonic())
        readable, _, _ = select.select([client], [], [], timeout)
        if readable:
            data = client.recv(256)
            if not data:
                return
            pending += data
            *lines, pending = pending.replace(b"\r", b"\n").split(b"\n")
            for line in lines:
                text = line.decode(errors="ignore").strip()
                if text:
                    reply, new_state = handle_command(text)
                    client.sendall(f"{reply}\r\n".encode())
                    if new_state is not None:
                        streaming = new_state

        if time.monotonic() >= next_send:
            next_send += SEND_EVERY
            if streaming:
                sample += 1
                # Replace these values with your own readings.
                temperature = 44 + 18 * math.sin(sample / 11)
                humidity = 61 + 6 * math.sin(sample / 23)
                client.sendall(f"T={temperature:.2f} H={humidity:.2f}\r\n".encode())


with socket.create_server(("", PORT)) as server:
    print(f"Waiting for the app on port {PORT}")
    while True:
        client, address = server.accept()
        print("Connected:", address[0])
        with client:
            try:
                serve(client)
            except OSError:
                pass
        print("Disconnected")
