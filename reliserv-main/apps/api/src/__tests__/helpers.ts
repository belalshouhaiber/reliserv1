import request from "supertest";
import app from "../app";

export async function signupAndLogin(email: string, role: "CUSTOMER" | "WORKER") {
  const password = "Password123!";

  // Signup (may already exist across tests if DB is not reset)
  await request(app)
    .post("/v1/auth/signup")
    .send({ name: `${role} User`, email, password, role })
    .set("Content-Type", "application/json");

  // Login
  const loginRes = await request(app)
    .post("/v1/auth/login")
    .send({ email, password })
    .set("Content-Type", "application/json");

  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toBeTruthy();

  return { token: loginRes.body.token as string, user: loginRes.body.user };
}
