/*
 * Plain C for any microcontroller (PIC, STM32, AVR...) with a Bluetooth module on a UART.
 * Fill in the three functions marked PORT with your chip's code, and call
 * unwired_poll() from your main loop.
 */
#include <stdio.h>
#include <string.h>

/* PORT: send one byte over the UART. */
void uart_write_byte(char byte);
/* PORT: return 1 and store a byte if one has arrived, otherwise return 0. */
int uart_read_byte(char *byte);
/* PORT: milliseconds since power-on. */
unsigned long millis(void);

static void uart_write_text(const char *text) {
    while (*text) uart_write_byte(*text++);
}

static int streaming = 1;

static void handle_command(const char *command) {
    if (strcmp(command, "LS") == 0 || strcmp(command, "DS") == 0) {
        streaming = strcmp(command, "LS") == 0;
        uart_write_text("OK\r\n");
    } else {
        uart_write_text("ECO ");
        uart_write_text(command);
        uart_write_text("\r\n");
    }
}

void unwired_poll(float temperature, float humidity) {
    static char command[41];
    static unsigned int length = 0;
    static unsigned long last_send = 0;
    char byte;

    while (uart_read_byte(&byte)) {
        if (byte == '\r' || byte == '\n') {
            if (length > 0) {
                command[length] = '\0';
                handle_command(command);
                length = 0;
            }
        } else if (length < sizeof(command) - 1) {
            command[length++] = byte;
        }
    }

    if (streaming && millis() - last_send >= 200) {
        char line[40];
        last_send = millis();
        /* Some small libc builds need float support enabled for %f. */
        snprintf(line, sizeof(line), "T=%.2f H=%.2f\r\n", temperature, humidity);
        uart_write_text(line);
    }
}
