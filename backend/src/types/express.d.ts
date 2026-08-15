import type { Role } from "../generated/prisma/client.ts";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: Role;
        isActive: boolean;
      };
    }
  }
}

export {};