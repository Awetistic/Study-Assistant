import "dotenv/config";
import express from "express";
import { ApiError } from "./errors.js";
import { generateWithGemini } from "./providers/gemini.js";
import { generateWithMock } from "./providers/mock.js";
import { simulate, SIMULATE_MODES } from "./simulate.js";
import cors from "cors";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "100kb" }));


// With no .env at all, fall back to the mock so `npm install && npm start` still runs.
const PROVIDER = (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "mock")).toLowerCase();
const ALLOW_SIMULATE = process.env.ALLOW_SIMULATE !== "false";
const SERVER_TIMEOUT_MS = 45_000; // a little longer than the client's, so the client usually decides first

export const LIMITS = { minChars: 20, maxChars: 15_000, minCount: 3, maxCount: 20 };

app.get("/api/config", (_req, res) => {
  res.json({
    provider: PROVIDER,
    limits: LIMITS,
    simulateModes: ALLOW_SIMULATE ? SIMULATE_MODES : null,
  });
});

app.post("/api/generate", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const count = Number(req.body?.count) || 8;
  const simulateMode = req.body?.simulate || null;

  if (text.length < LIMITS.minChars) {
    return sendError(res, new ApiError(400, "BAD_INPUT", `Please give me at least ${LIMITS.minChars} characters to work with.`));
  }
  if (text.length > LIMITS.maxChars) {
    return sendError(res, new ApiError(400, "BAD_INPUT", `That's too long. Keep it under ${LIMITS.maxChars.toLocaleString()} characters.`));
  }
  if (count < LIMITS.minCount || count > LIMITS.maxCount) {
    return sendError(res, new ApiError(400, "BAD_INPUT", `Card count must be between ${LIMITS.minCount} and ${LIMITS.maxCount}.`));
  }
  if (simulateMode && !ALLOW_SIMULATE) {
    return sendError(res, new ApiError(400, "BAD_INPUT", "Simulation is disabled on this server."));
  }

  // One controller covers both "took too long" and "the browser went away".
  // If the user cancels or starts a new request, we stop paying for the old one.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });

  const started = Date.now();
  try {
    const args = { text, count, signal: controller.signal };
    const result = simulateMode
      ? await simulate(simulateMode, args)
      : PROVIDER === "mock"
        ? await generateWithMock(args)
        : await generateWithGemini(args);

    console.log(`[generate] ${result.model} ${Date.now() - started}ms finish=${result.finishReason} chars=${result.raw.length}`);
    res.json({ raw: result.raw, finishReason: result.finishReason, model: result.model });
  } catch (err) {
    if (err.name === "AbortError") {
      if (res.writableEnded || res.destroyed) return; // client already left; nothing to send
      return sendError(res, new ApiError(504, "TIMEOUT", "The AI took too long to answer."));
    }
    sendError(res, err);
  } finally {
    clearTimeout(timer);
  }
});

function sendError(res, err) {
  if (!(err instanceof ApiError)) {
    console.error("[generate] unexpected error:", err);
    err = new ApiError(500, "SERVER", "Something went wrong on the server.");
  }
  if (!res.headersSent) res.status(err.status).json({ error: err.message, code: err.code });
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}  (provider: ${PROVIDER}${ALLOW_SIMULATE ? ", simulate: on" : ""})`);
  if (PROVIDER === "gemini" && !process.env.GEMINI_API_KEY) {
    console.warn("⚠  GEMINI_API_KEY is not set. Add it to .env, or set AI_PROVIDER=mock to try the app without a key.");
  }
});
