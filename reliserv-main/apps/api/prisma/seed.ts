// Load environment variables from .env so DATABASE_URL is available.
import "dotenv/config";
// Prisma enums and client used to create seed records with typed values.
import { PrismaClient, UserRole, JobUrgency, JobStatus, JobEventType } from "@prisma/client";
// Use Prisma's Postgres adapter (Prisma 7) backed by a pg Pool.
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
// Hash plaintext passwords before storing them.
import bcrypt from "bcryptjs";

// Open a pooled Postgres connection using DATABASE_URL.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Attach the pg pool to Prisma via the adapter.
const adapter = new PrismaPg(pool);
// Create a Prisma client instance for all seed operations.
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing seed data (safe for local/dev).
  // Order matters because of foreign-key relationships.
  await prisma.review.deleteMany();
  await prisma.jobEvent.deleteMany();
  await prisma.job.deleteMany();
  await prisma.workerProfile.deleteMany();
  await prisma.user.deleteMany();

  // Shared password hash for demo users in seed data.
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Create a sample customer account.
  const customer = await prisma.user.create({
    data: {
      role: UserRole.CUSTOMER,
      name: "Alex Rivera",
      email: "alex@example.com",
      phone: "+1 (555) 123-4567",
      passwordHash,
      reliabilityScore: 94,
    },
  });

  // Create a sample worker account with an attached worker profile.
  const worker = await prisma.user.create({
    data: {
      role: UserRole.WORKER,
      name: "John Martinez",
      email: "john.worker@example.com",
      phone: "+1 (555) 777-1111",
      passwordHash,
      reliabilityScore: 98,
      workerProfile: {
        create: {
          categories: ["plumbing", "electrical"],
          radiusMiles: 15,
          baseRate: 75,
          emergencyOptIn: true,
          availableNow: false,
        },
      },
    },
  });

  // Create one emergency job owned by the customer.
  // Also attach the initial CREATED timeline event in the same write.
  const job = await prisma.job.create({
    data: {
      title: "Emergency - No Hot Water",
      description: "Water heater completely out, family needs hot water ASAP",
      jobType: "plumbing",
      urgency: JobUrgency.EMERGENCY,
      status: JobStatus.OPEN,
      priceMin: 250,
      priceMax: 350,
      lockedScope: "Diagnose and repair water heater or recommend replacement",
      lat: 40.7489,
      lng: -73.968,
      locationText: "1.2 miles away",
      createdById: customer.id,

      events: {
        create: [
          {
            type: JobEventType.CREATED,
            actorId: customer.id,
            note: "Job created (seed).",
          },
        ],
      },
    },
  });

  // Print a compact summary so you can verify seeded identities quickly.
  console.log("Seed complete:");
  console.log({ customer: customer.email, worker: worker.email, jobId: job.id });
}

// Run the seed script with explicit error handling and cleanup.
main()
  .catch((e) => {
    // Surface the failure and return a non-zero exit code for CI/scripts.
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Always close Prisma connections before process exit.
    await prisma.$disconnect();
  });
