import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Auralyze Engine',
  description: 'LangGraph workflow engine powering AI-assisted mix feedback',
  srcDir: '.',
  lang: 'en-US',
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/guide/architecture/system-overview' },
      { text: 'API Reference', link: '/guide/api-reference' },
      { text: 'Operations', link: '/guide/operations/performance-characteristics' },
    ],
    sidebar: [
      {
        text: 'Onboarding',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Reading Path', link: '/guide/onboarding/reading-path' },
          { text: 'Dev Playground', link: '/guide/dev-playground' },
          { text: 'Contributing', link: '/guide/onboarding/contributing' },
        ],
      },
      {
        text: 'Domain Knowledge',
        items: [
          { text: 'Audio Fundamentals', link: '/guide/domain/audio-fundamentals' },
          { text: 'Security Model', link: '/guide/domain/security-model' },
          { text: 'Database Patterns', link: '/guide/domain/database-patterns' },
          { text: 'Communication Patterns', link: '/guide/domain/communication-patterns' },
        ],
      },
      {
        text: 'System Architecture',
        items: [
          { text: 'System Overview', link: '/guide/architecture/system-overview' },
          { text: 'Session Lifecycle', link: '/guide/architecture/session-lifecycle' },
          { text: 'Design Decisions', link: '/guide/architecture/design-decisions' },
        ],
      },
      {
        text: 'Engine Architecture',
        items: [
          { text: 'Session State & Schemas', link: '/guide/session-state' },
          { text: 'LangGraph Workflow', link: '/guide/langgraph' },
          { text: 'Dependency Injection & Clients', link: '/guide/clients' },
          { text: 'Prompting & Feedback', link: '/guide/prompting' },
        ],
      },
      {
        text: 'Platform Services',
        items: [
          { text: 'Microservices Overview', link: '/guide/microservices-overview' },
          { text: 'Audio Metadata Service', link: '/guide/audio-metadata-service' },
          { text: 'Audio Analysis Service', link: '/guide/audio-analysis-service' },
          { text: 'Audio Feedback Service', link: '/guide/audio-feedback-service' },
        ],
      },
      {
        text: 'Performance & Operations',
        items: [
          { text: 'Performance Characteristics', link: '/guide/operations/performance-characteristics' },
          { text: 'Technical Debt', link: '/guide/operations/technical-debt' },
        ],
      },
      {
        text: 'API & Development',
        items: [
          { text: 'API Reference', link: '/guide/api-reference' },
          { text: 'Testing Strategy', link: '/guide/testing' },
          { text: 'AI Collaboration Guidelines', link: '/guide/ai-guidelines' },
          { text: 'Releasing & CI/CD', link: '/guide/releasing' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/auralyze/engine' },
    ],
    editLink: {
      pattern: 'https://github.com/auralyze/engine/edit/main/docs/:path',
      text: 'Suggest changes to this page',
    },
  },
});
