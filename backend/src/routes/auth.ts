import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { requireAuth } from "../middleware/auth.ts";

const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function createToken(user: { id: string; role: "TEACHER" | "ADMIN" }) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing from .env");
  }

  return jwt.sign(
    { sub: user.id, role: user.role },
    secret,
    { expiresIn: "7d" },
  );
}

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: "TEACHER" | "ADMIN";
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

authRouter.post("/register", async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      message: "Please provide a valid name, email, and password of at least 8 characters.",
    });
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return response.status(409).json({
      message: "An account already exists with this email.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "TEACHER",
    },
  });

  const token = createToken(user);

  return response.status(201).json({
    token,
    user: publicUser(user),
  });
});

authRouter.post("/login", async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      message: "Email and password are required.",
    });
  }

  const email = parsed.data.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return response.status(401).json({
      message: "Invalid email or password.",
    });
  }

  if (!user.isActive) {
    return response.status(403).json({
      message: "This account is inactive. Contact an administrator.",
    });
  }

  const token = createToken(user);

  return response.json({
    token,
    user: publicUser(user),
  });
});

authRouter.get("/me", requireAuth, (request, response) => {
  response.json({
    user: request.user,
  });
});

export default authRouter;