const WebSocket = require("ws");
const si = require("systeminformation");
const http = require("http");
const fs = require("fs");
const path = require("path");

const wss = new WebSocket.Server({ port: 8080 });

console.log("🚀 Server Monitoring jalan di port 8080");

const server = http.createServer((req, res) => {
  // Sajikan file index.html
  const filePath = path.join(__dirname, "index.html");
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Error loading index.html");
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
});

wss.on("connection", (ws) => {
  console.log("✅ Client terhubung");

  const sendData = async () => {
    try {
      // Kita ambil data temp, cpu, mem, load, dan fan secara paralel
      const [temp, cpu, mem, load, fs, network] = await Promise.all([
        si.cpuTemperature(),
        si.cpu(),
        si.mem(),
        si.currentLoad(),
        si.fsSize(),
        si.networkStats(),
      ]);

      const payload = {
        time: new Date().toLocaleTimeString(),
        // DATA SENSOR (lm-sensors)
        thermal: {
          main: temp.main, // Suhu CPU rata-rata
          cores: temp.cores, // Suhu per-core
          max: temp.max,
        },
        // LOAD CPU
        cpu: {
          brand: cpu.brand,
          usage: load.currentLoad.toFixed(2),
          cores: cpu.cores,
        },
        // RAM
        memory: {
          total: (mem.total / 1024 ** 3).toFixed(2) + " GB",
          used: (mem.used / 1024 ** 3).toFixed(2) + " GB",
          percent: ((mem.used / mem.total) * 100).toFixed(2),
        },
        // STORAGE (Disk Usage)
        storage: fs.map((d) => ({
          mount: d.mount,
          use: d.use + "%",
        })),
        // NETWORK (Cek bandwidth masuk/keluar)
        network: {
          interface: network[0].iface,
          rx: (network[0].rx_sec / 1024).toFixed(2) + " KB/s",
          tx: (network[0].tx_sec / 1024).toFixed(2) + " KB/s",
        },
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    } catch (err) {
      console.error("Gagal ambil data:", err);
    }
  };

  const interval = setInterval(sendData, 2000); // Kirim tiap 2 detik

  ws.on("close", () => {
    console.log("❌ Client cabut");
    clearInterval(interval);
  });
});
