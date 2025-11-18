# Database Patterns

This guide covers the Prisma ORM patterns and PostgreSQL strategies used throughout Auralyze.

## Prisma Schema Design

### User Model

```prisma
model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  firstName       String
  lastName        String
  role            UserRole  @default(USER)
  isActive        Boolean   @default(true)
  emailVerifiedAt DateTime?
  lastLoginAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  sessions        Session[]
}

enum UserRole {
  USER
  ADMIN
}
```

**Key Design Decisions:**

**UUIDs for Primary Keys:**
- Random, non-sequential identifiers
- Prevents enumeration attacks (no guessing user IDs)
- Safe for distributed systems (no coordination needed)
- Trade-off: Slightly larger index size vs integers

**Email Normalization:**
- Always stored as lowercase
- Ensures case-insensitive uniqueness (`user@example.com` === `USER@example.com`)
- Normalized in repository layer (transparent to services)

**Soft Delete Pattern (`isActive`):**
- Preserves audit trail (who created sessions, comments, etc.)
- Prevents foreign key constraint violations
- Allows account reactivation
- **Must be checked in authentication flow!**

**Timestamp Fields:**
- `createdAt`: Record creation time (never changes)
- `updatedAt`: Last modification time (Prisma auto-updates)
- `lastLoginAt`: Track user activity (useful for analytics)
- `emailVerifiedAt`: Null until email confirmed (planned feature)

### Session Model

```prisma
model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  payload   Json     // Serialized EngineState
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([createdAt])
}
```

**Key Design Decisions:**

**JSON Payload Field:**
- Complete `EngineState` serialized to JSON
- **Trade-off:** Flexibility vs query performance

**Pros:**
- Schema-free: No migrations when engine state changes
- Complete state captured: Exact workflow snapshot
- Simple: Single field, no joins

**Cons:**
- Cannot query by nested fields efficiently
- No partial updates (must replace entire payload)
- Larger storage footprint than normalized tables

**When Acceptable:**
Sessions are primarily queried by `userId` and `createdAt`, never by nested payload fields. This makes JSON a good fit. If we needed to query "all sessions with LUFS > -10", we'd extract that field to a dedicated column.

## Indexing Strategy

### Primary Key Indexes

```prisma
@id @default(uuid())
```

Automatically creates a **clustered index** (B-tree). All table rows are physically ordered by this key. Lookups by ID are O(log n).

### Unique Indexes

```prisma
email String @unique
```

Creates a unique index for fast lookups and uniqueness enforcement. Queries like `findUnique({ where: { email } })` use this index.

### Non-Unique Indexes

```prisma
@@index([userId])
@@index([createdAt])
```

**`userId` Index:**
- Optimizes: "Get all sessions for user X"
- Query: `findMany({ where: { userId } })`
- Avoids full table scan

**`createdAt` Index:**
- Optimizes: "Get recent sessions" (with `ORDER BY createdAt DESC`)
- Supports pagination queries
- Useful for analytics (sessions per day, etc.)

::: tip Index Selection
Only index fields you **actually query** in WHERE clauses or ORDER BY. Each index speeds up reads but slows down writes (index must be updated). Analyze query patterns before adding indexes.
:::

## Query Patterns

### findUnique vs findFirst

**`findUnique`:**
```typescript
// Requires a unique constraint (@id or @unique)
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' }
});
```

**`findFirst`:**
```typescript
// Composite conditions, no unique constraint required
const session = await prisma.session.findFirst({
  where: {
    id: sessionId,
    userId: userId  // Security: Both conditions must match
  }
});
```

::: warning Security via Composition
`findFirst` with multiple conditions provides authorization. Even if an attacker knows a session ID, they can't access it without also matching the `userId`. This prevents lateral movement attacks.
:::

### Upsert Strategy

**Upsert** (UPDATE or INSERT) provides idempotency for workflows:

```typescript
async save(state: EngineState): Promise<void> {
  await this.db.session.upsert({
    where: { id: state.sessionId },  // Unique constraint
    update: { payload: state },       // If exists, update
    create: {                         // If not exists, create
      id: state.sessionId,
      userId: state.userId,
      payload: state
    }
  });
}
```

**Benefits:**
- **Idempotency:** Retrying workflow doesn't create duplicates
- **Simplicity:** No need to check existence first
- **Atomicity:** Single database transaction (no race conditions)

**Requirements:**
- Must have a unique constraint on the `where` field
- In this case, `sessionId` is the primary key

## Pagination Patterns

### Offset-Based Pagination (Current)

```typescript
async findByUserId(userId: string, limit: number, offset: number): Promise<Session[]> {
  return this.db.session.findMany({
    where: { userId },
    take: limit,   // LIMIT
    skip: offset,  // OFFSET
    orderBy: { createdAt: 'desc' }
  });
}
```

**Pros:**
- Simple to implement
- Intuitive for users (page 1, 2, 3...)
- Supports jumping to arbitrary pages

**Cons:**
- **O(n) skip operation:** Database must scan `offset` rows before returning results
- Inefficient for large offsets (page 1000 = scan 99,000+ rows)
- Inconsistent results if data changes during pagination (page drift)

::: warning Offset Pagination Limits
Offset pagination becomes slow and unreliable at scale. For large datasets, prefer cursor-based pagination.
:::

### Cursor-Based Pagination (Recommended)

```typescript
// Keyset pagination using the last seen ID
async findByUserId(
  userId: string,
  limit: number,
  cursor?: string  // ID of last item from previous page
): Promise<Session[]> {
  return this.db.session.findMany({
    where: { userId },
    take: limit,
    skip: cursor ? 1 : 0,  // Skip the cursor itself
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' }
  });
}
```

