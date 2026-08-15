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

const app = express();
const server = http.createServer(app);

const port = Number(process.env.PORT ?? 4000);

const allowedOrigins = [
  process.env.FRONTEND_URL ?? "http://127.0.0.1:5500",
  "http://localhost:5500",
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRouter);
app.use("/api/leaves", leaveRouter);
app.use("/api/notifications", notificationRouter);

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

server.listen(port, () => {
  console.log(`TeachTrack API running at http://localhost:${port}`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);