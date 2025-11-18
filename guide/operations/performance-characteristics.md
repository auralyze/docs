# Performance Characteristics

This guide documents the performance profile of Auralyze, including timing breakdowns, bottlenecks, and optimization strategies.

## Workflow Timing Breakdown

### Total Duration: 10-60 seconds (typical)

The complete session workflow consists of several phases, each with distinct performance characteristics:

| Phase                    | Duration          | Variability | Bottleneck                            |
| ------------------------ | ----------------- | ----------- | ------------------------------------- |
| **Metadata Extraction**  | 1-3 seconds       | Low         | File download + ffprobe               |
| **Audio Analysis**       | 5-30 seconds      | High        | DSP processing (scales with duration) |
| **Feedback Generation**  | 3-10 seconds      | Medium      | OpenAI API latency                    |
| **Database Persistence** | 10-50ms           | Low         | Write to PostgreSQL                   |
| **Total (Sequential)**   | **10-60 seconds** | High        | Analysis service                      |

### Phase 1: Metadata Extraction (1-3 seconds)

**Components:**
```
File Download (500ms - 2s)
    ↓
ffprobe Execution (100ms - 500ms)
    ↓
JSON Parsing (<100ms)
```

**Breakdown:**
- **File Download:** 0.5-2 seconds
  - Depends on file size (10MB = ~1s at 10MB/s)
  - Network latency to CDN
  - Can be cached if same URL requested multiple times
- **ffprobe Execution:** 0.1-0.5 seconds
  - Very fast (reads file headers, not entire file)
  - Scales sub-linearly with file size (header parsing only)
- **JSON Parsing + Response:** <0.1 seconds

