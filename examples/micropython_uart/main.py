# MicroPython with an HC-05 or HC-06 module on a UART.
# Wiring: module TX to board RX, module RX to board TX, common GND.
# BAUD must match the speed stored in the module. Factory default is usually 9600.
import math
import time
from machine import Pin, UART

BAUD = 9600
uart = UART(1, baudrate=BAUD, tx=Pin(17), rx=Pin(16))  # Adjust the pins to your board.

streaming = True
pending = b""
sample = 0
last_send = time.ticks_ms()

while True:
    if uart.any():
        pending += uart.read()
        lines = pending.replace(b"\r", b"\n").split(b"\n")
        pending = lines.pop()
        for line in lines:
            text = line.decode().strip()
            if text == "LS" or text == "DS":
                streaming = text == "LS"
                uart.write("OK\r\n")
            elif text:
                uart.write("ECO " + text + "\r\n")

    if streaming and time.ticks_diff(time.ticks_ms(), last_send) >= 200:
        last_send = time.ticks_ms()
        sample += 1
        # Replace these values with your own readings.
        temperature = 44 + 18 * math.sin(sample / 11)
        humidity = 61 + 6 * math.sin(sample / 23)
        uart.write("T={:.2f} H={:.2f}\r\n".format(temperature, humidity))
    time.sleep_ms(5)
