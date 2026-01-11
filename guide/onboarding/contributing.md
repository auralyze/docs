# Contributing to Mixtapelabs

This guide explains the documentation standards, code review process, and best practices for contributing to Mixtapelabs.

## Documentation Standards

### TSDoc/JSDoc Requirements

All public functions, methods, classes, and interfaces must have complete TSDoc documentation.

#### Module-Level Documentation

Every file should start with a comprehensive module docblock:

```typescript
/**
 * Session management controller for the Mixtapelabs API.
 *
 * Handles HTTP endpoints for creating, retrieving, and managing audio analysis sessions.
 * Orchestrates the workflow engine, manages authentication, and persists results to the database.
 *
 * **Authentication:**
 * All endpoints require JWT authentication via the AuthMiddleware.
 *
 * **Workflow:**
 * POST /sessions triggers the LangGraph workflow engine, which coordinates metadata extraction,
 * audio analysis, and AI feedback generation across microservices.
 *
 * @module controllers/sessionController
 */
```

**Required Sections:**
- Brief description (one line)
- Detailed explanation (2-3 paragraphs)
- Key sections (Authentication, Workflow, Security, etc.)
- `@module` tag with file path

---

#### Function Documentation

All public functions must have complete TSDoc:

```typescript
/**
 * Create a new audio analysis session.
 *
 * Orchestrates the complete workflow: validates input, invokes the engine to fetch metadata,
 * analyze audio, and generate AI feedback, then persists the result to the database.
 *
 * **Workflow Steps:**
 * 1. Validate JWT authentication (middleware)
 * 2. Build engine dependencies (HTTP clients)
 * 3. Run LangGraph workflow (10-60 seconds)
 * 4. Save complete engine state to database
 * 5. Return session data to client
 *
 * **Performance:**
 * - Typical duration: 10-60 seconds (synchronous)
 * - Bottleneck: Audio analysis service (5-30s)
 * - Future: Move to async job queue
 *
 * @param req - Express request with session input (uploadUrl, userContext)
 * @param res - Express response
 *
 * @throws {Error} If workflow fails (service timeout, invalid file, etc.)
 *
 * @example
 * ```typescript
 * // Request
 * POST /api/sessions
 * {
 *   "uploadUrl": "https://cdn.example.com/uploads/mix.wav",
 *   "userContext": {
 *     "daw": "Ableton Live",
 *     "genre": "trap",
 *     "experienceLevel": "intermediate"
 *   }
 * }
 *
 * // Response (201 Created)
 * {
 *   "sessionId": "550e8400-e29b-41d4-a716-446655440000",
 *   "fileInfo": { ... },
 *   "analysis": { ... },
 *   "feedback": { ... }
 * }
 * ```
 */
export async function createSession(req: Request, res: Response): Promise<void> {
  // Implementation
}
```

**Required Elements:**
- Brief description (one line)
- Detailed explanation (what it does, why it matters)
- Optional sections (Workflow, Performance, Security, etc.)
- `@param` for each parameter (with description)
- `@returns` description (include type details)
- `@throws` for errors (when and why)
- `@example` with realistic request/response

---

#### Class Documentation

```typescript
/**
 * Repository for session persistence using Prisma ORM.
 *
 * Provides a database abstraction layer for session CRUD operations. Handles upsert logic
 * for idempotency (workflow retries don't create duplicates) and ensures session ownership
 * via userId checks.
 *
 * **Design Pattern:**
 * Repository pattern - isolates database logic from business logic.
 *
 * **Security:**
 * All queries include userId checks to ensure users can only access their own sessions.
 */
export class SessionRepository {
  /**
   * Initialize repository with Prisma client.
   *
   * @param db - Prisma client instance
   */
  constructor(private readonly db: PrismaClient) {}

  /**
   * Save or update a session in the database.
   *
   * Uses upsert to provide idempotency: If session exists, updates payload.
   * If not, creates new record. This prevents duplicate sessions on workflow retries.
   *
   * @param state - Complete engine state to persist
   * @returns Promise that resolves when save completes
   */
  async save(state: EngineState): Promise<void> {
    // Implementation
  }
}
```

