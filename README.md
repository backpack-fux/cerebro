# Cerebro - Workflow Management System

A modern workflow management system built with Next.js that helps teams visualize and interact with workflows. Cerebro is a lightweight client for Synapso, a robust workflow orchestration backend.

## Features

- **Node-Based Architecture**: Flexible system for managing different types of nodes (Workflow, Logic, etc.)
- **Real-time Updates**: Automatic synchronization of data across connected nodes
- **Offline Support**: Continue working even when disconnected from the backend
- **Visual Interface**: Interactive graph visualization with three-panel layout
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Agent Integration**: Interact with workflow nodes through the chat interface

## Synapso Integration

Cerebro has been refactored to work as a lightweight client for Synapso, a powerful workflow orchestration system that handles:

- Workflow execution and state management
- Node and edge persistence
- Real-time event dispatching
- Agent orchestration
- Memory and persistence services

This integration allows Cerebro to focus on providing an excellent user experience while delegating complex state management and business logic to Synapso.

## Getting Started

### Prerequisites

- Bun 1.0+ (recommended)
- Docker and Docker Compose for running Synapso backend (optional)
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/cerebro.git
cd cerebro
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```
Edit `.env.local` to add your Synapso API key and configure any other necessary settings.

4. Start the Synapso backend (optional):
```bash
docker-compose up -d
```

5. Start the development server:
```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

```
src/
├── app/                    # Next.js app directory
├── components/             # React components
│   ├── chat/               # Chat interface components
│   ├── layout/             # Layout components
│   ├── nodes/              # Node components
│   └── utility/            # Utility panel components
├── hooks/                  # Custom React hooks
├── services/               # Business logic and services
│   └── api/                # API clients
│       └── synapso/        # Synapso API client
└── types/                  # TypeScript type definitions
```

## UI Architecture

The UI is divided into three main panels:

1. **Canvas (Center)**: Main workspace where nodes and edges are displayed
2. **Utility Panel (Left)**: Configuration panel for nodes, workflows, and settings
3. **Chat Interface (Right)**: Agent interaction panel

## Node Types

### Workflow Nodes
Nodes that represent workflow processes and control flow (Teams, Milestones, etc.)

### Logic Nodes
Nodes that contain custom business logic and can be executed by the system

## Migration Guide

If you are migrating from the older Neo4j-based version to the Synapso-based architecture, see [Migration Guide](docs/MIGRATION-GUIDE.md).

## Development

### Working Offline

Cerebro supports offline mode, allowing you to continue working even when the Synapso backend is unavailable:

- UI indicates offline status
- Basic operations continue to work
- Changes are stored locally and synced when connection is restored

### Adding a New Node Type

1. Create a new hook in `src/hooks/useSynapso[NodeType].ts`
2. Create a new component in `src/components/nodes/synapso-[node-type].tsx`
3. Register the new node type in `src/components/nodes/index.ts`
4. Ensure the node type is supported by the Synapso backend

### Testing

```bash
# Run tests
bun test

# Run tests with coverage
bun test --coverage
```

## Deployment

The application is configured for deployment on Vercel:

1. Push your changes to GitHub
2. Connect your repository to Vercel
3. Configure environment variables for Synapso integration
4. Deploy

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
