import "dotenv/config";
import http from "node:http";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import authRouter from "./routes/auth.ts";
import leaveRouter from "./routes/leaves.ts";
import { prisma } from "./lib/prisma.ts";
import { configureSocketServer } from "./lib/socket.ts";
import notificationRouter from "./routes/notifications.ts";
import timetableRouter from "./routes/timetable.ts";
import messageRouter from "./routes/messages.ts";
import aiRouter from "./routes/ai.ts";
import calendarRouter from "./routes/calendar.ts";
import dutyRouter from "./routes/duties.ts";
import dashboardRouter from "./routes/dashboard.ts";

const app = express();
const server = http.createServer(app);

const port = Number(process.env.PORT ?? 4000);

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS?.split(",") ?? []),
]
  .map((origin) => origin?.trim())
  .filter((origin): origin is string => Boolean(origin));

const allowedOrigins = configuredOrigins.length
  ? configuredOrigins
  : process.env.NODE_ENV === "production"
    ? ["http://127.0.0.1:5500", "http://localhost:5500"]
    : ["http://127.0.0.1:5500", "http://localhost:5500"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRouter);
app.use("/api/leaves", leaveRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/timetable", timetableRouter);
app.use("/api/messages", messageRouter);
app.use("/api/ai", aiRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/duties", dutyRouter);
app.use("/api/dashboard", dashboardRouter);

app.get("/api/health", async (_request, response) => {
  try {
    const userCount = await prisma.user.count();

    response.json({
      status: "ok",
      database: "connected",
      users: userCount,
    });
  } catch {
    response.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (response.headersSent) {
    return next(error);
  }

  console.error("Unhandled API error:", error);
  return response.status(500).json({ message: "An unexpected server error occurred." });
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
});

configureSocketServer(io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const secret = process.env.JWT_SECRET;

  if (typeof token !== "string" || !secret) {
    return next(new Error("Authentication is required."));
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      return next(new Error("Invalid authentication token."));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return next(new Error("Account is unavailable."));
    }

    socket.data.userId = user.id;
    socket.data.role = user.role;
    socket.join(`user:${user.id}`);

    next();
  } catch {
    return next(new Error("Invalid or expired authentication token."));
  }
});

io.on("connection", (socket) => {
  console.log(`Live connection: ${socket.data.userId}`);

  socket.on("disconnect", () => {
    console.log(`Live connection closed: ${socket.data.userId}`);
  });
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`TeachTrack API is already running on port ${port}. Stop the existing process before starting another one.`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, () => {
  console.log(`TeachTrack API running at http://localhost:${port}`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
