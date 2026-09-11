import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { requireAuth } from "../middleware/auth.ts";
import { sendPasswordResetEmail } from "../lib/mailer.ts";

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

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(120),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(8).max(72),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  department: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  campus: z.string().trim().max(80).optional(),
  currentPassword: z.preprocess((value) => value === "" ? undefined : value, z.string().max(72).optional()),
  newPassword: z.preprocess((value) => value === "" ? undefined : value, z.string().min(8).max(72).optional()),
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
  department?: string | null;
  phone?: string | null;
  campus?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department ?? null,
    phone: user.phone ?? null,
    campus: user.campus ?? null,
    createdAt: user.createdAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
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

  const signedInUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = createToken(signedInUser);

  return response.status(201).json({
    token,
    user: publicUser(signedInUser),
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

  const signedInUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = createToken(signedInUser);

  return response.json({
    token,
    user: publicUser(signedInUser),
  });
});

authRouter.post("/forgot-password", async (request, response) => {
  const parsed = forgotPasswordSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Enter a valid email address." });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, email: true, isActive: true },
  });

  // Keep this response identical for every valid address to avoid exposing account membership.
  const success = { message: "If an active account uses that email address, a password reset link has been sent." };
  if (!user || !user.isActive) return response.json(success);

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
  ]);

  const frontendUrl = process.env.FRONTEND_URL ?? "http://127.0.0.1:5500";
  const resetUrl = new URL("reset-password.html", frontendUrl.endsWith("/") ? frontendUrl : `${frontendUrl}/`);
  resetUrl.searchParams.set("token", token);

  try {
    await sendPasswordResetEmail(user.email, resetUrl.toString());
  } catch (error) {
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
    console.error("Password-reset email could not be sent:", error);
    return response.status(503).json({ message: "Password reset email is temporarily unavailable. Please try again later." });
  }

  return response.json(success);
});

authRouter.post("/reset-password", async (request, response) => {
  const parsed = resetPasswordSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Use a valid reset link and a password of at least 8 characters." });

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    return response.status(400).json({ message: "This reset link is invalid or has expired. Request a new one." });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: resetToken.userId, id: { not: resetToken.id } } }),
  ]);

  return response.json({ message: "Your password has been reset. You can now sign in." });
});

authRouter.get("/me", requireAuth, (request, response) => {
  response.json({
    user: publicUser(request.user!),
  });
});

authRouter.patch("/me", requireAuth, async (request, response) => {
  const parsed = updateProfileSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Please provide valid profile details." });

  const data = parsed.data;
  if (data.newPassword && !data.currentPassword) {
    return response.status(400).json({ message: "Enter your current password to set a new password." });
  }
  if (data.newPassword && !(await bcrypt.compare(data.currentPassword!, (await prisma.user.findUniqueOrThrow({ where: { id: request.user!.id } })).passwordHash))) {
    return response.status(400).json({ message: "Your current password is incorrect." });
  }

  try {
    const user = await prisma.user.update({
      where: { id: request.user!.id },
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        department: data.department || null,
        phone: data.phone || null,
        campus: data.campus || null,
        ...(data.newPassword ? { passwordHash: await bcrypt.hash(data.newPassword, 12) } : {}),
      },
    });
    return response.json({ user: publicUser(user) });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return response.status(409).json({ message: "An account already uses that email address." });
    }
    throw error;
  }
});

export default authRouter;
