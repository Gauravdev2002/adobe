const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const { connectMongo } = require("./db/mongo");
const { initAuditTable } = require("./db/postgres");
const { notFound, errorHandler } = require("./middleware/error");
const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");
const clauseRoutes = require("./routes/clauses");
const libraryRoutes = require("./routes/library");
const auditRoutes = require("./routes/audit");
const annotationRoutes = require("./routes/annotations");
const caseRoutes = require("./routes/cases");

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
app.locals.uploadDir = uploadDir;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300
    })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api", clauseRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api", annotationRoutes);
app.use("/api/cases", caseRoutes);

app.use(express.static(path.resolve(__dirname, "../src")));

app.use(notFound);
app.use(errorHandler);

const start = async () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is required");
    }
    await connectMongo();
    await initAuditTable();
    const port = Number(process.env.PORT || 4000);
    app.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`AttorneyCare server running on port ${port}`);
    });
};

start().catch(error => {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", error);
    process.exit(1);
});
