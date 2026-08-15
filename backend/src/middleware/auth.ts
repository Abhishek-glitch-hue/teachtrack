import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.ts";

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({ message: "Authentication token is required." });
  }

  const token = authorization.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return response.status(500).json({ message: "Server authentication is not configured." });
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      return response.status(401).json({ message: "Invalid authentication token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return response.status(401).json({ message: "This account is unavailable." });
    }

    request.user = user;
    next();
  } catch {
    return response.status(401).json({ message: "Invalid or expired authentication token." });
  }
}

export function requireRole(...roles: Array<"TEACHER" | "ADMIN">) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({ message: "You do not have permission for this action." });
    }

    next();
  };
}