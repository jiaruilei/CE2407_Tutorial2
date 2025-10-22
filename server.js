import express from "express";
import dotenv from "dotenv";
import cors from "cors";

// --- Optional fetch polyfill for Node < 18 (Render should use >=18, but this is safer)
if (typeof fetch === "undefined") {
  global.fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
}

dotenv.config();
const app = express();
app.use(express.json({ limit: "1mb" }));

// --- CORS: use origins (no paths). Add your GitHub Pages origin(s) here.
app.use(cors({
  origin: [
    "https://jiaruilei.github.io",          // whole user site
    // "https://jiaruilei.github.io/jet-flow" // not needed; paths aren't origins
  ],
}));

// --- Health check (make sure Render's Health Check Path is set to this)
app.get("/api/health", (req, res) => res.json({ ok: true }));

// --- ChatGPT proxy
app.post("/api/chat", async (req, res) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { model = "gpt-4o-mini", temperature = 0.2, system = "", messages = [] } = req.body || {};

    const chatMessages = [];
    if (system) chatMessages.push({ role: "system", content: system });
    for (const m of messages) {
      if (m?.role && m?.content) chatMessages.push({ role: m.role, content: m.content });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model, temperature, messages: chatMessages })
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: txt });
    }

    const data = await r.json();
    res.json({ reply: data?.choices?.[0]?.message?.content ?? "" });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

// --- Start
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`AI coach proxy listening on :${port}`);
  console.log(`Health check at: http://localhost:${port}/api/health`);
});

