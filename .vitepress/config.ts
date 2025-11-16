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
      { text: 'API Reference', link: '/guide/api-reference' },
      { text: 'CI & Release', link: '/guide/releasing' },
    ],
    sidebar: [
      {
        text: 'Onboarding',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Dev Playground', link: '/guide/dev-playground' },
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
        text: 'API & Ops',
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
