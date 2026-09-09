

require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// PIPELINE MODE: allow all origins (Vercel previews, prod domain, tooling).
// `origin: true` reflects the request origin, which keeps `credentials: true`
// valid (a literal "*" would break credentialed requests).
const corsOptions = {
  origin: true,
  credentials: true,
};

app.use(helmet({
  // CSP is disabled because /api-tester serves its own static HTML/JS tool;
  // a default CSP would block that page's inline scripts.
  contentSecurityPolicy: false,
}));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(cors(corsOptions));

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