---

#### Interface Documentation

```typescript
/**
 * Client interface for audio metadata extraction.
 *
 * Abstracts the metadata service, allowing multiple implementations (HTTP client, stub client).
 * Used by the engine for dependency injection.
 *
 * @example
 * ```typescript
 * const client: AudioMetadataClient = new HttpAudioMetadataClient(url, apiKey);
 * const metadata = await client.getMetadata({ url: 'https://...' });
 * console.log(metadata.durationSec); // 210.5
 * ```
 */
export interface AudioMetadataClient {
  /**
   * Retrieve technical metadata for an audio file.
   *
   * Calls the metadata service to extract duration, format, sample rate, channels, and bitrate
   * using ffprobe. Typically takes 1-3 seconds (file download + ffprobe execution).
   *
   * @param input - Audio file URL
   * @returns Promise resolving to metadata object
   * @throws {Error} If file not found (404) or ffprobe fails
   */
  getMetadata(input: AudioMetadataInput): Promise<AudioMetadataOutput>;
}
```

---

### Code Examples

**When to Include Examples:**
- Complex algorithms (DSP, crypto, etc.)
- API endpoints (request/response formats)
- Public interfaces (how to use a client)
- Workflow orchestration (node sequences)
- Error handling patterns

**Example Quality:**
```typescript
/**
 * @example
 * ```typescript
 * // Good: Realistic, complete, runnable
 * const client = new HttpAudioMetadataClient(
 *   'http://localhost:3001',
 *   process.env.METADATA_API_KEY!
 * );
 * const metadata = await client.getMetadata({
 *   url: 'https://cdn.example.com/uploads/mix.wav'
 * });
 * console.log(`Duration: ${metadata.durationSec}s`);
 * // Output: Duration: 210.5s
 * ```
 */

/**
 * @example
 * ```typescript
 * // Bad: Incomplete, unclear, not runnable
 * const client = new HttpAudioMetadataClient(...);
 * const metadata = await client.getMetadata(...);
 * ```
 */
```

---

### Documentation Checklist

Before submitting a PR, ensure:

- ✅ Every file has a module-level docblock
- ✅ Every public function/method has TSDoc
- ✅ All parameters have `@param` descriptions
- ✅ Return values have `@returns` descriptions
- ✅ Errors have `@throws` descriptions
- ✅ Complex logic has `@example` blocks
- ✅ Examples are realistic and runnable
- ✅ Code comments explain "why," not "what"
- ✅ No commented-out code (remove or justify)
- ✅ No TODO comments (create GitHub issues instead)

---

## Code Review Process

### Submitting a PR

**1. Create a feature branch:**
```bash
git checkout -b feature/add-session-caching
```

**2. Make your changes:**
- Write code following style guide
- Add tests for new functionality
- Update documentation

**3. Run tests locally:**
```bash
npm test           # Unit tests
npm run lint       # Linting
npm run typecheck  # TypeScript validation
```

**4. Commit with descriptive message:**
```bash
git commit -m "feat(api): Add Redis caching for analysis results

- Cache analysis by file hash (SHA-256)
- 1 hour TTL to balance freshness vs cost
- Saves 5-30s per duplicate file
- Reduces OpenAI API costs

Resolves #123"
```

**5. Push and create PR:**
```bash
git push origin feature/add-session-caching
```

Use the PR template (pre-filled in GitHub).

---

### PR Template

When creating a PR, include:

```markdown
## Description
Brief summary of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing (describe steps)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Code is commented (complex logic)
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass locally
- [ ] No new warnings
```

---

### Review Criteria

Reviewers check for:

**Code Quality:**
- ✅ Follows TypeScript/Python style guide
- ✅ No code smells (long functions, deep nesting, duplication)
- ✅ Clear variable/function names
- ✅ Proper error handling