**Pros:**
- **O(log n) lookups:** Uses index, no scanning
- Consistent: Not affected by concurrent inserts/deletes
- Efficient: Performance doesn't degrade with position

**Cons:**
- Cannot jump to arbitrary pages (only next/previous)
- Slightly more complex client-side logic
- Requires stable sort order (use unique field like ID)

**When to Use:**
- Infinite scroll UIs (mobile apps, feeds)
- Large datasets (thousands+ rows)
- Real-time data (new items appearing frequently)

## Data Normalization

### Current Schema (Denormalized)

Sessions store the complete `EngineState` as JSON:

```typescript
{
  sessionId: "uuid",
  userId: "uuid",
  uploadUrl: "https://...",
  fileInfo: { duration, format, ... },  // From metadata service
  analysis: { loudness, dynamics, ... }, // From analysis service
  feedback: { text, suggestions, ... }   // From feedback service
}
```

**Pros:**
- Single query to retrieve complete session
- No joins required
- Flexible schema (no migrations for engine changes)

**Cons:**
- Cannot efficiently query by nested fields
- Larger storage footprint
- Duplication if same analysis reused (future caching)

### Normalized Alternative (Not Implemented)

For high-query scenarios, consider extracting commonly queried fields:

```prisma
model Session {
  id        String   @id @default(uuid())
  userId    String
  uploadUrl String
  integratedLUFS Float?  // Extracted from analysis.loudness.integratedLUFS
  crestFactor Float?     // Extracted from analysis.dynamics.crestFactor
  payload   Json        // Full state preserved

  @@index([userId])
  @@index([integratedLUFS])  // Enables "sessions with LUFS > -10"
}
```

**Benefits:**
- Query by specific audio metrics
- Smaller JSON payload (duplicated data extracted)
- Supports analytics dashboards (average LUFS per user, etc.)

**Trade-offs:**
- More complex schema
- Migrations required when adding new metrics
- Must keep extracted fields in sync with JSON payload

::: tip Denormalize Until It Hurts
Start with JSON (flexible, simple). Extract fields to dedicated columns only when you have concrete query requirements. Premature normalization adds complexity without clear benefits.
:::

## Performance Optimization

### Query Performance

**Fast Queries (Indexed):**
```typescript
// O(log n) - uses unique index
await prisma.user.findUnique({ where: { email } });

// O(log n) - uses primary key
await prisma.user.findUnique({ where: { id } });

// O(log n) - uses non-unique index + sequential scan
await prisma.session.findMany({ where: { userId } });
```

**Slow Queries (Unindexed):**
```typescript
// O(n) - full table scan (no firstName index)
await prisma.user.findMany({ where: { firstName: 'John' } });

// O(n) - JSON field query requires full scan
await prisma.session.findMany({
  where: {
    payload: { path: ['analysis', 'loudness', 'integratedLUFS'], gt: -10 }
  }
});
```

### Connection Pooling

Prisma uses connection pooling by default:

```
DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=10"
```

**Recommendations:**
- **Development:** 5-10 connections
- **Production:** 20-50 connections (depends on load)
- **Formula:** `(number_of_workers × 2) + 1`

::: warning Connection Limits
PostgreSQL has a global connection limit (`max_connections`, default 100). Ensure your pool size × number of app instances doesn't exceed this. Use PgBouncer for connection pooling across multiple apps.
:::

### Bulk Operations

**Inefficient (N+1 queries):**
```typescript
for (const email of emails) {
  await prisma.user.create({ data: { email, ... } });
}
```

**Efficient (Single query):**
```typescript
await prisma.user.createMany({
  data: emails.map(email => ({ email, ... }))
});
```

**Trade-off:**
`createMany` doesn't return created records (for performance). Use `create` in a transaction if you need IDs.

## Transactions

### Implicit Transactions

Prisma wraps single operations in transactions automatically:

```typescript
// Atomic: Either both fields update or neither
await prisma.user.update({
  where: { id },
  data: { firstName: 'New', lastLoginAt: new Date() }
});
```

### Explicit Transactions

For multi-operation atomicity:

```typescript
await prisma.$transaction([
  prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
  prisma.session.deleteMany({ where: { userId } })
]);
```

All operations succeed or all fail. Rollback on error.

::: danger Transaction Deadlocks
Long-running transactions can cause deadlocks. Keep transactions short and consistent (always lock tables in the same order).
:::

## Soft Delete Implementation

**Marking Users as Inactive:**
```typescript
async deactivateUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false }
  });
}
```

**Filtering Inactive Users:**
```typescript
// Authentication middleware must check isActive
const user = await prisma.user.findUnique({ where: { email } });
if (!user || !user.isActive) {
  throw new Error('Invalid credentials');
}
```

**Reactivation:**
```typescript
async reactivateUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: true }
  });
}
```

::: tip Soft Delete Best Practices
- Always check `isActive` in authentication
- Consider adding `deletedAt` timestamp (audit trail)
- Hard delete for GDPR compliance (user requests data deletion)
- Archive soft-deleted records to separate table after 90 days (cold storage)
:::

## Further Reading

- [Prisma Documentation](https://www.prisma.io/docs) - Official Prisma ORM docs
- [Use the Index, Luke](https://use-the-index-luke.com/) - SQL indexing deep dive
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html) - Official optimization guide
- [Database Normalization](https://en.wikipedia.org/wiki/Database_normalization) - Normal forms explained
