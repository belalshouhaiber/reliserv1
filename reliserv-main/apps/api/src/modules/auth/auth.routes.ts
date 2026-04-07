import { Router } from "express";
import { signupSchema, loginSchema } from "./auth.schemas";
import { createUser, loginUser, signToken } from "./auth.service";
import { requireAuth } from "../../middlewares/auth";
import { prisma } from "../../db/prisma";

export const authRoutes = Router();

/**
 * POST /v1/auth/signup
 */
authRoutes.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, email, phone, password, role } = parsed.data;

  const exists = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  if (exists) return res.status(409).json({ error: "Email already in use" });

  const user = await createUser({
    name,
    email,
    phone,
    password,
    role: role ?? "CUSTOMER",
  });

  const token = signToken({ id: user.id, role: user.role });
  return res.status(201).json({ token, user });
});

/**
 * POST /v1/auth/login
 */
authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await loginUser(parsed.data.email, parsed.data.password);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken({ id: user.id, role: user.role });
  return res.json({ token, user });
});

/**
 * GET /v1/auth/me (protected)
 */
authRoutes.get("/me", requireAuth, async (req, res) => {
  const id = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      reliabilityScore: true,
      workerProfile: true,
      createdAt: true,
    },
  });

  return res.json({ user });
});
