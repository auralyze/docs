# Technical Debt

This document catalogs known technical debt, limitations, and future work across the Mixtape platform. Items are prioritized by severity and impact.

::: tip Living Document
This page is continuously updated as issues are discovered, prioritized, and resolved. Check back regularly for the latest technical debt status.
:::

## Priority Levels

- 🔴 **Critical:** Security vulnerabilities, data loss risks, production blockers
- 🟡 **High:** Poor user experience, scalability limitations, maintainability issues
- 🟢 **Medium:** Nice-to-have features, code quality improvements, minor inefficiencies
- ⚪ **Low:** Polish, documentation gaps, future considerations

---

## 🔴 Critical Priority

### 1. No Token Revocation (JWT Limitation)

**Problem:**
- JWT is stateless → no server-side logout enforcement
- Stolen token remains valid until expiration (up to 7 days)
- User cannot forcibly terminate all sessions

**Impact:**
- 🔴 **Security Risk:** Compromised tokens cannot be revoked immediately
- Attacker has 7-day window with stolen token
- No way to enforce "log out all devices"

**Solution:**
- Implement Redis token blacklist with TTL
  ```typescript
  // On logout:
  await redis.set(`blacklist:${tokenId}`, '1', 'EX', remainingTTL);

  // On verification:
  const isBlacklisted = await redis.exists(`blacklist:${tokenId}`);
  if (isBlacklisted) throw new Error('Token revoked');
  ```
- Alternative: Short-lived access tokens (15 min) + refresh tokens (30 days)

**Workaround (Current):**
- Deactivate user (`isActive = false`) to invalidate all tokens
- Requires user to change password (not ideal)

**Effort:** 2-3 days (Redis integration + middleware update)

---

### 2. No Rate Limiting

**Problem:**
- No rate limiting on any endpoints (auth, API, services)
- Vulnerable to brute-force attacks, credential stuffing, DoS

**Impact:**
- 🔴 **Security Risk:** Attackers can make unlimited login attempts
- 🔴 **Availability Risk:** DoS attack can overwhelm services
- Cost: OpenAI API abuse (unlimited feedback requests)

**Solution:**
- Implement Express rate-limit middleware
  ```typescript
  // Auth endpoints: Strict limits
  app.use('/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                     // 5 attempts
    message: 'Too many login attempts, try again later'
  }));

  // API endpoints: Generous limits
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 100,             // 100 requests
    message: 'Rate limit exceeded'
  }));
  ```
- Use Redis for distributed rate limiting (multiple API instances)

**Effort:** 1-2 days (install library + configure limits)

---

### 3. Synchronous Workflow Blocks HTTP Threads

**Problem:**
- 10-60 second workflows block HTTP request threads
- Poor UX (long loading spinner, no progress feedback)
- Thread exhaustion under load (100 concurrent requests = 100 blocked threads)

**Impact:**
- 🔴 **User Experience:** Users wait 10-60s for response (perceived as broken)
- 🔴 **Scalability:** Server crashes under moderate load (thread exhaustion)
- Cannot handle concurrent workflows efficiently

**Solution:**
- Async job queue (Redis + Bull/BullMQ)
  ```typescript
  // API: Enqueue job, return immediately
  app.post('/sessions', async (req, res) => {
    const job = await queue.add('analyze-session', req.body);
    res.status(202).json({ jobId: job.id, status: 'pending' });
  });

  // Worker: Process job asynchronously
  queue.process('analyze-session', async (job) => {
    const engineState = await runMixtapeSession(job.data, deps);
    await sessionRepository.save(engineState);
  });

  // Client: Poll for results
  app.get('/jobs/:id', async (req, res) => {
    const job = await queue.getJob(req.params.id);
    res.json({ status: job.getState(), result: await job.finished() });
  });
  ```
- Benefits: Fast API response (<100ms), automatic retries, scalability

**Effort:** 1 week (Redis setup + job queue integration + UI updates)

---

## 🟡 High Priority

### 4. No Refresh Token Flow

**Problem:**
- Single 7-day JWT → user must re-authenticate after expiration
- Poor UX for long sessions (users expect to stay logged in)
- Large theft window (7 days)

