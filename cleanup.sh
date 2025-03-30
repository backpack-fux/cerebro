#!/bin/bash

# Cleanup script for removing obsolete Neo4j and observer code
# Usage: ./cleanup.sh

echo "🧹 Cleaning up obsolete code..."

# Remove Neo4j specific code
echo "📁 Removing Neo4j directories and files..."
rm -rf src/services/graph/neo4j

# Remove old observer pattern implementation
echo "📁 Removing old observer pattern implementation..."
rm -rf src/services/graph/observer
rm -f src/hooks/useNodeObserver.ts

# Remove old node implementations and hooks (except Synapso versions)
echo "📁 Removing old node implementation files..."
rm -f src/hooks/useTeamNode.ts
rm -f src/hooks/useOptionNode.ts
rm -f src/hooks/useProviderNode.ts
rm -f src/hooks/useMetaNode.ts
rm -f src/hooks/useMilestoneNode.ts
rm -f src/hooks/useFeatureNode.ts
rm -f src/hooks/useTeamMemberNode.ts

# Keep the new Synapso files
# Note: Don't remove useSynapso.ts, useSynapsoTeamNode.ts and useSynapsoTeamMemberNode.ts

echo "✅ Cleanup completed!"
echo "⚠️ Migrated nodes:"
echo "  - TeamNode → SynapsoTeamNode ✅"
echo "  - LogicNode → SynapsoLogicNode ✅"
echo "  - TeamMemberNode → SynapsoTeamMemberNode ✅"
echo "⚠️ Remember to gradually migrate other node components to use Synapso" 