**Documentation:**
- ✅ TSDoc/JSDoc complete and accurate
- ✅ Code examples for complex logic
- ✅ Inline comments explain "why"
- ✅ README updated if needed

**Testing:**
- ✅ Tests cover new functionality
- ✅ Edge cases tested (empty input, null, errors)
- ✅ Integration tests for API endpoints
- ✅ All tests pass in CI

**Security:**
- ✅ No hardcoded secrets (use environment variables)
- ✅ Input validation for user-provided data
- ✅ SQL injection prevention (Prisma handles this)
- ✅ No XSS vulnerabilities (HttpOnly cookies)

**Performance:**
- ✅ No unnecessary database queries (N+1 problem)
- ✅ Efficient algorithms (avoid O(n²) if possible)
- ✅ No memory leaks (close connections, clear intervals)

---

### Addressing Review Feedback

**1. Read feedback carefully:**
Understand reviewer's concerns and questions.

**2. Respond to each comment:**
- If you agree: "Good catch, fixed in latest commit"
- If you disagree: Explain your reasoning (politely)
- If unclear: Ask for clarification

**3. Make changes:**
```bash
git add .
git commit -m "fix: Address review feedback

- Extract long function into smaller helpers
- Add error handling for edge case
- Update TSDoc examples"

git push origin feature/add-session-caching
```

**4. Re-request review:**
GitHub will notify reviewers automatically.

---

## Code Style Guide

### TypeScript

**Naming Conventions:**
```typescript
// PascalCase for classes, interfaces, types
class SessionRepository { }
interface AudioMetadataClient { }
type EngineState = { };

// camelCase for variables, functions, methods
const sessionId = 'uuid';
function createSession() { }
async getUserById() { }

// UPPER_SNAKE_CASE for constants
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const DEFAULT_SALT_ROUNDS = 10;

// Prefix interfaces with 'I' only if needed for disambiguation
// Prefer: AudioMetadataClient (clear from context)
// Acceptable: IService (if Service class exists)
```

**File Structure:**
```typescript
// 1. Imports (grouped: external, internal, types)
import express from 'express';
import { PrismaClient } from '@prisma/client';

import { SessionRepository } from '../repositories';
import type { EngineState } from '@mixtapelabs/engine';

// 2. Constants
const MAX_SESSIONS_PER_PAGE = 50;

// 3. Types/Interfaces
interface CreateSessionInput {
  uploadUrl: string;
  userContext: UserContext;
}

// 4. Main code (functions, classes, exports)
export async function createSession(req: Request, res: Response) {
  // Implementation
}
```

**Error Handling:**
```typescript
// Good: Specific error messages
if (!session) {
  throw new Error(`Session not found: ${sessionId}`);
}

// Bad: Generic error messages
if (!session) {
  throw new Error('Error');
}

// Good: Try-catch with context
try {
  await sessionRepository.save(state);
} catch (error) {
  console.error('Failed to save session:', { sessionId, error });
  throw error;  // Re-throw after logging
}
```

---

### Python (Analysis Service)

**Naming Conventions:**
```python
# snake_case for everything except classes
session_id = 'uuid'
def analyze_audio():
    pass

# PascalCase for classes
class AudioAnalyzer:
    pass

# UPPER_SNAKE_CASE for constants
MAX_FILE_SIZE = 100 * 1024 * 1024
DEFAULT_SAMPLE_RATE = 44100
```

**Docstrings:**
```python
def analyze_loudness(audio_data: np.ndarray, sample_rate: int) -> dict:
    """
    Analyze loudness using EBU R128 standard.

    Computes integrated LUFS, true peak, and loudness range using pyloudnorm.
    This is the most expensive operation in the analysis pipeline (2-10 seconds).

    Args:
        audio_data: Audio samples as NumPy array (mono or stereo)
        sample_rate: Sample rate in Hz (typically 44100 or 48000)

    Returns:
        Dictionary with 'integratedLUFS', 'truePeak', and 'loudnessRange' keys.

    Raises:
        ValueError: If audio_data is empty or sample_rate is invalid.

    Example:
        >>> audio, sr = librosa.load('mix.wav', sr=44100)
        >>> result = analyze_loudness(audio, sr)
        >>> print(result['integratedLUFS'])
        -12.3
    """
    # Implementation
```

