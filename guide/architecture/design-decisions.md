# Design Decisions

This guide explains the key architectural decisions made in Auralyze, including rationale, trade-offs, and alternatives considered.

## Microservices Architecture

### Decision: Service Decomposition

Auralyze uses **microservices** with clear domain boundaries:
- **Main API:** Orchestration, auth, persistence
- **Metadata Service:** File metadata extraction (ffprobe)
- **Analysis Service:** DSP processing (Python + audio libraries)
- **Feedback Service:** LLM integration (OpenAI GPT-4)

### Rationale

**Technology Fit:**
- Metadata/feedback services are lightweight (Node.js)
- Analysis service requires Python ecosystem (librosa, pyloudnorm, essentia)
- Mixing languages in a monolith would create complexity

**Independent Scaling:**
- Analysis service is CPU-intensive (DSP processing)
- API and other services are I/O-bound (HTTP, database)
- Can scale services independently based on load

**Team Autonomy:**
- Services can be developed/deployed independently
- Clear contracts (HTTP APIs) reduce coordination overhead
- Different release cycles for different services

**Failure Isolation:**
- Analysis service crash doesn't affect metadata extraction
- Feedback service rate limit doesn't block other operations
- Easier to identify and fix issues

### Trade-offs

**Pros:**
- ✅ Language flexibility (Node.js + Python)
- ✅ Independent scaling (scale analysis service 3x, API 1x)
- ✅ Fault isolation (one service failure doesn't cascade)
- ✅ Technology fit (use best tool for each job)

**Cons:**
- ❌ Network latency (HTTP calls instead of function calls)
- ❌ Operational complexity (multiple deployments, logs, monitoring)
- ❌ Data consistency challenges (distributed transactions)
- ❌ Testing complexity (integration tests require all services)

### Alternatives Considered

**Monolith:**
- Single codebase, simpler deployment
- Rejected: Cannot mix Node.js and Python effectively
- Rejected: Scaling issues (scale entire app, not just DSP)

**Serverless Functions (AWS Lambda):**
- Auto-scaling, pay-per-use
- Rejected: Cold start latency (5-10 seconds unacceptable)
- Rejected: Execution time limits (15 min max, some files need more)

## LangGraph Workflow Orchestration

### Decision: LangGraph for Workflow Engine

Auralyze uses **LangGraph** (from LangChain ecosystem) to orchestrate the workflow across services.

### Rationale

**Declarative Workflow:**
- Nodes represent steps (metadata, analysis, feedback)
- Edges define dependencies (analysis depends on metadata)
- Graph structure is explicit and visualizable

**State Management:**
- Immutable state object passed between nodes
- State updates via returning new state (functional pattern)
- Complete state history for debugging

**Composability:**
- Easy to add new nodes (e.g., validation, notification)
- Easy to modify flow (e.g., parallel execution)
- Reusable nodes across workflows

**LLM Integration:**
- Built-in support for LLM calls (OpenAI, Anthropic)
- Prompt templating and structured outputs
- Error handling and retries

**Portability:**
- Engine is a standalone npm package
- Can be used by API, CLI tools, batch jobs
- No framework lock-in (just TypeScript functions)

### Trade-offs

**Pros:**
- ✅ Declarative, readable workflow definition
- ✅ Immutable state (easier debugging, testing)
- ✅ Composable (add nodes without modifying existing code)
- ✅ Portable (library, not framework)
- ✅ LLM-first (built for AI workflows)

**Cons:**
- ❌ Learning curve (LangGraph-specific concepts)
- ❌ Overkill for simple linear flows (could be plain functions)
- ❌ Limited visualization tools (no built-in dashboard)
- ❌ Dependency on LangChain ecosystem

### Alternatives Considered

**Plain Functions (Imperative):**
```typescript
async function runWorkflow(input) {
  const metadata = await fetchMetadata(input.url);
  const analysis = await analyzeAudio(input.url);
  const feedback = await generateFeedback({ metadata, analysis });
  return { metadata, analysis, feedback };
}
```
- Simpler, no library dependency
- Rejected: Less composable, harder to visualize, harder to test nodes independently

**Temporal.io (Distributed Workflow Engine):**
- Handles retries, timeouts, failure recovery automatically
- Rejected: Too heavyweight for current scale (overkill)
- Rejected: Requires separate Temporal server infrastructure

**Step Functions (AWS):**
- Visual workflow designer, built-in error handling
- Rejected: Vendor lock-in (AWS-specific)
- Rejected: Not portable (cannot run locally or elsewhere)

## Dependency Injection

### Decision: Interface-Based DI for Clients

Engine accepts **abstract interfaces** for clients (metadata, analysis, feedback), with implementations injected at runtime.

### Rationale

**Testability:**
- Swap real HTTP clients with stubs in tests
- Unit tests don't require running microservices
- Fast, deterministic test execution

**Flexibility:**
- Multiple implementations (HTTP, stubs, direct OpenAI)
- Environment-driven selection (production vs development)
- Easy to add new implementations (e.g., gRPC client)

**Portability:**
- Engine has no hardcoded service URLs
- Same library works in API, CLI, batch jobs
- Configuration lives outside the library

**Development Experience:**
- Stub clients for local development (no microservices needed)
- Mix implementations (e.g., stub metadata + real analysis)
- Faster iteration (no waiting for real services)

### Implementation

**Interface Definitions:**
```typescript
export interface AudioMetadataClient {
  getMetadata(input: AudioMetadataInput): Promise<AudioMetadataOutput>;
}

export interface AudioAnalysisClient {
  analyze(input: AudioAnalysisInput): Promise<AudioAnalysisOutput>;
}

export interface FeedbackClient {
  generateFeedback(state: EngineState): Promise<FeedbackResult>;
}
```

**Factory Pattern:**
```typescript
export function buildEngineDeps(): AuralyzeEngineDeps {
  if (process.env.USE_STUB_CLIENTS === 'true') {
    return {
      audioMetadataClient: new StubAudioMetadataClient(),
      audioAnalysisClient: new StubAudioAnalysisClient(),
      feedbackClient: new StubFeedbackClient()
    };
  }

  return {
    audioMetadataClient: new HttpAudioMetadataClient(/* ... */),
    audioAnalysisClient: new HttpAudioAnalysisClient(/* ... */),
    feedbackClient: new HttpFeedbackClient(/* ... */)
  };
}
```

### Trade-offs

**Pros:**
- ✅ Highly testable (inject mocks/stubs)
- ✅ Flexible (multiple implementations)
- ✅ Portable (no hardcoded dependencies)
- ✅ Fast development (stub mode)

**Cons:**
- ❌ More boilerplate (interfaces + multiple implementations)
- ❌ Runtime selection (no compile-time checking of which client used)
- ❌ Factory function complexity (environment variable parsing)

### Alternatives Considered

**Hardcoded HTTP Clients:**
- Simpler, no interfaces needed
- Rejected: Cannot test without running services
- Rejected: Not portable (URLs hardcoded)

**Full DI Framework (InversifyJS, tsyringe):**
- More features (lifecycle management, decorators)
- Rejected: Overkill for 3 dependencies
- Rejected: Learning curve not justified

## Synchronous HTTP Communication

### Decision: REST-Style HTTP/JSON

Services communicate via **synchronous HTTP** with JSON payloads.

### Rationale

**Simplicity:**
- HTTP is universal (no custom protocol)
- JSON is human-readable (easy debugging)
- Standard tools (curl, Postman) work out of the box

**No Broker Dependency:**
- No message broker (RabbitMQ, Kafka) to deploy/manage
- Reduces operational complexity
- Faster initial development

**Request-Response Fit:**
- Workflow is inherently synchronous (need metadata before analysis)
- No need for async messaging patterns
- Easier to reason about (call service, get result)

**Ecosystem Support:**
- Every language has HTTP client
- Built-in retries, timeouts (fetch API)
- Middleware ecosystem (Express, Fastify)

### Trade-offs

**Pros:**
- ✅ Simple (no broker, no queues)
- ✅ Debuggable (inspect requests with curl)
- ✅ Universal (every language supports HTTP)
- ✅ Direct (request-response, no message delivery guarantees needed)

**Cons:**
- ❌ Synchronous blocking (10-60 second requests)
- ❌ No built-in retries (must implement manually)
- ❌ Tight coupling (API waits for services, cannot fail independently)
- ❌ Scaling challenges (long-running requests consume threads)

### Alternatives Considered

**Message Queue (RabbitMQ, AWS SQS):**
- Async, decoupled, automatic retries
- Rejected: Adds infrastructure complexity
- Rejected: Overkill for linear workflow (no parallelism currently)

**gRPC:**
- Binary protocol, faster serialization, streaming
- Rejected: More complex debugging (binary payloads)
- Rejected: Not widely supported in browsers (would need proxy)

**GraphQL:**
- Single endpoint, client-specified queries
- Rejected: Overkill (no complex query needs)
- Rejected: Services don't need flexible querying

## PostgreSQL + Prisma

### Decision: PostgreSQL with Prisma ORM

Auralyze uses **PostgreSQL** for relational data storage with **Prisma** as the ORM.

### Rationale

**PostgreSQL:**
- **ACID transactions:** Strong consistency guarantees
- **Mature ecosystem:** 30+ years of development
- **JSON support:** `JSONB` type for flexible engine state storage
- **Performance:** Excellent query performance with proper indexing
- **Open source:** No vendor lock-in, runs anywhere

**Prisma:**
- **Type safety:** Auto-generated TypeScript types from schema
- **Migrations:** Version-controlled schema evolution
- **Developer experience:** Intuitive query API, great documentation
- **Introspection:** Can generate schema from existing database
- **Query builder:** Compile-time type checking prevents SQL errors

### Trade-offs

**Pros:**
- ✅ Strong consistency (ACID transactions)
- ✅ Type safety (Prisma generates types)
- ✅ Flexible schema (JSONB for engine state)
- ✅ Mature ecosystem (decades of tooling)
- ✅ Excellent documentation (PostgreSQL + Prisma)

**Cons:**
- ❌ Vertical scaling only (cannot shard easily)
- ❌ ORM overhead (slight performance cost vs raw SQL)
- ❌ JSONB query limitations (cannot index nested fields efficiently)

### Alternatives Considered

**MongoDB (Document Database):**
- Schema-free, JSON-native storage
- Rejected: Weaker consistency guarantees (eventual consistency)
- Rejected: Less mature relational querying (joins, transactions)
- Rejected: Team has more PostgreSQL experience

**MySQL:**
- Very similar to PostgreSQL
- Rejected: PostgreSQL has better JSON support (JSONB)
- Rejected: PostgreSQL has more advanced features (CTEs, window functions)

**TypeORM:**
- Alternative ORM for TypeScript
- Rejected: Prisma has better developer experience
- Rejected: Prisma migrations are more robust

## JWT Authentication

### Decision: JWT with HttpOnly Cookies

User authentication uses **JSON Web Tokens (JWT)** stored in **HttpOnly cookies**.

### Rationale

**JWT:**
- **Stateless:** No session store needed (scales horizontally)
- **Self-contained:** All claims in token (no database lookup per request)
- **Standard:** RFC 7519, widely supported
- **Portable:** Works across services (microservices can verify independently)

**HttpOnly Cookies:**
- **XSS protection:** JavaScript cannot access cookie
- **Automatic transmission:** Browser sends with every request
- **CSRF mitigation:** SameSite attribute prevents cross-site attacks
- **Secure:** HTTPS-only flag prevents interception

### Trade-offs

**Pros:**
- ✅ Stateless (no session store, scales easily)
- ✅ XSS-resistant (HttpOnly flag)
- ✅ CSRF-resistant (SameSite flag)
- ✅ Portable (works across microservices)

**Cons:**
- ❌ No server-side revocation (token valid until expiration)
- ❌ Larger payload than session ID (sent with every request)
- ❌ Expiration requires re-authentication (7-day expiry)

### Alternatives Considered

**Session Cookies (Server-Side Sessions):**
- Server stores session data (Redis, database)
- Can revoke sessions immediately
- Rejected: Requires session store (Redis dependency)
- Rejected: Database lookup on every request (performance cost)

**OAuth2 (Delegated Authorization):**
- Industry standard for third-party access
- Rejected: Overkill for first-party app (no third-party integrations)
- Rejected: More complex flow (refresh tokens, scopes)

**API Keys (Stateless Tokens):**
- Simple, no expiration
- Rejected: No user identity (cannot track who made request)
- Rejected: Permanent tokens are security risk (should expire)

## JSON State Payload

### Decision: Store Complete Engine State as JSON

Sessions store the **entire engine state** (metadata, analysis, feedback) in a single JSON column.

### Rationale

**Flexibility:**
- Schema-free: No migrations when engine state changes
- Complete snapshot: Exact workflow state preserved
- Easy serialization: `JSON.stringify(engineState)`

**Simplicity:**
- Single query to retrieve session
- No joins required (all data in one row)
- Easy to reason about (state is atomic)

**Audit Trail:**
- Exact analysis results preserved forever
- Can reproduce feedback from historical data
- Debugging: Inspect intermediate results

### Trade-offs

**Pros:**
- ✅ Schema-free (no migrations for engine changes)
- ✅ Complete state (entire workflow preserved)
- ✅ Simple queries (no joins)
- ✅ Audit trail (historical data intact)

**Cons:**
- ❌ Cannot query by nested fields efficiently (e.g., "all sessions with LUFS > -10")
- ❌ Larger storage footprint (duplicate data if same analysis reused)
- ❌ No partial updates (must replace entire JSON)
- ❌ Type safety: JSON fields are not checked by Prisma

### Alternatives Considered

**Normalized Tables:**
```prisma
model Session {
  id        String
  fileInfo  FileInfo  @relation
  analysis  Analysis  @relation
  feedback  Feedback  @relation
}

model Analysis {
  loudness  Loudness  @relation
  dynamics  Dynamics  @relation
  spectrum  Spectrum  @relation
}
```

- More structured, queryable
- Rejected: Over-engineered for current query needs
- Rejected: Migrations required for every engine change
- Rejected: Complex joins (performance cost)

**Hybrid Approach (Extract Hot Fields):**
```prisma
model Session {
  id             String
  integratedLUFS Float?  // Extracted for queries
  crestFactor    Float?  // Extracted for queries
  payload        Json    // Full state preserved
}
```

- Queryable + flexible
- Considered: Good future optimization if query needs emerge
- Not implemented yet: YAGNI (current queries only use userId, createdAt)

## Star Topology (No Service-to-Service Communication)

### Decision: Centralized API Orchestration

Services **never** call each other. All communication flows through the main API.

### Rationale

**Simplicity:**
- Single source of truth (API knows entire workflow)
- Easy to trace requests (all logs in one place)
- No circular dependencies (services are isolated)

**Debugging:**
- All requests logged in API (complete request path)
- Service failures immediately visible (API logs error)
- No cascading failures (services don't depend on each other)

**Security:**
- API enforces authorization (services trust API)
- Services don't need user authentication
- API key is sufficient for service-to-service auth

### Trade-offs

**Pros:**
- ✅ Simple to reason about (linear flow)
- ✅ Easy debugging (centralized logs)
- ✅ No circular dependencies
- ✅ Centralized authorization

**Cons:**
- ❌ API is single point of failure
- ❌ API is bottleneck (all traffic flows through it)
- ❌ Cannot optimize (e.g., analysis service calling metadata directly)

### Alternatives Considered

**Mesh Topology (Services Call Each Other):**
- More distributed, no single bottleneck
- Rejected: More complex (distributed tracing needed)
- Rejected: Harder to debug (trace requests across services)
- Rejected: Authorization complexity (services need auth context)

## Future Architectural Decisions

### Async Job Queue (Planned)

**Problem:** 10-60 second workflows block HTTP threads

**Solution:** Redis-backed job queue (Bull, BullMQ)
- API enqueues job, returns immediately (202 Accepted)
- Worker processes job asynchronously
- Client polls for status or uses WebSockets

**Benefits:**
- Fast API responses (<100ms)
- Better user experience (progress updates)
- Resilience (automatic retries)

### Result Caching (Planned)

**Problem:** Identical files re-analyzed every time

**Solution:** Cache analysis results by file content hash (SHA-256)
- Check cache before calling analysis service
- Cache results in Redis (1 hour TTL)
- Instant responses for duplicate files

**Benefits:**
- 5-30 second savings per cached file
- Reduced load on analysis service
- Lower OpenAI API costs (fewer feedback calls)

### Read Replicas (Future)

**Problem:** Database queries compete with writes

**Solution:** PostgreSQL read replicas
- Write to primary (sessions, users)
- Read from replicas (session list, user profile)
- Prisma supports read replicas out of the box

**Benefits:**
- Horizontal scaling for read queries
- Lower latency (geographically distributed replicas)
- Primary database offloaded (only handles writes)

## Further Reading

- [System Overview](./system-overview.md) - High-level architecture diagram
- [Session Lifecycle](./session-lifecycle.md) - End-to-end flow
- [LangGraph Workflow](../langgraph.md) - Engine implementation
- [Microservices Patterns](https://microservices.io/patterns/index.html) - Architecture patterns catalog
