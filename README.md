# Cerebro - Project Management System

A modern project management system built with Next.js that helps teams manage resources, track features, and make strategic decisions.

## Features

- **Node-Based Architecture**: Flexible system for managing different types of nodes (Team, Feature, Option, Provider, etc.)
- **Real-time Updates**: Automatic synchronization of data across connected nodes
- **Resource Management**: Sophisticated team resource allocation and tracking
- **Visual Interface**: Interactive graph visualization of project relationships
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Docker (for Neo4j database)
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

3. Start the development server:
```bash
bun dev
```

4. Start Neo4j (in a separate terminal):
```bash
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

```
src/
├── app/                    # Next.js app directory
├── components/            # React components
├── hooks/                # Custom React hooks
├── services/             # Business logic and services
│   └── graph/           # Graph-related services
│       ├── observer/    # Node observer system
│       └── [node-type]/ # Individual node type services
└── utils/               # Utility functions
```

## Core Systems

### Node Data Manifest System

The Node Data Manifest System manages data dependencies between different node types:

- **Publishing**: Nodes can publish specific data fields
- **Subscribing**: Nodes can subscribe to updates from other nodes
- **Real-time Updates**: Changes are immediately reflected across connected nodes
- **Type Safety**: Full TypeScript support for data structures

### Team Resource Observer

Manages team resource allocations across work nodes:

- **Centralized Resource Management**: Single source of truth for team resources
- **Resource Contention Handling**: Proper management of competing resource requests
- **Consistent Calculations**: Uniform approach to calculating available hours
- **Real-time Updates**: Immediate reflection of resource changes

## API Documentation

The API documentation is available at `/api-docs` in the application. It includes:

- Endpoint descriptions
- Request/response examples
- Authentication details
- Rate limiting information

## Development

### Adding a New Node Type

1. Create a new manifest file in `src/services/graph/[node-type]/[node-type].manifest.ts`
2. Define the node's fields and relationships
3. Create the node's service and hook
4. Implement the UI components
5. Add API endpoints

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
3. Configure environment variables
4. Deploy

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
