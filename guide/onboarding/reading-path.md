# Reading Path for New Engineers

Welcome to Mixtape! This guide provides a recommended reading path to help you understand the platform from the ground up.

::: tip Estimated Time
Complete onboarding: **4-6 hours** (spread across 2-3 days)
- Day 1: Foundation (2-3 hours)
- Day 2: Deep Dive (1-2 hours)
- Day 3: Advanced Topics (1 hour)
:::

## Phase 1: Foundation (Start Here)

### 1. Project Overview

**Goal:** Understand what Mixtape does and why it exists

📖 **Read:**
- [Landing Page](/) - Mission and quick overview
- [Getting Started](../getting-started.md) - Installation and first workflow

**Time:** 20 minutes

**Key Takeaways:**
- Mixtape provides AI-powered mix feedback for music producers
- Platform consists of API + 3 microservices + engine library
- Workflow: Upload audio → Metadata → Analysis → AI Feedback

---

### 2. System Architecture

**Goal:** Understand how components fit together

📖 **Read:**
- [System Overview](../architecture/system-overview.md) - High-level architecture diagram
- [Session Lifecycle](../architecture/session-lifecycle.md) - End-to-end flow

**Time:** 40 minutes

**Key Takeaways:**
- Star topology (API orchestrates, services don't talk to each other)
- Synchronous HTTP/JSON communication
- PostgreSQL for persistence, JWT for auth
- Complete engine state saved as JSON payload

**Hands-On:**
- Run `docker-compose up` to start all services
- Create a test session via Postman/curl
- Inspect logs to see workflow execution

---

### 3. Domain Knowledge (Choose Your Path)

**Goal:** Understand technical concepts relevant to your work

#### Path A: Backend Engineers

📖 **Read:**
1. [Security Model](../domain/security-model.md) - Auth flow (JWT, bcrypt, API keys)
2. [Database Patterns](../domain/database-patterns.md) - Prisma ORM, indexing, queries
3. [Communication Patterns](../domain/communication-patterns.md) - HTTP clients, error handling

**Time:** 60 minutes

**Key Takeaways:**
- JWT stored in HttpOnly cookies (XSS protection)
- bcrypt with 10 salt rounds (~100ms per password)
- Upsert pattern for idempotency
- API key auth for microservices

#### Path B: Audio/DSP Engineers

📖 **Read:**
1. [Audio Fundamentals](../domain/audio-fundamentals.md) - LUFS, dynamics, spectrum, stereo
2. [Audio Analysis Service](../audio-analysis-service.md) - DSP implementation
3. [Session Lifecycle](../architecture/session-lifecycle.md) - Analysis phase details

**Time:** 60 minutes

**Key Takeaways:**
- EBU R128 standard for loudness metering
- Crest factor = ratio of peak to RMS
- Mid/side processing for stereo width
- Analysis takes 5-30 seconds (scales with duration)

#### Path C: Frontend Engineers

📖 **Read:**
1. [API Reference](../api-reference.md) - Endpoints, request/response formats
2. [Session Lifecycle](../architecture/session-lifecycle.md) - Client interaction flow
3. [Security Model](../domain/security-model.md) - JWT cookie handling

**Time:** 45 minutes

**Key Takeaways:**
- React Query for data fetching + caching
- JWT automatically sent via HttpOnly cookie
- Sessions take 10-60 seconds (show progress UI)
- 202 Accepted pattern for async jobs (future)

---

## Phase 2: Deep Dive (Day 2)

### 4. Engine Architecture

**Goal:** Understand workflow orchestration

📖 **Read:**
- [LangGraph Workflow](../langgraph.md) - Graph-based orchestration
- [Dependency Injection & Clients](../clients.md) - Interface abstraction
- [Session State & Schemas](../session-state.md) - State management

**Time:** 50 minutes

**Key Takeaways:**
- LangGraph nodes = workflow steps (metadata → analysis → feedback)
- Immutable state passed between nodes
- Dependency injection for testability (stub clients)
- Engine is portable library (no framework lock-in)

**Hands-On:**
- Run engine in development mode: `npm run dev` (in `engine/`)
- Inspect `EngineState` in debugger
- Modify a node to add logging
- Run tests: `npm test`

---

### 5. Microservices Deep Dive

**Goal:** Understand individual service responsibilities

📖 **Read:**
- [Microservices Overview](../microservices-overview.md) - Service landscape
- [Audio Metadata Service](../audio-metadata-service.md) - ffprobe wrapper
- [Audio Analysis Service](../audio-analysis-service.md) - DSP implementation
- [Audio Feedback Service](../audio-feedback-service.md) - LLM integration

**Time:** 45 minutes

**Key Takeaways:**
- Each service has single responsibility
- Metadata: Fast (1-3s), file headers only
- Analysis: Slow (5-30s), CPU-intensive DSP
- Feedback: Variable (3-10s), depends on OpenAI API

**Hands-On:**
- Call services directly via curl (bypass API)
- Inspect service logs during workflow
- Modify feedback prompt to test changes

---

### 6. Design Decisions

**Goal:** Understand architectural trade-offs

📖 **Read:**
- [Design Decisions](../architecture/design-decisions.md) - Rationale for key choices

**Time:** 40 minutes

**Key Takeaways:**
- Microservices for language flexibility (Node.js + Python)
- LangGraph for declarative workflows (composability)
- JWT for stateless auth (horizontal scaling)
- JSON payload for flexibility (no migrations)
- Star topology for simplicity (centralized orchestration)

---

## Phase 3: Advanced Topics (Day 3)

### 7. Performance & Operations

**Goal:** Understand bottlenecks and optimization strategies

📖 **Read:**
- [Performance Characteristics](../operations/performance-characteristics.md) - Timing breakdown
- [Technical Debt](../operations/technical-debt.md) - Known issues and future work

**Time:** 50 minutes

**Key Takeaways:**
- Analysis service is bottleneck (5-30s, 50-80% of total time)
- Synchronous workflow blocks HTTP threads (planned: async queue)
- No result caching (planned: Redis cache by file hash)
- No rate limiting (critical security gap)

---

### 8. Development Workflow

**Goal:** Learn how to contribute effectively

📖 **Read:**
- [Contributing Guide](../onboarding/contributing.md) - Code standards and review process
- [Testing Strategy](../testing.md) - Unit/integration test patterns
- [AI Collaboration Guidelines](../ai-guidelines.md) - Working with AI assistants
- [Releasing & CI/CD](../releasing.md) - Deployment process

**Time:** 40 minutes

**Key Takeaways:**
- TSDoc required for all public functions
- Code examples required for complex logic
- Run tests before committing: `npm test`
- GitHub PR template guides reviews

---

## Quick Reference Cheatsheet

### Common Commands

```bash
# Start all services
docker-compose up

# Run API only (with stub clients)
cd api && USE_STUB_CLIENTS=true npm run dev

# Run engine tests
cd engine && npm test

# Run database migrations
cd api && npx prisma migrate dev

# Generate Prisma client
cd api && npx prisma generate

# View API logs
docker-compose logs -f api

# View analysis service logs
docker-compose logs -f analysis
```

### Key URLs (Development)

- **Web App:** `http://localhost:3100`
- **API:** `http://localhost:3000`
- **Metadata Service:** `http://localhost:3001`
- **Analysis Service:** `http://localhost:3002`
- **Feedback Service:** `http://localhost:3003`
- **PostgreSQL:** `localhost:5432`
- **Prisma Studio:** `npx prisma studio` (`http://localhost:5555`)

### Environment Variables (.env)

**API:**
```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="<random-32-chars>"
METADATA_SERVICE_URL="http://localhost:3001"
METADATA_API_KEY="<key>"
ANALYSIS_SERVICE_URL="http://localhost:3002"
ANALYSIS_API_KEY="<key>"
FEEDBACK_SERVICE_URL="http://localhost:3003"
FEEDBACK_API_KEY="<key>"
OPENAI_API_KEY="sk-..."
```

**Services:**
```bash
API_KEY="<service-api-key>"
PORT="300X"
```

### Important File Locations

| Component               | Path                                   |
| ----------------------- | -------------------------------------- |
| **Engine Source**       | `engine/src/`                          |
| **Engine State Schema** | `engine/src/state.ts`                  |
| **LangGraph Workflow**  | `engine/src/index.ts`                  |
| **API Routes**          | `api/src/routes/`                      |
| **API Controllers**     | `api/src/controllers/`                 |
| **Prisma Schema**       | `api/prisma/schema.prisma`             |
| **Migrations**          | `api/prisma/migrations/`               |
| **Service Clients**     | `api/src/clients/`                     |
| **Analysis DSP**        | `audio-analysis-service/src/services/` |
| **Feedback Prompts**    | `audio-feedback-service/src/services/` |

## Learning by Doing: First Tasks

### Task 1: Add Logging to Engine Node (Easy)

**Goal:** Understand engine workflow execution

**Steps:**
1. Open `engine/src/index.ts`
2. Find the `analyze` node
3. Add console log before analysis call:
   ```typescript
   async analyze(state: EngineState, deps: MixtapeEngineDeps): Promise<Partial<EngineState>> {
     console.log('[analyze] Starting analysis for session:', state.sessionId);
     const analysis = await deps.audioAnalysisClient.analyze({ url: state.uploadUrl });
     console.log('[analyze] Completed:', analysis);
     return { analysis };
   }
   ```
4. Run workflow and verify logs appear

**Time:** 15 minutes

---

### Task 2: Add New Session Endpoint (Medium)

**Goal:** Understand API request flow

**Steps:**
1. Add route in `api/src/routes/sessions.ts`:
   ```typescript
   router.get('/:id/metadata', sessionController.getSessionMetadata);
   ```
2. Add controller method in `api/src/controllers/sessionController.ts`:
   ```typescript
   async getSessionMetadata(req: Request, res: Response) {
     const session = await sessionRepository.findById(req.params.id);
     if (!session) return res.status(404).json({ error: 'Not found' });
     res.json({ metadata: session.fileInfo });
   }
   ```
3. Test with curl:
   ```bash
   curl http://localhost:3000/api/sessions/<id>/metadata
   ```

**Time:** 30 minutes

---

### Task 3: Implement Analysis Result Caching (Hard)

**Goal:** Optimize performance and understand Redis integration

**Steps:**
1. Install Redis: `docker run -d -p 6379:6379 redis`
2. Add caching to analysis service:
   ```python
   import redis
   import hashlib
   import json

   r = redis.Redis(host='localhost', port=6379, decode_responses=True)

   def analyze_audio(url):
       # Compute file hash
       audio_bytes = download_file(url)
       file_hash = hashlib.sha256(audio_bytes).hexdigest()

       # Check cache
       cached = r.get(f'analysis:{file_hash}')
       if cached:
           print('Cache hit!')
           return json.loads(cached)

       # Perform analysis
       result = perform_analysis(audio_bytes)

       # Cache result (1 hour TTL)
       r.set(f'analysis:{file_hash}', json.dumps(result), ex=3600)
       return result
   ```
3. Test with same file twice, verify second request is instant

**Time:** 1-2 hours

---

## Getting Help

### Documentation

- **This docs site:** Comprehensive guides and reference
- **Inline comments:** TSDoc/JSDoc in source code
- **README files:** Per-service setup instructions

### Team Channels

- **#mixtapelabs-dev:** General development questions
- **#mixtapelabs-bugs:** Bug reports and troubleshooting
- **#mixtapelabs-architecture:** Architecture discussions

### Code Reviews

- Tag `@backend-team` for API/engine changes
- Tag `@audio-team` for DSP/analysis changes
- Tag `@frontend-team` for web app changes

### External Resources

- [LangGraph Docs](https://langchain-ai.github.io/langgraph/) - Workflow orchestration
- [Prisma Docs](https://www.prisma.io/docs) - ORM reference
- [EBU R128 Spec](https://tech.ebu.ch/docs/r/r128.pdf) - Loudness standard
- [OpenAI API Docs](https://platform.openai.com/docs/api-reference) - LLM integration

---

## Next Steps

After completing this reading path:

1. ✅ **Pick a starter task** from GitHub Issues labeled `good-first-issue`
2. ✅ **Join team standup** (daily 10am PT)
3. ✅ **Set up your development environment** (follow [Getting Started](../getting-started.md))
4. ✅ **Review open PRs** to understand code review standards
5. ✅ **Read [Technical Debt](../operations/technical-debt.md)** to understand improvement priorities

Welcome to the team! 🎉
