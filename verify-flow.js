const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9222;
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "dnev-edge-"));

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = "";
      res.on("data", (c) => d += c);
      res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}

async function cdp(wsUrl, method, params = {}, id = 1) {
  const WebSocket = global.WebSocket || (await import("node:http")).WebSocket;
}

function sendCdp(socket, id, method, params) {
  return new Promise((resolve, reject) => {
    const onmsg = (buf) => {
      const msg = JSON.parse(buf.toString());
      if (msg.id === id) {
        socket.off("message", onmsg);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    socket.on("message", onmsg);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

(async () => {
  const child = spawn(EDGE, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userData}`,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    "http://127.0.0.1:4173/"
  ], { stdio: "ignore" });

  let json;
  for (let i = 0; i < 30; i++) {
    try {
      json = JSON.parse(await get(`http://127.0.0.1:${PORT}/json`));
      if (json.length) break;
    } catch {}
    await wait(200);
  }
  if (!json?.length) throw new Error("no cdp targets");
  const page = json.find((t) => t.type === "page") || json[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });

  let id = 1;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const i = id++;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await wait(800);

  const click = async (sel) => {
    await call("Runtime.evaluate", {
      expression: `document.querySelector(${JSON.stringify(sel)})?.click()`,
      returnByValue: true
    });
    await wait(400);
  };

  const text = async () => (await call("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true
  })).result.value;

  const shot = async (name) => {
    const { data } = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(__dirname, "icons", name), Buffer.from(data, "base64"));
  };

  await shot("verify-home.png");
  const home = await text();
  await click('[data-nav="history"]');
  await shot("verify-history.png");
  const history = await text();
  await click('[data-nav="exercises"]');
  await shot("verify-exercises.png");
  const exercises = await text();
  await click('[data-nav="profile"]');
  await shot("verify-profile.png");
  const profile = await text();
  await click('[data-nav="home"]');
  await click('[data-act="start-empty"]');
  await wait(500);
  await click('[data-act="add-exercise"]');
  await wait(400);
  await call("Runtime.evaluate", {
    expression: `document.querySelector('[data-act="add-ex-id"]')?.click()`,
    returnByValue: true
  });
  await wait(500);
  await shot("verify-workout.png");
  const workout = await text();
  await click('[data-act="ask-finish"]');
  await wait(300);
  await click('[data-act="finish"]');
  await wait(400);
  const summary = await text();

  console.log("---HOME---\n" + home.slice(0, 400));
  console.log("---HISTORY has calendar---", /История|Пн|Вт/.test(history));
  console.log("---EXERCISES---", /Жим|Грудь|Поиск/.test(exercises));
  console.log("---PROFILE---", /Тема|Экспорт|Вес/.test(profile));
  console.log("---WORKOUT---", /Добавить упражнение|Завершить/.test(workout));
  console.log("---SUMMARY---", /Итоги|сохранена|Готово/.test(summary));
  console.log("---TAB PROFILE visible---", /Профиль/.test(home + history + profile));

  ws.close();
  child.kill();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
