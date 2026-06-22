import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, type IUser } from "./db.js";

export interface AuthRequest extends Request {
  user?: IUser;
}

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-production";

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    User.findById(payload.userId)
      .select("-password")
      .lean()
      .then((user) => {
        if (!user) {
          res.status(401).json({ error: "User not found." });
          return;
        }
        req.user = user as unknown as IUser;
        next();
      })
      .catch(() => {
        res.status(500).json({ error: "Authentication error." });
      });
  } catch {
    res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}
