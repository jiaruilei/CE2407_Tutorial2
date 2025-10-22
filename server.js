import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- CORS: allow GitHub Pages, common locals, and no-origin tools (curl/Postman)
const ALLOWED = new Set([
  "https://jiaruilei.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5500"
]);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    }
  })
);

// --- Health checks (Render can use this path)
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) => res.send("CE2407A AI-Coach proxy is running."));

// --- ChatGPT proxy
app.post("/api/chat", async (req, res) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_API_BASE = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    let { model = "gpt-4o-mini", temperature = 0.2, system = "", messages = [] } = req.body || {};
    // Harden inputs
    if (!Array.isArray(messages)) messages = [];

    const clean = messages
      .filter(m => m && typeof m.role === "string" && typeof m.content === "string")
      .map(m => ({ role: m.role, content: String(m.content) }));

    // Only prepend a system message if one isn't already present
    if (system && !clean.some(m => m.role === "system")) {
      clean.unshift({ role: "system", content: String(system) });
    }

    const r = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: isNaN(Number(temperature)) ? 0.2 : Number(temperature),
        messages: clean
      })
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({ error: text });
    }

    const data = JSON.parse(text);
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return res.json({ reply });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy error" });
  }
});

// --- Start
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`AI coach proxy listening on :${port}`);
  console.log(`Health check at: http://localhost:${port}/api/health`);
});
