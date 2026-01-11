# Communication Patterns

This guide explains how services communicate within the Mixtapelabs platform, covering HTTP client architecture, error handling, and service discovery.

## Service-to-Service Communication

Mixtapelabs uses a **star topology** with synchronous HTTP/JSON communication:

```
                    ┌─────────────┐
                    │  Mixtapelabs   │
                    │     API     │
                    │ (Main API)  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ↓                 ↓                 ↓
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │  Metadata   │   │  Analysis   │   │  Feedback   │
  │   Service   │   │   Service   │   │   Service   │
  └─────────────┘   └─────────────┘   └─────────────┘
```

**Characteristics:**
- **Synchronous:** HTTP request/response (REST-style)
- **Centralized:** Main API orchestrates; services don't talk to each other
- **Stateless:** Services don't maintain session state between requests
- **Authenticated:** API key (`x-api-key` header) for each request

## HTTP Client Architecture

### Interface Contracts

The engine defines abstract interfaces for each service client:

```typescript
/**
 * Client for fetching audio file metadata.
 */
export interface AudioMetadataClient {
  /**
   * Retrieve technical metadata for an audio file.
   *
   * @param input - Audio file URL
   * @returns Metadata including duration, format, sample rate, etc.
   */
  getMetadata(input: AudioMetadataInput): Promise<AudioMetadataOutput>;
}

/**
 * Client for performing DSP analysis on audio files.
 */
export interface AudioAnalysisClient {
  /**
   * Analyze audio file for loudness, dynamics, spectrum, and stereo imaging.
   *
   * @param input - Audio file URL
   * @returns Analysis results with loudness, dynamics, spectrum, stereo metrics
   */
  analyze(input: AudioAnalysisInput): Promise<AudioAnalysisOutput>;
}

/**
 * Client for generating AI-powered mix feedback.
 */
export interface FeedbackClient {
  /**
   * Generate feedback based on complete engine state.
   *
   * @param state - Current engine state (includes analysis, context, etc.)
   * @returns Feedback text and actionable suggestions
   */
  generateFeedback(state: EngineState): Promise<FeedbackResult>;
}
```

### HTTP Implementation

The main API provides HTTP-based implementations:

```typescript
export class HttpAudioMetadataClient implements AudioMetadataClient {
  constructor(
    private readonly serviceUrl: string,
    private readonly apiKey: string
  ) {}

  async getMetadata(input: AudioMetadataInput): Promise<AudioMetadataOutput> {
    const response = await fetch(`${this.serviceUrl}/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Metadata service responded with ${response.status}: ${errorText || response.statusText}`
      );
    }

    return response.json();
  }
}
```

**Key Features:**
- Fetch API for HTTP requests (native, no dependencies)
- `x-api-key` header for authentication
- JSON request and response bodies
- Error propagation via thrown `Error` objects

### Stub Implementation

For testing and development, stub clients return hardcoded realistic data:

```typescript
export class StubAudioMetadataClient implements AudioMetadataClient {
  async getMetadata(input: AudioMetadataInput): Promise<AudioMetadataOutput> {
    // Instant response, no network call
    return {
      durationSec: 210,
      format: 'wav',
      sampleRate: 48000,
      channels: 2,
      bitrate: 1536000
    };
  }
}
```

**Benefits:**
- **Fast:** No network latency or service dependencies
- **Deterministic:** Same input always returns same output
- **Portable:** Run engine without deploying microservices
- **Testing:** Unit tests don't require running servers

**Activation:**
```bash
USE_STUB_CLIENTS=true npm start
```

## Dependency Injection

The engine uses a **factory pattern** to select client implementations based on environment:

```typescript
/**
 * Build engine dependencies from environment configuration.
 *
 * Supports multiple implementations:
 * - HTTP clients (production)
 * - Stub clients (testing/development)
 * - Direct OpenAI client (bypass feedback service)
 *
 * @returns Configured engine dependencies
 * @throws Error if required environment variables are missing
 */
export function buildEngineDeps(): MixtapelabsEngineDeps {
  const useStubs = process.env.USE_STUB_CLIENTS === 'true';

  if (useStubs) {
    return {
      audioMetadataClient: new StubAudioMetadataClient(),
      audioAnalysisClient: new StubAudioAnalysisClient(),
      feedbackClient: new StubFeedbackClient()
    };
  }

  // Production: HTTP clients
  const metadataUrl = process.env.METADATA_SERVICE_URL;
  const metadataApiKey = process.env.METADATA_API_KEY;

  if (!metadataUrl || !metadataApiKey) {
    throw new Error('Missing metadata service configuration');
  }

  return {
    audioMetadataClient: new HttpAudioMetadataClient(metadataUrl, metadataApiKey),
    audioAnalysisClient: new HttpAudioAnalysisClient(analysisUrl, analysisApiKey),
    feedbackClient: new HttpFeedbackClient(feedbackUrl, feedbackApiKey)
  };
}
```

