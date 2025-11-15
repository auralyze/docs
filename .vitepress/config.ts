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
      { text: 'Reference', link: '/guide/session-state' },
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
        text: 'Quality & Ops',
        items: [
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
