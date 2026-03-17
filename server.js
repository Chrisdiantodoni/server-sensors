const WebSocket = require("ws");
const si = require("systeminformation");
const http = require("http");
const fs = require("fs");
const path = require("path");

// 1. BUAT HTTP SERVER UNTUK SERVE INDEX.HTML
const server = http.createServer((req, res) => {
  // Sajikan file index.html jika ada request masuk
  const filePath = path.join(__dirname, "index.html");
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Error: index.html tidak ditemukan di server!");
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
});

// 2. TEMPELKAN WEBSOCKET KE SERVER TERSEBUT
const wss = new WebSocket.Server({ server });

console.log("🚀 Server Monitoring Host Proxmox jalan di port 8080");

wss.on("connection", (ws) => {
  console.log("✅ Client terhubung via WebSocket");

  const sendData = async () => {
    try {
      const [temp, cpu, mem, load, fsSize, network] = await Promise.all([
        si.cpuTemperature(),
        si.cpu(),
        si.mem(),
        si.currentLoad(),
        si.fsSize(),
        si.networkStats(),
      ]);

      const payload = {
        time: new Date().toLocaleTimeString(),
        thermal: { main: temp.main, cores: temp.cores, max: temp.max },
        cpu: {
          brand: cpu.brand,
          usage: load.currentLoad.toFixed(2),
          cores: cpu.cores,
        },
        memory: {
          total: (mem.total / 1024 ** 3).toFixed(2) + " GB",
          used: (mem.used / 1024 ** 3).toFixed(2) + " GB",
          percent: ((mem.used / mem.total) * 100).toFixed(2),
        },
        storage: fsSize.map((d) => ({ mount: d.mount, use: d.use + "%" })),
        network: {
          interface: network[0]?.iface || "eth0",
          rx: (network[0]?.rx_sec / 1024).toFixed(2) + " KB/s",
          tx: (network[0]?.tx_sec / 1024).toFixed(2) + " KB/s",
        },
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    } catch (err) {
      console.error("Gagal ambil data:", err);
    }
  };

  const interval = setInterval(sendData, 2000);
  ws.on("close", () => clearInterval(interval));
});

// 3. JALANKAN DI PORT 8080
server.listen(8080, "0.0.0.0");