---

## Testing Standards

### Unit Tests

**Coverage Requirements:**
- ✅ All business logic functions (repositories, services)
- ✅ All utility functions (validation, formatting, etc.)
- ✅ Edge cases (empty input, null, invalid data)
- ✅ Error paths (what happens when service fails?)

**Example (Vitest):**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionRepository } from './sessionRepository';

describe('SessionRepository', () => {
  let repository: SessionRepository;

  beforeEach(() => {
    // Setup: Create fresh repository with test DB
    repository = new SessionRepository(testPrismaClient);
  });

  it('should save new session', async () => {
    const state: EngineState = {
      sessionId: 'test-id',
      userId: 'user-id',
      // ... other fields
    };

    await repository.save(state);

    const saved = await repository.findById('test-id');
    expect(saved).toBeDefined();
    expect(saved?.sessionId).toBe('test-id');
  });

  it('should update existing session on duplicate save', async () => {
    // First save
    await repository.save({ sessionId: 'test-id', /* ... */ });

    // Second save (should update, not duplicate)
    await repository.save({ sessionId: 'test-id', feedback: { /* updated */ } });

    const sessions = await repository.findAll();
    expect(sessions).toHaveLength(1);  // Only one session
  });

  it('should throw error if session not found', async () => {
    await expect(repository.findById('nonexistent')).rejects.toThrow('Session not found');
  });
});
```

---

### Integration Tests

**When to Write:**
- API endpoints (full request/response cycle)
- Database operations (real Prisma queries)
- External service calls (HTTP clients)

**Example:**
```typescript
describe('POST /api/sessions', () => {
  it('should create session with valid input', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .set('Cookie', authCookie)
      .send({
        uploadUrl: 'https://example.com/file.wav',
        userContext: { daw: 'Ableton', genre: 'trap', experienceLevel: 'intermediate' }
      });

    expect(response.status).toBe(201);
    expect(response.body.sessionId).toBeDefined();
    expect(response.body.fileInfo).toBeDefined();
  });

  it('should return 401 if not authenticated', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({ uploadUrl: 'https://example.com/file.wav' });

    expect(response.status).toBe(401);
  });
});
```

---

## Git Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests
- `chore`: Updating build tasks, package manager configs, etc.

**Examples:**
```bash
# Feature
git commit -m "feat(api): Add session pagination support

Implements cursor-based pagination for session list endpoint.
Replaces offset pagination (O(n)) with cursor-based (O(log n)).

Resolves #45"

# Bug fix
git commit -m "fix(engine): Handle null analysis results gracefully

Analysis service can return null for silent files.
Now throws descriptive error instead of crashing.

Fixes #78"

# Documentation
git commit -m "docs(readme): Update installation instructions

Add Docker Compose setup steps and troubleshooting section."
```

---

## Pre-Commit Checklist

Before pushing code:

- ✅ Run `npm test` (all tests pass)
- ✅ Run `npm run lint` (no linting errors)
- ✅ Run `npm run typecheck` (no TypeScript errors)
- ✅ Review your own changes (GitHub diff)
- ✅ TSDoc added/updated for new code
- ✅ Tests added for new functionality
- ✅ No `console.log` left in code (use proper logger)
- ✅ No commented-out code (remove or justify)
- ✅ No secrets in commits (check `.env` files)

---

## Questions?

- **Slack:** #mixtapelabs-dev for general questions
- **GitHub:** Comment on issues/PRs for specific discussions
- **Email:** engineering@mixtapelabs.com for sensitive topics

---

## Further Reading

- [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) - Google's TS conventions
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format
- [TSDoc Reference](https://tsdoc.org/) - Official TSDoc documentation
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices) - Comprehensive testing guide
