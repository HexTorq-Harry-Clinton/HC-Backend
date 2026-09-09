

require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  "https://harryclinton.in",
  "https://www.harryclinton.in",
  "http://localhost:3000",
];

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;

app.use(helmet({
  // CSP is disabled because /api-tester serves its own static HTML/JS tool;
  // a default CSP would block that page's inline scripts.
  contentSecurityPolicy: false,
}));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(cors({
  origin(origin, callback) {
    // allow non-browser requests (curl, server-to-server, the httpie/api-tester tool)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin not allowed: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/Uploads", express.static(path.join(process.cwd(), "Uploads")));
app.use("/api-tester", express.static(path.join(process.cwd(), "public", "api-tester")));
app.use("/api-tester/api", require("./routes/api-tester"));

app.use("/API/HARRY-CLINTON", require("./routes/HARRY_CLINTON"));

// generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;

