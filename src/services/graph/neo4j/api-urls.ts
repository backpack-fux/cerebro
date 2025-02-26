// services/graph/api-urls.ts
export const API_URLS = {
    meta: '/api/graph/meta',
    milestone: '/api/graph/milestone',
    feature: '/api/graph/feature',
    team: '/api/graph/team',
    teamMember: '/api/graph/team-member',
    provider: '/api/graph/provider',
    option: '/api/graph/option',
    calendar: '/api/graph/calendar',
    code: '/api/graph/code',
    notes: '/api/graph/notes',
  } as const;
  
  export type NodeType = keyof typeof API_URLS;