**Impact:**
- 🟡 **User Experience:** Users forced to log in weekly
- 🟡 **Security:** Stolen token valid for 7 days (too long)

**Solution:**
- Implement refresh token flow
  ```typescript
  // Access token: 15 minutes (short-lived, for API requests)
  // Refresh token: 30 days (long-lived, rotated on use)

  app.post('/auth/refresh', async (req, res) => {
    const refreshToken = req.cookies.refresh_token;
    const decoded = verifyRefreshToken(refreshToken);

    // Issue new access + refresh tokens
    const newAccessToken = generateAccessToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    // Blacklist old refresh token
    await redis.set(`blacklist:${refreshToken}`, '1', 'EX', 30 * 24 * 60 * 60);

    res.cookie('access_token', newAccessToken, { maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', newRefreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  });
  ```

**Effort:** 3-4 days (token rotation logic + frontend integration)

---

### 5. No Email Verification

**Problem:**
- Users can register without verifying email
- Enables fake accounts, spam, enumeration attacks

**Impact:**
- 🟡 **Security:** Account enumeration (attacker can test if email exists)
- 🟡 **Quality:** Fake accounts, spam registrations
- 🟡 **Deliverability:** No way to confirm email is valid

**Solution:**
- Email verification flow
  ```typescript
  // On registration:
  const token = crypto.randomBytes(32).toString('hex');
  await redis.set(`verify:${token}`, userId, 'EX', 24 * 60 * 60);  // 24 hour
  await sendEmail(email, `https://app.mixtapelabs.com/verify?token=${token}`);

  // On verification:
  app.get('/verify', async (req, res) => {
    const userId = await redis.get(`verify:${req.query.token}`);
    if (!userId) return res.status(400).send('Invalid or expired token');

    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() }
    });

    res.redirect('/login?verified=true');
  });
  ```
- Block unverified users from creating sessions

**Effort:** 2-3 days (email service + verification flow + UI)

---

### 6. No Password Reset Flow

**Problem:**
- No way for users to recover forgotten passwords
- Users permanently locked out if password forgotten

**Impact:**
- 🟡 **User Experience:** Locked-out users cannot recover accounts
- 🟡 **Support Burden:** Manual password resets (admin intervention)

**Solution:**
- Email-based password reset
  ```typescript
  // Request reset:
  app.post('/auth/forgot-password', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) return res.json({ success: true });  // Don't leak existence

    const token = crypto.randomBytes(32).toString('hex');
    await redis.set(`reset:${token}`, user.id, 'EX', 60 * 60);  // 1 hour
    await sendEmail(user.email, `Reset: https://app.mixtapelabs.com/reset?token=${token}`);

    res.json({ success: true });
  });

  // Reset password:
  app.post('/auth/reset-password', async (req, res) => {
    const userId = await redis.get(`reset:${req.body.token}`);
    if (!userId) return res.status(400).json({ error: 'Invalid or expired token' });

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    await redis.del(`reset:${req.body.token}`);  // Single use
    res.json({ success: true });
  });
  ```

**Effort:** 2-3 days (email templates + reset flow + UI)

---

### 7. Offset Pagination Inefficiency

**Problem:**
- Offset pagination (`skip: 1000, take: 50`) is O(n)
- Database must scan 1000 rows before returning results
- Inconsistent results if data changes during pagination (page drift)

**Impact:**
- 🟡 **Performance:** Slow for large offsets (page 100 = scan 5000 rows)
- 🟡 **User Experience:** Slow page loads for deep pagination

**Solution:**
- Cursor-based pagination (keyset pagination)
  ```typescript
  // Instead of offset:
  findMany({ where: { userId }, skip: 1000, take: 50 })

  // Use cursor:
  findMany({
    where: { userId },
    cursor: { id: lastSeenId },  // ID of last item from previous page
    take: 50,
    skip: 1  // Skip the cursor itself
  })
  ```
- O(log n) lookups (uses index), no scanning
- Consistent results (not affected by concurrent inserts)

**Effort:** 1-2 days (API changes + frontend pagination update)

---

### 8. No Result Caching

**Problem:**
- Every session request re-processes audio file
- Identical files analyzed multiple times (wasted compute)
- OpenAI API costs accumulate for duplicate feedback requests

**Impact:**
- 🟡 **Performance:** 5-30 seconds wasted per duplicate file
- 🟡 **Cost:** Unnecessary OpenAI API charges (~$0.05 per request)
- 🟡 **Scalability:** Analysis service overloaded with redundant work

**Solution:**
- Cache analysis results by file content hash
  ```typescript
  // Compute file hash
  const fileHash = crypto.createHash('sha256').update(audioBuffer).digest('hex');

  // Check cache
  const cached = await redis.get(`analysis:${fileHash}`);
  if (cached) return JSON.parse(cached);

  // Perform analysis
  const analysis = await performAnalysis(audioBuffer);

  // Cache result (1 hour TTL)
  await redis.set(`analysis:${fileHash}`, JSON.stringify(analysis), 'EX', 3600);
  ```
- **Savings:** 100% for duplicate files (5-30s → instant)

**Effort:** 2-3 days (hash computation + Redis caching)

---

## 🟢 Medium Priority

### 9. Weak Password Requirements

**Problem:**
- Only minimum length check (8 characters)
- No complexity requirements (uppercase, number, special char)
- Accepts common passwords (e.g., "password123")

**Impact:**
- 🟢 **Security:** Weak passwords vulnerable to brute force
- Users can choose easily guessable passwords

**Solution:**
- Add complexity requirements
  ```typescript
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    throw new Error('Password must include uppercase, number, and special character');
  }
  ```
- Integrate `zxcvbn` for entropy-based strength estimation
  ```typescript
  const result = zxcvbn(password);
  if (result.score < 3) {  // Score 0-4 (3 = acceptable)
    throw new Error(`Weak password: ${result.feedback.warning}`);
  }
  ```
- Check against common password lists (Pwned Passwords API)

**Effort:** 1 day (validation logic + UI feedback)

---

### 10. No API Key Rotation Strategy

**Problem:**
- API keys are permanent (no expiration)
- Manual rotation process (update .env files)
- No support for multiple keys (zero-downtime rotation impossible)

**Impact:**
- 🟢 **Security:** Compromised keys remain valid indefinitely
- 🟢 **Ops Burden:** Manual rotation is error-prone

**Solution:**
- Support multiple API keys (array of valid keys)
  ```typescript
  const validKeys = process.env.API_KEYS.split(',');  // "key1,key2,key3"

  if (!validKeys.includes(providedKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  ```
- Rotation procedure:
  1. Add new key to array
  2. Deploy all services with both keys
  3. Update clients to use new key
  4. Remove old key from array
- Automated quarterly rotation (cron job + notification)

**Effort:** 2 days (multi-key support + rotation script)

---

### 11. No File Caching (Re-downloads)

**Problem:**
- Metadata and analysis services both download the same file
- File downloaded twice per session (redundant network I/O)

**Impact:**
- 🟢 **Performance:** 0.5-2 seconds wasted per session (duplicate download)
- 🟢 **Network:** Bandwidth wasted (10MB file = 20MB transferred)

**Solution:**
- Shared file cache (Redis or S3)
  ```typescript
  // Check cache
  const cached = await redis.get(`file:${url}`);
  if (cached) return Buffer.from(cached, 'base64');

  // Download and cache
  const file = await downloadFile(url);
  await redis.set(`file:${url}`, file.toString('base64'), 'EX', 3600);  // 1 hour TTL
  return file;
  ```
- Alternative: Metadata service downloads, passes to analysis service

**Effort:** 2 days (Redis caching + client updates)

---

### 12. No Request Logging

**Problem:**
- No structured logging (only `console.log`)
- No request ID for tracing across services
- No performance metrics (timing, status codes)

**Impact:**
- 🟢 **Debugging:** Hard to trace requests across services
- 🟢 **Monitoring:** No visibility into performance/errors

**Solution:**
- Structured JSON logging (Winston, Pino)
  ```typescript
  import winston from 'winston';

  const logger = winston.createLogger({
    format: winston.format.json(),
    transports: [new winston.transports.Console()]
  });

  logger.info('Session created', {
    sessionId: session.id,
    userId: user.id,
    duration: 45000,
    service: 'api'
  });
  ```
- Request ID middleware (propagate across services)
  ```typescript
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
  });
  ```

**Effort:** 2-3 days (logger setup + middleware + service updates)

---

## ⚪ Low Priority

### 13. No API Versioning

**Problem:**
- No URL or header-based versioning
- Breaking changes require coordinated frontend/backend deploy

**Impact:**
- ⚪ **Future Risk:** Breaking changes will disrupt clients
- Hard to maintain backward compatibility

**Solution:**
- URL-based versioning
  ```typescript
  app.use('/v1/sessions', sessionRoutes);
  app.use('/v2/sessions', sessionRoutesV2);  // Future version
  ```
- Or header-based versioning
  ```typescript
  Accept: application/vnd.mixtapelabs.v1+json
  ```

**Effort:** 1 day (routing refactor)

---

### 14. No Health Check Endpoints

**Problem:**
- No `/health` or `/ready` endpoints
- Kubernetes/Docker Compose cannot detect unhealthy services
- No way to check DB connection, service availability

**Impact:**
- ⚪ **Ops:** Cannot detect unhealthy services automatically
- Load balancers cannot remove unhealthy instances

**Solution:**
- Liveness check (is process running?)
  ```typescript
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  ```
- Readiness check (is service ready to handle requests?)
  ```typescript
  app.get('/health/ready', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;  // Check DB connection
      await redis.ping();                // Check Redis connection
      res.json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });
  ```

**Effort:** 1 day (endpoint implementation)

---

### 15. No Parallel Service Calls

**Problem:**
- Metadata and analysis services called sequentially
- Both only need file URL (no dependencies)
- Wastes 1-3 seconds (metadata time)

**Impact:**
- ⚪ **Performance:** 1-3 seconds wasted per session

**Solution:**
- Call services in parallel
  ```typescript
  // Before (sequential): 1-3s + 5-30s = 6-33s
  const metadata = await metadataClient.getMetadata(input);
  const analysis = await analysisClient.analyze(input);

  // After (parallel): max(1-3s, 5-30s) = 5-30s
  const [metadata, analysis] = await Promise.all([
    metadataClient.getMetadata(input),
    analysisClient.analyze(input)
  ]);
  ```

**Effort:** 30 minutes (engine workflow update)

---

## Resolved Issues

### ✅ COMPLETED: Comprehensive TSDoc Documentation (Nov 2025)

**Problem:** Insufficient inline documentation across codebase
**Solution:** Added 8,000+ lines of TSDoc/JSDoc across 44 files (98% coverage)
**Impact:** Dramatically improved code maintainability and onboarding

---

## Summary by Category

| Category            | Critical | High  | Medium | Low   | Total  |
| ------------------- | -------- | ----- | ------ | ----- | ------ |
| **Security**        | 2        | 2     | 1      | 0     | 5      |
| **Performance**     | 1        | 2     | 2      | 1     | 6      |
| **User Experience** | 0        | 2     | 0      | 0     | 2      |
| **Operations**      | 0        | 0     | 1      | 2     | 3      |
| **Code Quality**    | 0        | 0     | 0      | 0     | 0      |
| **Total**           | **3**    | **6** | **4**  | **3** | **16** |

---

## Prioritization Criteria

When prioritizing technical debt, consider:

1. **Security Impact:** Data breaches, credential theft, DoS attacks
2. **User Impact:** UX degradation, blocked workflows, frustration
3. **Scalability Impact:** Service crashes, thread exhaustion, database overload
4. **Cost Impact:** OpenAI API waste, infrastructure overprovisioning
5. **Effort:** Days to implement (favor high impact, low effort)

---

## Contribution Guide

When adding new technical debt items:

1. Use priority emoji (🔴/🟡/🟢/⚪)
2. Describe problem, impact, and solution
3. Estimate effort in days
4. Link to related issues/PRs
5. Update summary table

When resolving debt:
1. Move to "Resolved Issues" section
2. Link to resolving PR
3. Update summary table

---

## Further Reading

- [Performance Characteristics](./performance-characteristics.md) - Bottleneck analysis
- [Security Model](../domain/security-model.md) - Current security measures
- [Design Decisions](../architecture/design-decisions.md) - Architectural rationale