**Optimization Opportunities:**
- ✅ Cache metadata by URL (Redis, 1 hour TTL)
- ✅ Use streaming download (don't buffer entire file)
- ✅ CDN optimization (choose closest region)

### Phase 2: Audio Analysis (5-30 seconds)

**Components:**
```
File Download (500ms - 2s)
    ↓
Audio Loading (1-3s)
    ↓
Resampling (1-5s, if needed)
    ↓
Loudness Metering (2-10s)
    ↓
Dynamics Analysis (500ms - 2s)
    ↓
Spectrum Analysis (1-5s)
    ↓
Stereo Imaging (500ms - 2s)
```

**Breakdown:**
- **File Download:** 0.5-2 seconds (same as metadata)
- **Audio Loading (librosa):** 1-3 seconds
  - Loads entire file into memory
  - Decodes to raw PCM samples
  - Scales linearly with file duration
- **Resampling (if needed):** 1-5 seconds
  - Required if sample rate ≠ 44.1kHz
  - Computationally expensive (resampling quality affects time)
- **Loudness Metering (pyloudnorm):** 2-10 seconds
  - Most expensive operation (full file analysis)
  - Implements EBU R128 standard (K-weighting + integration)
  - Scales linearly with file duration
- **Dynamics Analysis:** 0.5-2 seconds
  - Peak detection + RMS calculation
  - Sliding window (300-400ms)
  - Scales linearly with duration
- **Spectrum Analysis (FFT):** 1-5 seconds
  - FFT over 300ms windows
  - Per-band energy calculation (low, mid, high)
  - Scales linearly with duration
- **Stereo Imaging:** 0.5-2 seconds
  - Mid/side energy calculation
  - Correlation coefficient
  - Scales linearly with duration

**Performance Scaling:**
| File Duration | Expected Time | Dominant Factor |
| ------------- | ------------- | --------------- |
| 1 minute      | ~5 seconds    | Loudness + FFT  |
| 3 minutes     | ~10 seconds   | Loudness + FFT  |
| 5 minutes     | ~15 seconds   | Loudness + FFT  |
| 10 minutes    | ~30 seconds   | Loudness + FFT  |

**Optimization Opportunities:**
- ✅ Parallel processing (loudness + dynamics + spectrum in separate threads)
- ✅ Result caching (hash file content, cache for 1 hour)
- ✅ Skip resampling if already 44.1kHz
- ✅ Optimize FFT window size (trade resolution for speed)
- ✅ Use C++ implementations (essentia) instead of pure Python

### Phase 3: Feedback Generation (3-10 seconds)

**Components:**
```
Prompt Construction (<100ms)
    ↓
OpenAI API Call (3-10s)
    ↓
Response Parsing (<100ms)
```

**Breakdown:**
- **Prompt Construction:** <0.1 seconds
  - Template rendering with analysis data
  - JSON serialization
  - Very fast (no computation)
- **OpenAI API Call:** 3-10 seconds
  - Network latency (round-trip to OpenAI)
  - Model inference time (GPT-4 processes request)
  - Queueing time (if API is busy)
  - **Highly variable** (can be 3s or 20s depending on load)
- **Response Parsing:** <0.1 seconds
  - JSON deserialization
  - Structured output extraction

**Factors Affecting Latency:**
- **Prompt length:** Longer prompts take longer to process
- **Response length:** Longer responses take longer to generate
- **API load:** Higher load = longer queue times
- **Model version:** GPT-4-turbo is faster than GPT-4

**Optimization Opportunities:**
- ✅ Use GPT-4-turbo (faster inference)
- ✅ Reduce prompt length (only include relevant data)
- ✅ Stream responses (start displaying text as it arrives)
- ✅ Cache similar prompts (unlikely to be identical)
- ⚠️ Use GPT-3.5 (much faster but lower quality)

### Phase 4: Database Persistence (10-50ms)

**Components:**
```
JSON Serialization (<10ms)
    ↓
Prisma Query (10-30ms)
    ↓
PostgreSQL Write (10-20ms)
```

**Breakdown:**
- **JSON Serialization:** <10ms
  - `JSON.stringify(engineState)` is very fast
  - State is small (~5-10KB)
- **Prisma Query:** 10-30ms
  - Query construction
  - Connection pool checkout
- **PostgreSQL Write:** 10-20ms
  - Upsert operation (INSERT or UPDATE)
  - Index updates (primary key + userId + createdAt)

**Optimization Opportunities:**
- ✅ Already optimized (upsert is atomic)
- ✅ Connection pooling (reuse connections)
- ⚠️ Batch writes (not applicable for single session)

## Bottleneck Analysis

### Primary Bottleneck: Analysis Service (5-30 seconds)

**Why it's slow:**
- CPU-intensive DSP operations (FFT, filtering, integration)
- Python single-threaded execution (GIL limits parallelism)
- File loading + decoding (I/O bound)
- Scales linearly with file duration

**Impact:**
- Dominates total workflow time (~50-80% of total)
- User perceived latency (long wait for results)
- Resource utilization (CPU-bound, blocks worker)

**Mitigation Strategies:**

**1. Parallel Processing (Within Service):**
```python
# Current: Sequential
loudness = analyze_loudness(audio)
dynamics = analyze_dynamics(audio)
spectrum = analyze_spectrum(audio)

# Optimized: Parallel (multiprocessing)
with Pool(4) as pool:
    results = pool.starmap(analyze, [
        ('loudness', audio),
        ('dynamics', audio),
        ('spectrum', audio),
        ('stereo', audio)
    ])
```
**Savings:** 30-50% reduction (4 cores → 2-3x speedup)

**2. Result Caching:**
```python
file_hash = hashlib.sha256(audio_bytes).hexdigest()
cached = redis.get(f'analysis:{file_hash}')
if cached:
    return cached  # Instant response

result = perform_analysis(audio)
redis.set(f'analysis:{file_hash}', result, ex=3600)  # 1 hour TTL
```
**Savings:** 100% for duplicate files (5-30s → instant)

**3. Optimize Libraries:**
- Replace pure Python with C++ (essentia for FFT)
- Use optimized BLAS/LAPACK (NumPy compiled with MKL)
- Profile and optimize hot paths (cProfile, line_profiler)

**4. Incremental Analysis:**
- Stream file in chunks (don't load entire file)
- Compute metrics incrementally (update as chunks arrive)
- Return partial results early (loudness before spectrum)

### Secondary Bottleneck: OpenAI API (3-10 seconds)

**Why it's slow:**
- External API (network latency + queueing)
- Model inference (GPT-4 is compute-intensive)
- Unpredictable (latency spikes during high load)

**Mitigation Strategies:**

**1. Response Streaming:**
```typescript
const stream = await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [...],
  stream: true  // Stream tokens as they arrive
});

for await (const chunk of stream) {
  // Send partial response to client (WebSocket)
}
```
**Benefits:** Perceived latency reduced (users see text immediately)

**2. Prompt Optimization:**
- Reduce prompt length (remove unnecessary context)
- Use bullet points instead of paragraphs
- Truncate analysis data to 2 decimal places

**3. Model Selection:**
- GPT-4-turbo (2-5s) vs GPT-4 (5-10s)
- GPT-3.5-turbo (1-3s) for less critical feedback

### Tertiary Bottleneck: Metadata Service (1-3 seconds)

**Why it's slow:**
- File download from CDN (network I/O)
- ffprobe execution (subprocess overhead)

**Mitigation Strategies:**

**1. Parallel Execution:**
Metadata and analysis both only need the file URL. Run in parallel:

```typescript
// Sequential: 1-3s + 5-30s = 6-33s
const metadata = await metadataClient.getMetadata(input);
const analysis = await analysisClient.analyze(input);

// Parallel: max(1-3s, 5-30s) = 5-30s
const [metadata, analysis] = await Promise.all([
  metadataClient.getMetadata(input),
  analysisClient.analyze(input)
]);
```
**Savings:** 1-3 seconds (metadata hidden during analysis)

**2. Metadata Caching:**
```typescript
const cached = await redis.get(`metadata:${url}`);
if (cached) return JSON.parse(cached);

const metadata = await fetchMetadata(url);
await redis.set(`metadata:${url}`, JSON.stringify(metadata), 'EX', 3600);
```
**Savings:** 100% for repeated URLs (1-3s → instant)

## Database Performance

### Query Performance

**Fast Queries (Indexed):**
```typescript
// O(log n) - uses unique index
prisma.user.findUnique({ where: { email } })

// O(1) - uses primary key
prisma.user.findUnique({ where: { id } })

// O(log n) - uses non-unique index
prisma.session.findMany({ where: { userId } })
```

**Slow Queries (Unindexed):**
```typescript
// O(n) - full table scan (no firstName index)
prisma.user.findMany({ where: { firstName: 'John' } })

// O(n) - JSON field query (no partial index)
prisma.session.findMany({
  where: { payload: { path: ['analysis', 'loudness'], gt: -10 } }
})

// O(n) - offset pagination (scans `skip` rows)
prisma.session.findMany({ skip: 1000, take: 50 })
```

### Connection Pooling

**Current Configuration:**
```
DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=10"
```

**Connection Pool Sizing:**
| Environment                      | Pool Size          | Rationale                         |
| -------------------------------- | ------------------ | --------------------------------- |
| **Development**                  | 5-10               | Single developer, low concurrency |
| **Production (Single Instance)** | 20-50              | Formula: `(worker_count × 2) + 1` |
| **Production (3 Instances)**     | 15 each (45 total) | Stay under PostgreSQL limit (100) |

**Best Practices:**
- Monitor active connections (`pg_stat_activity`)
- Use PgBouncer for connection multiplexing (1000s of clients → 100 connections)
- Set `pool_timeout` to fail fast (default 10s)

### Query Optimization Recommendations

**1. Cursor-Based Pagination:**
Replace offset pagination with cursor-based:

```typescript
// Before: O(n) skip operation
findMany({ where: { userId }, skip: 100, take: 50 })

// After: O(log n) keyset lookup
findMany({
  where: { userId },
  cursor: { id: lastSeenId },
  take: 50,
  skip: 1  // Skip the cursor itself
})
```

**2. Partial Indexes:**
For frequently queried fields in JSON:

```sql
-- Extract LUFS to dedicated column
ALTER TABLE "Session" ADD COLUMN "integratedLUFS" DOUBLE PRECISION;

-- Create index
CREATE INDEX "idx_sessions_lufs" ON "Session"("integratedLUFS");

-- Update existing rows
UPDATE "Session" SET "integratedLUFS" = (payload->'analysis'->'loudness'->>'integratedLUFS')::DOUBLE PRECISION;
```

**3. Read Replicas:**
Separate read and write traffic:

```typescript
// Write to primary
await prisma.$transaction([
  prisma.session.create({ data: { ... } })
]);

// Read from replica (Prisma 5.0+)
const sessions = await prisma.session.findMany({
  // Uses read replica automatically
});
```

## Horizontal Scaling

### Current Architecture (Single Instances)

```
Load Balancer
    ↓
API (1 instance)
    ↓
├── Metadata Service (1 instance)
├── Analysis Service (1 instance)
└── Feedback Service (1 instance)
```

**Bottlenecks:**
- API is single point of failure
- Analysis service cannot handle concurrent requests
- Database is single point of failure

### Scaled Architecture (Multiple Instances)

```
Load Balancer (ALB)
    ↓
API (3 instances, round-robin)
    ↓
├── Metadata Service (2 instances)
├── Analysis Service (5 instances)  ← Most scaled (CPU-intensive)
└── Feedback Service (2 instances)
    ↓
PostgreSQL Primary + 2 Read Replicas
Redis Cluster (3 nodes)
```

**Scaling Strategy:**
1. **API:** 3 instances (handles auth, orchestration)
2. **Metadata:** 2 instances (I/O-bound, not CPU-intensive)
3. **Analysis:** 5 instances (CPU-bound, biggest bottleneck)
4. **Feedback:** 2 instances (OpenAI is bottleneck, not service)
5. **Database:** Primary + 2 read replicas (95% reads, 5% writes)
6. **Redis:** 3-node cluster (caching + job queue)

## Async Job Queue (Future Optimization)

### Problem: Long-Running Workflows Block HTTP Threads

Current synchronous workflow:

```typescript
app.post('/sessions', async (req, res) => {
  const engineState = await runAuralyzeSession(input, deps);  // 10-60s
  await sessionRepository.save(engineState);
  res.status(201).json(engineState);
});
```

**Issues:**
- HTTP request blocked for 10-60 seconds
- Poor user experience (loading spinner)
- Thread exhaustion under load (100 concurrent = 100 threads blocked)

### Solution: Background Job Processing

**Architecture:**
```
Client                API              Redis Queue           Worker
  │                    │                    │                  │
  ├──POST /sessions──→ │                    │                  │
  │                    ├──enqueue job──────→│                  │
  │ ←──202 Accepted──  │                    │                  │
  │   {jobId}          │                    │                  │
  │                    │                    │ ←──pop job───────│
  │                    │                    │                  ├─workflow─→
  │                    │                    │ ←──job done──────│
  │                    │                    │                  │
  ├──GET /jobs/:id───→ │                    │                  │
  │ ←──200 OK─────────  │                    │                  │
  │   {status: done}   │                    │                  │
```

**Implementation (Bull/BullMQ):**

**API:**
```typescript
app.post('/sessions', async (req, res) => {
  const job = await queue.add('analyze-session', req.body);
  res.status(202).json({
    jobId: job.id,
    status: 'pending',
    pollUrl: `/jobs/${job.id}`
  });
});

app.get('/jobs/:id', async (req, res) => {
  const job = await queue.getJob(req.params.id);

  if (await job.isCompleted()) {
    const result = await job.returnvalue;
    res.json({ status: 'completed', result });
  } else if (await job.isFailed()) {
    res.json({ status: 'failed', error: job.failedReason });
  } else {
    res.json({ status: 'pending' });
  }
});
```

**Worker:**
```typescript
queue.process('analyze-session', async (job) => {
  const engineState = await runAuralyzeSession(job.data, deps);
  await sessionRepository.save(engineState);
  return engineState;  // Returned to job.returnvalue
});
```

**Benefits:**
- ✅ Fast API response (<100ms)
- ✅ Better UX (show progress, not loading spinner)
- ✅ Resilience (automatic retries on failure)
- ✅ Scalability (multiple workers, horizontal scaling)
- ✅ Monitoring (job queue metrics, failure tracking)

## Performance Monitoring (Planned)

### Metrics to Track

**Application Metrics:**
- Request latency (p50, p95, p99)
- Workflow duration by phase
- API throughput (requests/second)
- Error rate (4xx, 5xx)

**Service Metrics:**
- Metadata service latency
- Analysis service latency
- Feedback service latency
- Service availability (uptime %)

**Database Metrics:**
- Query latency (p50, p95, p99)
- Connection pool utilization
- Slow queries (>100ms)
- Lock contention

**Infrastructure Metrics:**
- CPU utilization (%)
- Memory usage (MB)
- Disk I/O (MB/s)
- Network I/O (MB/s)

### Observability Stack (Recommended)

**Logging:**
- Winston/Pino for structured JSON logs
- ELK Stack (Elasticsearch + Logstash + Kibana) or Datadog for aggregation
- Request ID propagation across services

**Metrics:**
- Prometheus for metrics collection
- Grafana for visualization
- Custom dashboards (workflow timing, error rates)

**Tracing:**
- OpenTelemetry for distributed tracing
- Jaeger for trace visualization
- Trace requests across all services

**Alerting:**
- PagerDuty for on-call alerting
- Alert on: p95 latency >60s, error rate >5%, service down

## Performance Testing

### Load Testing Recommendations

**Tools:**
- **Artillery:** HTTP load testing, realistic workflows
- **k6:** Programmable load testing, JavaScript-based
- **Locust:** Python-based, distributed load testing

**Test Scenarios:**

**1. Sustained Load:**
- 10 requests/second for 10 minutes
- Measures: Steady-state performance, memory leaks

**2. Spike Test:**
- 1 req/s → 100 req/s for 2 minutes → 1 req/s
- Measures: Scaling behavior, recovery time

**3. Stress Test:**
- Increase load until service fails
- Measures: Breaking point, error modes

**Example (Artillery):**
```yaml
config:
  target: 'https://api.auralyze.com'
  phases:
    - duration: 300
      arrivalRate: 10  # 10 req/s for 5 min

scenarios:
  - name: Create Session
    flow:
      - post:
          url: '/sessions'
          json:
            uploadUrl: 'https://...'
            userContext: { ... }
```

## Further Reading

- [Technical Debt](./technical-debt.md) - Known issues and future work
- [Session Lifecycle](../architecture/session-lifecycle.md) - Detailed timing breakdown
- [Database Patterns](../domain/database-patterns.md) - Query optimization strategies
- [Communication Patterns](../domain/communication-patterns.md) - Service communication overhead
