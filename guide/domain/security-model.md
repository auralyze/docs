# Security Model

This guide explains the authentication and authorization mechanisms used throughout the Mixtape platform.

## Password Security (bcrypt)

### Hashing Algorithm

Mixtape uses **bcrypt** for password hashing, a deliberately slow, adaptive algorithm based on the Blowfish cipher.

**Parameters:**
- **Algorithm:** bcrypt (Blowfish-based key derivation)
- **Salt rounds:** 10 (2^10 = 1,024 iterations)
- **Hashing time:** ~100ms per password
- **Output:** 60-character hash string

**Example Hash:**
```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
 │  │  └────────────────┬────────────────┘ └──────────┬──────────┘
 │  │                  salt                        hash
 │  └─ cost factor (2^10 rounds)
 └─ bcrypt version
```

### Security Properties

**Per-Password Salts:**
Each password gets a unique random salt, preventing rainbow table attacks. Even identical passwords produce different hashes.

**Adaptive Cost Factor:**
The salt rounds can be increased over time as hardware improves. Currently set to 10, but can be raised to 12-15 as CPUs become faster.

**Resistant to GPU Acceleration:**
bcrypt is memory-hard, making it expensive to parallelize on GPUs. This slows down brute-force attacks significantly compared to fast hashes like SHA-256.

**Constant-Time Comparison:**
Password verification uses constant-time comparison to prevent timing attacks that could leak information about password correctness.

::: tip Why Slow Is Good
The ~100ms hashing time is intentional. It's imperceptible to users logging in once, but makes brute-force attacks impractical. An attacker trying 1 million passwords would need ~28 hours instead of seconds with a fast hash.
:::

### Current Limitations & Future Work

**Current Password Requirements:**
- Minimum length: 8 characters
- No complexity requirements (uppercase, numbers, special characters)
- No common password checks

**Planned Improvements:**
- ✅ TODO: Add complexity requirements (uppercase, number, special char)
- ✅ TODO: Check against common password lists (e.g., "password123", "qwerty")
- ✅ TODO: Integrate `zxcvbn` for entropy-based strength estimation
- ✅ TODO: Enforce minimum strength score before accepting password

## JWT Token Lifecycle

### Token Structure

JSON Web Tokens (JWTs) consist of three base64-encoded parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLXV1aWQi...
└──────────┬──────────┘ └──────────┬──────────┘ └────┬────┘
         Header              Payload           Signature
```

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload (Claims):**
```json
{
  "sub": "user-uuid",              // Subject (user ID)
  "email": "user@example.com",     // User email
  "role": "USER",                  // USER or ADMIN
  "iat": 1234567890,               // Issued At (Unix timestamp)
  "exp": 1234987890                // Expiration (Unix timestamp)
}
```

**Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  JWT_SECRET
)
```

### Security Configuration

**Signing Algorithm:**
- **HS256** (HMAC with SHA-256)
- Symmetric signing (same secret for sign and verify)
- Secret key must be cryptographically random, 32+ characters

**Token Expiration:**
- Default: **7 days** (balances security vs user convenience)
- Configurable via environment variable
- Expired tokens are rejected during verification

**Token Verification Workflow:**
1. Extract token from cookie or `Authorization: Bearer <token>` header
2. Verify signature using `JWT_SECRET` (prevents tampering)
3. Check expiration timestamp (reject if expired)
4. Extract user ID from `sub` claim
5. Fetch user from database (ensure exists and is active)
6. Check `isActive` status (respect soft deletes)
7. Populate request context with `AuthUser` object

::: warning Token Tampering
Never trust JWT payload without verifying the signature. An attacker could modify the payload (e.g., change role to ADMIN), but the signature verification will fail unless they have the secret key. This is why `JWT_SECRET` must never be exposed.
:::

## Cookie Security

JWTs are stored in **HttpOnly cookies** for web clients, providing multiple layers of protection:

```javascript
{
  httpOnly: true,        // JavaScript cannot access (XSS protection)
  secure: true,          // HTTPS only in production (MITM protection)
  sameSite: 'lax',       // Prevents CSRF, allows normal navigation
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days (matches JWT exp)
  path: '/'              // Cookie sent to all routes
}
```

### Cookie Security Flags Explained

**httpOnly:**
Prevents JavaScript from reading the cookie via `document.cookie`. This protects against Cross-Site Scripting (XSS) attacks where malicious scripts try to steal tokens.

**secure:**
Cookie only transmitted over HTTPS (encrypted connections). In production, this prevents Man-in-the-Middle (MITM) attacks from intercepting tokens. Disabled in development for `http://localhost`.

**sameSite: 'lax':**
- Prevents Cross-Site Request Forgery (CSRF) attacks
- Cookie sent for top-level navigation (clicking links)
- Cookie NOT sent for cross-site POST requests
- Balances security with usability (allows normal navigation)