**Benefits:**
- **Environment-driven:** Single codebase, multiple configurations
- **Testability:** Swap real services with stubs
- **Flexibility:** Mix implementations (e.g., stub metadata + real analysis)
- **Fail-fast:** Throws error immediately if config missing

## Error Handling Strategy

### Service Error Propagation

When a service returns an error, the HTTP client converts it to a thrown `Error`:

```typescript
if (!response.ok) {
  const errorText = await response.text().catch(() => '');
  throw new Error(
    `Analysis service responded with ${response.status}: ${errorText || response.statusText}`
  );
}
```

**Error Flow:**
1. Service returns 4xx/5xx status code
2. Client throws `Error` with status code and message
3. LangGraph workflow catches error and terminates
4. API returns 500 to client with error message

### Workflow-Level Error Handling

The API's session controller wraps workflow execution in try/catch:

```typescript
try {
  const deps = buildEngineDeps();
  const engineState = await runMixtapelabsSession(input, deps);

  await sessionRepository.save(engineState);
  res.status(201).json({ sessionId: engineState.sessionId, ...engineState });
} catch (error) {
  console.error('Workflow failed:', error);
  res.status(500).json({
    error: 'Session analysis failed',
    message: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

**Error Categories:**

| Error Type               | Cause                                   | HTTP Status | Recovery                       |
| ------------------------ | --------------------------------------- | ----------- | ------------------------------ |
| **Validation Error**     | Invalid input (bad URL, missing fields) | 400         | Fix input, retry               |
| **Authentication Error** | Missing/invalid API key                 | 401         | Check API key config           |
| **Service Unavailable**  | Metadata/analysis service down          | 503         | Retry after delay              |
| **Timeout**              | Service took too long (>60s)            | 504         | Increase timeout, investigate  |
| **Internal Error**       | Unexpected exception in service         | 500         | Check service logs, report bug |

::: tip Error Context
Always include the service name and status code in error messages. This helps debugging when services are distributed across containers/hosts. Example: `"Analysis service responded with 504: Gateway Timeout"` is much better than `"Service failed"`.
:::

## Service Discovery

### Static Configuration

Service URLs are configured via environment variables (no dynamic discovery):

```bash
# Main API .env
METADATA_SERVICE_URL=http://localhost:3001
METADATA_API_KEY=xK8mP3vR9nQ2wZ7jY5tL1fD4hG6sA0uB

ANALYSIS_SERVICE_URL=http://localhost:3002
ANALYSIS_API_KEY=mN7pQ4wR8xZ3yL6jV9sA2hK5nC1vB0dF

FEEDBACK_SERVICE_URL=http://localhost:3003
FEEDBACK_API_KEY=tY2uL9mP6xK3wZ7jV4sR1qN8hG5fD0cB
```

**Production (Docker Compose):**
```bash
# Service names resolve via Docker DNS
METADATA_SERVICE_URL=http://metadata:3001
ANALYSIS_SERVICE_URL=http://analysis:3002
FEEDBACK_SERVICE_URL=http://feedback:3003
```

**Benefits:**
- **Simple:** No service registry, no health checks
- **Predictable:** URLs don't change at runtime
- **Debuggable:** Easy to see where requests go

**Limitations:**
- **Static:** Requires restart to change URLs
- **No Load Balancing:** Single endpoint per service
- **No Failover:** If service down, requests fail

::: warning Production Considerations
For production, consider:
- **Load Balancer:** Distribute load across multiple service instances
- **Service Mesh:** Consul, Linkerd for dynamic discovery + health checks
- **API Gateway:** Kong, Traefik for centralized routing + rate limiting
:::

## Request/Response Formats

### Metadata Service

**Request:**
```json
POST /metadata
Content-Type: application/json
x-api-key: <key>

{
  "url": "https://cdn.example.com/uploads/mix.wav"
}
```

**Response (Success):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "durationSec": 210.5,
  "format": "wav",
  "sampleRate": 48000,
  "channels": 2,
  "bitrate": 1536000
}
```

**Response (Error):**
```json
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "File not found",
  "url": "https://cdn.example.com/uploads/mix.wav"
}
```

### Analysis Service

**Request:**
```json
POST /analyze
Content-Type: application/json
x-api-key: <key>

{
  "url": "https://cdn.example.com/uploads/mix.wav"
}
```

**Response (Success):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "loudness": {
    "integratedLUFS": -12.3,
    "truePeak": -1.2,
    "loudnessRange": 7.8
  },
  "dynamics": {
    "crestFactor": 9.5
  },
  "spectrum": {
    "low": -6.2,
    "mids": -3.1,
    "highs": -4.5
  },
  "stereo": {
    "widthScore": 0.71
  }
}
```

### Feedback Service

**Request:**
```json
POST /feedback
Content-Type: application/json
x-api-key: <key>

