import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prisma";

export function signToken(payload: { id: string; role: "CUSTOMER" | "WORKER" }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");

  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export async function createUser(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "CUSTOMER" | "WORKER";
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  const reliabilityScore = input.role === "WORKER" ? 92 : 90;

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash,
      role: input.role,
      reliabilityScore,
      ...(input.role === "WORKER"
        ? {
            workerProfile: {
              create: {
                categories: [],
                radiusMiles: 15,
                baseRate: 75,
                emergencyOptIn: false,
                availableNow: false,
              },
            },
          }
        : {}),
    },
    select: { id: true, name: true, email: true, role: true, reliabilityScore: true },
  });

  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    reliabilityScore: user.reliabilityScore,
  };
}