**maxAge:**
Cookie expiration aligned with JWT expiration (7 days). Browser automatically deletes expired cookies.

## API Key Authentication (Microservices)

Internal microservices use simple symmetric key authentication via the `x-api-key` header.

### Key Generation

API keys are cryptographically random 256-bit values:

```javascript
// scripts/generate-api-key.js
const crypto = require('crypto');
const apiKey = crypto.randomBytes(32).toString('base64url');
console.log(apiKey);

// Example output: "xK8mP3vR9nQ2wZ7jY5tL1fD4hG6sA0uBcM9nV2wX3yZ"
```

### Middleware Validation

Each microservice validates the API key in middleware:

```typescript
export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const providedKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    return res.status(500).json({ error: 'API_KEY not configured' });
  }

  if (providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
```

### Key Synchronization

API keys are synced between the main API and microservices using helper scripts:

- `api/scripts/sync-metadata-api-key.js`
- `api/scripts/sync-analysis-api-key.js`
- `api/scripts/sync-feedback-api-key.js`

These scripts read keys from microservice `.env` files and inject them into the API's `.env`.

::: tip Service-to-Service Auth
API keys are appropriate for internal service-to-service communication where:
- Services are on a private network
- Each service needs a simple authentication mechanism
- Overhead of OAuth2 or mutual TLS is unnecessary

For external APIs or untrusted networks, consider more robust authentication.
:::

### Security Considerations

**Current Implementation:**
- ✅ Simple and effective for internal services
- ✅ Keys are environment variables (not hardcoded)
- ✅ Validation in middleware (fails fast)

**Planned Improvements:**
- ✅ TODO: Implement key rotation strategy (quarterly or after incidents)
- ✅ TODO: Support multiple keys for zero-downtime rotation
- ✅ TODO: Add request signing (HMAC) to prevent replay attacks
- ✅ TODO: Log authentication failures for security monitoring

## Authentication Limitations & Future Work

### Critical Security Gaps

**1. Token Revocation:**
- **Current:** JWT is stateless = no server-side logout enforcement
- **Issue:** Stolen token remains valid until expiration (up to 7 days)
- **Solution:** Redis token blacklist with TTL
  ```typescript
  // On logout:
  await redis.set(`blacklist:${tokenId}`, '1', 'EX', remainingTTL);

  // On verification:
  const isBlacklisted = await redis.exists(`blacklist:${tokenId}`);
  if (isBlacklisted) throw new Error('Token revoked');
  ```

**2. Rate Limiting:**
- **Current:** No rate limiting on any endpoints
- **Risk:** Brute-force attacks, credential stuffing, DoS
- **Solution:** Express rate-limit middleware
  - Auth endpoints: 5 attempts per 15 minutes
  - API endpoints: 100 requests per minute

**3. Refresh Token Flow:**
- **Current:** 7-day JWT requires re-authentication after expiration
- **Issue:** Poor UX for long sessions, large theft window
- **Solution:** Short-lived access tokens (15 min) + long-lived refresh tokens (30 days)
  - Access token: Used for API requests
  - Refresh token: Used to obtain new access tokens
  - Rotation: Refresh token rotated on each use

### Planned Security Features

**Email Verification:**
- Users must verify email before accessing the platform
- Prevents fake accounts and enumeration attacks
- Time-limited verification link sent via email

**Password Reset:**
- Email-based password recovery
- Time-limited reset token (1 hour)
- Token invalidated after use
- Requires email verification first

**Two-Factor Authentication (2FA):**
- TOTP-based (Time-based One-Time Password)
- Backup codes for account recovery
- Required for admin accounts

## Threat Model

### Protected Against

✅ **XSS (Cross-Site Scripting):** HttpOnly cookies prevent JavaScript access
✅ **CSRF (Cross-Site Request Forgery):** SameSite cookies prevent cross-origin requests
✅ **MITM (Man-in-the-Middle):** HTTPS + Secure flag encrypt tokens in transit
✅ **Rainbow Tables:** Per-password salts defeat precomputed hash attacks
✅ **Brute Force (Passwords):** bcrypt's slow hashing makes brute force impractical
✅ **Token Tampering:** HMAC signature prevents payload modification

### Currently Vulnerable To

⚠️ **Brute Force (Login):** No rate limiting on login endpoint
⚠️ **Token Theft:** Stolen JWT valid until expiration (no revocation)
⚠️ **Credential Stuffing:** No CAPTCHA or anomaly detection
⚠️ **Account Enumeration:** Login/register responses leak account existence
⚠️ **DoS (Denial of Service):** No rate limiting on any endpoint

## Further Reading

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT Best Practices (RFC)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-jwt-bcp)
- [bcrypt Explained](https://auth0.com/blog/hashing-in-action-understanding-bcrypt/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Common web vulnerabilities