{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "uploadUrl": "https://...",
  "fileInfo": { ... },
  "analysis": { ... },
  "userContext": {
    "daw": "Ableton Live",
    "genre": "trap",
    "experienceLevel": "intermediate"
  }
}
```

**Response (Success):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "feedbackText": "Your mix has solid momentum and energy, but...",
  "suggestions": [
    "Tighten the low-mids around 250Hz in the bass buss",
    "Ease back the limiter ceiling by ~0.5 dB to reduce distortion",
    "Automate the vocal air EQ for added presence in choruses"
  ]
}
```

## Performance Characteristics

### Latency Breakdown

| Service            | Typical Latency | Bottleneck                                 |
| ------------------ | --------------- | ------------------------------------------ |
| **Metadata**       | 1-3 seconds     | File download + ffprobe execution          |
| **Analysis**       | 5-30 seconds    | DSP processing (scales with file duration) |
| **Feedback**       | 3-10 seconds    | OpenAI API latency                         |
| **Total Workflow** | 10-60 seconds   | Sum of all services (synchronous)          |

### Optimization Opportunities

**1. Parallel Service Calls:**
Metadata and analysis don't depend on each other (both just need the file URL). They could run in parallel:

```typescript
// Sequential (current): 1-3s + 5-30s = 6-33s
const fileInfo = await deps.audioMetadataClient.getMetadata(input);
const analysis = await deps.audioAnalysisClient.analyze(input);

// Parallel: max(1-3s, 5-30s) = 5-30s (saves 1-3s)
const [fileInfo, analysis] = await Promise.all([
  deps.audioMetadataClient.getMetadata(input),
  deps.audioAnalysisClient.analyze(input)
]);
```

**2. File Caching:**
Services currently re-download the audio file independently. A shared cache (Redis, S3) could eliminate redundant downloads:

```typescript
// Cache file on first download
const fileBuffer = await downloadAndCache(url);

// Subsequent services read from cache
const cachedFile = await getFromCache(url);
```

**3. Result Caching:**
Identical audio files produce identical analysis results. Cache by content hash (SHA-256):

```typescript
const fileHash = await computeHash(audioFile);
const cachedAnalysis = await redis.get(`analysis:${fileHash}`);

if (cachedAnalysis) {
  return cachedAnalysis; // Instant response
}

// Otherwise, perform analysis and cache result
const analysis = await performAnalysis(audioFile);
await redis.set(`analysis:${fileHash}`, analysis, 'EX', 3600); // 1 hour TTL
```

**4. Async Job Queue:**
Instead of blocking HTTP requests, enqueue workflow as background job:

```typescript
// API endpoint: Enqueue job, return immediately
app.post('/sessions', async (req, res) => {
  const jobId = await queue.add('analyze-session', req.body);
  res.status(202).json({ jobId, status: 'pending' });
});

// Worker: Process job asynchronously
queue.process('analyze-session', async (job) => {
  const engineState = await runMixtapelabsSession(job.data, deps);
  await sessionRepository.save(engineState);
});

// Client: Poll for results
app.get('/sessions/:jobId', async (req, res) => {
  const job = await queue.getJob(req.params.jobId);
  if (job.isCompleted) {
    res.json({ status: 'completed', result: job.returnvalue });
  } else {
    res.json({ status: 'pending' });
  }
});
```

::: tip Async Jobs for Long Workflows
Synchronous workflows block HTTP threads and degrade user experience. For workflows >5 seconds, consider async job queues (Bull, BullMQ) with WebSocket or polling for status updates.
:::

## Retry Strategies

### Exponential Backoff

For transient failures (network issues, temporary service overload), retry with exponential backoff:

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: After 1 second
- Attempt 3: After 2 seconds
- Attempt 4: After 4 seconds

### Circuit Breaker

Prevent cascading failures by "opening the circuit" after repeated failures:

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;         // Open after 5 failures
  private readonly resetTimeout = 60000;  // Reset after 60 seconds

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failureCount >= this.threshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.resetTimeout) {
        return true; // Circuit is open
      }
      this.reset(); // Reset timeout elapsed
    }
    return false;
  }

  private onSuccess() {
    this.failureCount = 0;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  private reset() {
    this.failureCount = 0;
  }
}
```

**States:**
- **Closed:** Normal operation (requests go through)
- **Open:** Service unavailable (fast-fail, no requests)
- **Half-Open:** Testing recovery (allow one request)

## Further Reading

- [Microservices Patterns](https://microservices.io/patterns/index.html) - Architecture patterns catalog
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html) - Martin Fowler's explanation
- [Exponential Backoff](https://cloud.google.com/iot/docs/how-tos/exponential-backoff) - Google Cloud guide
- [REST API Best Practices](https://restfulapi.net/) - RESTful design principles
