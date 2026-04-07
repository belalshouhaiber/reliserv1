# Week 3 E2E

This runbook verifies the Week 3 trust loop end to end with Postman, Prisma Studio, and the browser.

## Preconditions

- Docker Desktop running
- Infra started with `docker compose -f infra/docker-compose.yml up -d`
- API running locally from `apps/api`
- Web app running locally from `apps/web`
- Database available and reachable by Prisma
- Prisma Studio open with the `User`, `Job`, `JobEvent`, and `Review` tables visible

## Automated Test Setup

From `apps/api`, `npm test` uses `.env.test`, waits for `reliserv_test` on `localhost:5432`, runs `prisma migrate deploy`, and then starts Jest.

If Jest fails before tests begin, start infra first:

```powershell
docker compose -f infra/docker-compose.yml up -d
```

## Recommended Postman Environment

- `baseUrl` = `http://localhost:4000`
- `customerToken`
- `workerToken`
- `outsiderToken`
- `jobId`
- `workerId`
- `customerId`

## Auth Setup

1. `POST {{baseUrl}}/v1/auth/signup` for a customer account.
2. `POST {{baseUrl}}/v1/auth/signup` for a worker account.
3. `POST {{baseUrl}}/v1/auth/signup` for an unrelated worker account.
4. `POST {{baseUrl}}/v1/auth/login` for each account and save the returned token and user id to the environment.

## Case 1: Completion Reliability

1. `POST {{baseUrl}}/v1/emergency` as the customer.
2. Save `jobId` from the response.
3. `POST {{baseUrl}}/v1/jobs/{{jobId}}/accept` as the worker.
4. `POST {{baseUrl}}/v1/jobs/{{jobId}}/start` as the worker.
5. `POST {{baseUrl}}/v1/jobs/{{jobId}}/complete` as the worker.
6. `GET {{baseUrl}}/v1/auth/me` as the customer.
7. `GET {{baseUrl}}/v1/auth/me` as the worker.
8. Check Prisma Studio `User.reliabilityScore` for both ids.

Expected:

- Customer reliability recalculates from completed emergency usage.
- Worker reliability recalculates from completed emergency work.
- `/v1/auth/me` and Prisma Studio show the same values.

## Case 2: Cancel Reliability

1. `POST {{baseUrl}}/v1/jobs` as the customer to create an open job.
2. Save the new `jobId`.
3. `POST {{baseUrl}}/v1/jobs/{{jobId}}/cancel` as the same customer.
4. `GET {{baseUrl}}/v1/auth/me` as the customer.
5. Check Prisma Studio `User.reliabilityScore`.

Expected:

- Customer score drops by `5`.
- `/v1/auth/me` matches the database.

## Case 3: Review Reliability

1. Complete a job through the full lifecycle.
2. `POST {{baseUrl}}/v1/reviews` as the customer with:
   - `jobId`
   - `toUserId` = assigned worker id
   - `target` = `WORKER`
   - `rating` = `5`
3. `POST {{baseUrl}}/v1/reviews` as the worker with:
   - `jobId`
   - `toUserId` = customer id
   - `target` = `CUSTOMER`
   - `rating` = `4`
4. `GET {{baseUrl}}/v1/auth/me` for both users.
5. Check Prisma Studio `Review` rows and `User.reliabilityScore`.

Expected:

- Rating `5` yields `reliabilityImpact = 2`.
- Rating `4` yields `reliabilityImpact = 2`.
- Reviewed users receive the score changes.
- Review rows and updated user scores persist in the database.

## Case 4: Clamp

1. Use automated test coverage or direct seeded data to create many positive events for a user.
2. Call the recalculation path for that user.
3. Repeat with many negative events for another user.
4. Verify both via `/v1/auth/me` and Prisma Studio.

Expected:

- Reliability never exceeds `100`.
- Reliability never drops below `0`.

## Backend Failure Cases

### Duplicate Review

1. Submit a valid review for a completed job.
2. Submit the same review again as the same reviewer.

Expected:

- First request returns `201`.
- Second request returns `409`.

### Review Before Completion

1. Create a job.
2. Accept it.
3. Attempt `POST /v1/reviews` before completion.

Expected:

- Returns `409`.

### Wrong User Attempts Review

1. Use a completed job with a customer and assigned worker.
2. Submit `POST /v1/reviews` as an unrelated user.

Expected:

- Returns `403`.

### Lifecycle Invalid Sequences

Check these manually:

- `OPEN -> COMPLETE`
- `LOCKED -> COMPLETE`
- `COMPLETED -> START`
- `cancel` after `LOCKED`
- customer attempting `POST /v1/jobs/:id/accept`

Expected:

- All invalid flows return clean `4xx` responses.
- No illegal state transition is silently allowed.

## Event Trail Checks

For a valid completion flow:

- `GET /v1/jobs/:id/events` should return `CREATED`, `ACCEPTED`, `STARTED`, `COMPLETED` in order.

For a valid cancel flow:

- `GET /v1/jobs/:id/events` should return `CREATED`, `CANCELED`.

## Browser Demo Flow

1. Sign in as customer.
2. Open `/emergency`.
3. Create an emergency request.
4. Sign in as worker in a separate browser or session.
5. Open `/worker/requests`.
6. Accept the emergency job.
7. Start the job from `/worker/live-job/:jobId`.
8. Complete and review the customer from `/worker/completion`.
9. Return to the customer session.
10. Refresh the customer live job page until status is `COMPLETED`.
11. Submit the customer review from `/completion`.
12. Open `/profile` for both users and verify the updated reliability scores.

## Done Criteria

- Prisma Studio and `/v1/auth/me` always match.
- No manual database edits are needed to fix reliability.
- Full lifecycle and review validation can be reproduced by any teammate.
- Main demo path runs from the browser without manual database intervention.
