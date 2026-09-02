import type { Role } from "../generated/prisma/client.ts";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        department: string | null;
        phone: string | null;
        campus: string | null;
        role: Role;
        isActive: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
      };
    }
  }
}

export {};
