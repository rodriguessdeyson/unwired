// Fake sensor for unWired over Wi-Fi, with no dependencies.
// Run: node device.mjs
// In the app: Find devices > Add Wi-Fi by IP > TCP stream > this PC's IP and port 8080.
import net from 'node:net';

const PORT = 8080;

net
  .createServer((socket) => {
    console.log('Connected:', socket.remoteAddress);
    let streaming = true;
    let sample = 0;
    let pending = '';

    const timer = setInterval(() => {
      if (!streaming) return;
      sample += 1;
      // Replace these values with your own readings.
      const temperature = 44 + 18 * Math.sin(sample / 11);
      const humidity = 61 + 6 * Math.sin(sample / 23);
      socket.write(`T=${temperature.toFixed(2)} H=${humidity.toFixed(2)}\r\n`);
    }, 200);

    socket.setEncoding('utf8');
    socket.on('data', (data) => {
      pending += data;
      const lines = pending.split(/\r\n|\n|\r/);
      pending = lines.pop();
      for (const line of lines) {
        const text = line.trim();
        if (!text) continue;
        if (text === 'LS' || text === 'DS') {
          streaming = text === 'LS';
          socket.write('OK\r\n');
        } else {
          socket.write(`ECO ${text}\r\n`);
        }
      }
    });
    socket.on('close', () => {
      clearInterval(timer);
      console.log('Disconnected');
    });
    socket.on('error', () => undefined);
  })
  .listen(PORT, () => console.log(`Waiting for the app on port ${PORT}`));
