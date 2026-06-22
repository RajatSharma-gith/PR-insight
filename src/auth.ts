import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "./db.js";
import { generateToken, authenticate, type AuthRequest } from "./middleware.js";

export const authRouter = Router();

// ─── Register ─────────────────────────────────────────────────────────────────

authRouter.post("/register", async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashedPassword });

    const token = generateToken(user._id.toString());
    const { password: _, ...safeUser } = user.toObject();
    res.status(201).json({ token, user: safeUser });
  } catch (err: any) {
    console.error("[Auth] Register error:", err);
    res.status(500).json({ error: "Failed to create account." });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────

authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user._id.toString());
    const { password: _, ...safeUser } = user.toObject();
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ─── Get Current User ─────────────────────────────────────────────────────────

authRouter.get("/me", authenticate, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.google_client_id || "";
const GOOGLE_CLIENT_SECRET = process.env.google_client_secret || "";
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || "http://localhost:3001/api/auth/google/callback";

authRouter.get("/google", (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

authRouter.get("/google/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

  if (!code || typeof code !== "string") {
    return res.redirect(`${clientOrigin}/login?error=oauth_failed`);
  }

  try {
    // Exchange code for Google access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenResponse.json()) as any;
    if (!tokenData.access_token) throw new Error("No access token received from Google.");

    // Fetch Google profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as any;

    // Find or create user
    let user = await User.findOne({ googleId: profile.id });

    if (!user) {
      // Check if email already registered with password
      user = await User.findOne({ email: profile.email });
      if (user) {
        // Link Google ID to existing account
        user.googleId = profile.id;
        user.avatarUrl = profile.picture;
        await user.save();
      } else {
        // Brand new user via Google
        user = await User.create({
          name: profile.name,
          email: profile.email,
          googleId: profile.id,
          avatarUrl: profile.picture,
        });
      }
    }

    const jwtToken = generateToken(user._id.toString());
    res.redirect(`${clientOrigin}/auth/callback?token=${jwtToken}`);
  } catch (err) {
    console.error("[Auth] Google OAuth error:", err);
    res.redirect(`${clientOrigin}/login?error=oauth_failed`);
  }
});
