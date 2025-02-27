import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { RFProviderNode, RFProviderNodeData, CreateProviderNodeParams, UpdateProviderNodeParams, RFProviderEdge, ProviderCost, DDItem, TeamAllocation } from '@/services/graph/provider/provider.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge } from '@/services/graph/provider/provider.transform';

export class ProviderService {
  constructor(private storage: IGraphStorage<RFProviderNodeData>) {}

  async create(params: CreateProviderNodeParams): Promise<RFProviderNode> {
    const node: RFProviderNode = {
      id: crypto.randomUUID(),
      type: 'provider',
      position: params.position,
      data: {
        title: params.title,
        description: params.description || '',
        name: params.title, // Default name to title
        duration: params.duration,
        status: params.status || 'planning', // Default status
        costs: [],
        ddItems: [],
        teamAllocations: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    return this.storage.createNode('provider', node.data) as Promise<RFProviderNode>;
  }

  async update(params: UpdateProviderNodeParams): Promise<RFProviderNode> {
    const { id, ...updateData } = params;
    return this.storage.updateNode(id, updateData as Partial<RFProviderNodeData>) as Promise<RFProviderNode>;
  }

  async delete(id: string): Promise<void> {
    return this.storage.deleteNode(id);
  }

  // Edge operations
  async createEdge(edge: RFProviderEdge): Promise<RFProviderEdge> {
    const graphEdge = reactFlowToNeo4jEdge(edge);
    const result = await this.storage.createEdge(graphEdge);
    return neo4jToReactFlowEdge(result);
  }

  async getEdges(nodeId: string, type?: string): Promise<RFProviderEdge[]> {
    const edges = await this.storage.getEdges(nodeId, type);
    return edges.map(edge => neo4jToReactFlowEdge(edge));
  }

  async getEdge(edgeId: string): Promise<RFProviderEdge | null> {
    const edge = await this.storage.getEdge(edgeId);
    return edge ? neo4jToReactFlowEdge(edge) : null;
  }

  async updateEdge(edgeId: string, properties: Partial<RFProviderEdge['data']>): Promise<RFProviderEdge> {
    const result = await this.storage.updateEdge(edgeId, properties);
    return neo4jToReactFlowEdge(result);
  }

  async deleteEdge(edgeId: string): Promise<void> {
    return this.storage.deleteEdge(edgeId);
  }

  // Provider-specific operations
  async addCost(providerId: string, cost: ProviderCost): Promise<RFProviderNode> {
    const provider = await this.storage.getNode(providerId) as RFProviderNode;
    if (!provider) {
      throw new Error(`Provider with ID ${providerId} not found`);
    }
    
    // Ensure costs is an array
    let costs: ProviderCost[] = [];
    if (Array.isArray(provider.data.costs)) {
      costs = [...provider.data.costs];
    } else if (typeof provider.data.costs === 'string') {
      try {
        const parsedCosts = JSON.parse(provider.data.costs);
        costs = Array.isArray(parsedCosts) ? parsedCosts : [];
      } catch (e) {
        console.warn('Failed to parse costs string:', e);
      }
    }
    
    // Check if cost with same ID already exists
    const existingCostIndex = costs.findIndex(c => c.id === cost.id);
    if (existingCostIndex >= 0) {
      costs[existingCostIndex] = cost;
    } else {
      costs.push(cost);
    }
    
    return this.update({
      id: providerId,
      costs,
    });
  }

  async removeCost(providerId: string, costId: string): Promise<RFProviderNode> {
    const provider = await this.storage.getNode(providerId) as RFProviderNode;
    if (!provider) {
      throw new Error(`Provider with ID ${providerId} not found`);
    }
    
    // Ensure costs is an array
    let costs: ProviderCost[] = [];
    if (Array.isArray(provider.data.costs)) {
      costs = [...provider.data.costs];
    } else if (typeof provider.data.costs === 'string') {
      try {
        const parsedCosts = JSON.parse(provider.data.costs);
        costs = Array.isArray(parsedCosts) ? parsedCosts : [];
      } catch (e) {
        console.warn('Failed to parse costs string:', e);
      }
    }
    
    const filteredCosts = costs.filter(c => c.id !== costId);
    
    return this.update({
      id: providerId,
      costs: filteredCosts,
    });
  }

  async addDDItem(providerId: string, ddItem: DDItem): Promise<RFProviderNode> {
    const provider = await this.storage.getNode(providerId) as RFProviderNode;
    if (!provider) {
      throw new Error(`Provider with ID ${providerId} not found`);
    }
    
    // Ensure ddItems is an array
    let ddItems: DDItem[] = [];
    if (Array.isArray(provider.data.ddItems)) {
      ddItems = [...provider.data.ddItems];
    } else if (typeof provider.data.ddItems === 'string') {
      try {
        const parsedDDItems = JSON.parse(provider.data.ddItems);
        ddItems = Array.isArray(parsedDDItems) ? parsedDDItems : [];
      } catch (e) {
        console.warn('Failed to parse ddItems string:', e);
      }
    }
    
    // Check if item with same ID already exists
    const existingItemIndex = ddItems.findIndex(item => item.id === ddItem.id);
    if (existingItemIndex >= 0) {
      ddItems[existingItemIndex] = ddItem;
    } else {
      ddItems.push(ddItem);
    }
    
    return this.update({
      id: providerId,
      ddItems,
    });
  }

  async removeDDItem(providerId: string, ddItemId: string): Promise<RFProviderNode> {
    const provider = await this.storage.getNode(providerId) as RFProviderNode;
    if (!provider) {
      throw new Error(`Provider with ID ${providerId} not found`);
    }
    
    // Ensure ddItems is an array
    let ddItems: DDItem[] = [];
    if (Array.isArray(provider.data.ddItems)) {
      ddItems = [...provider.data.ddItems];
    } else if (typeof provider.data.ddItems === 'string') {
      try {
        const parsedDDItems = JSON.parse(provider.data.ddItems);
        ddItems = Array.isArray(parsedDDItems) ? parsedDDItems : [];
      } catch (e) {
        console.warn('Failed to parse ddItems string:', e);
      }
    }
    
    const filteredDDItems = ddItems.filter(item => item.id !== ddItemId);
    
    return this.update({
      id: providerId,
      ddItems: filteredDDItems,
    });
  }

  async updateDDItemStatus(providerId: string, ddItemId: string, status: 'pending' | 'in_progress' | 'completed' | 'blocked'): Promise<RFProviderNode> {
    const provider = await this.storage.getNode(providerId) as RFProviderNode;
    if (!provider) {
      throw new Error(`Provider with ID ${providerId} not found`);
    }
    
    // Ensure ddItems is an array
    let ddItems: DDItem[] = [];
    if (Array.isArray(provider.data.ddItems)) {
      ddItems = [...provider.data.ddItems];
    } else if (typeof provider.data.ddItems === 'string') {
      try {
        const parsedDDItems = JSON.parse(provider.data.ddItems);
        ddItems = Array.isArray(parsedDDItems) ? parsedDDItems : [];
      } catch (e) {
        console.warn('Failed to parse ddItems string:', e);
      }
    }
    
    const itemIndex = ddItems.findIndex(item => item.id === ddItemId);
    
    if (itemIndex < 0) {
      throw new Error(`DD item with ID ${ddItemId} not found in provider ${providerId}`);
    }
    
    ddItems[itemIndex] = {
      ...ddItems[itemIndex],
      status,
    };
    
    return this.update({
      id: providerId,
      ddItems,
    });
  }

  async addTeam(providerId: string, teamId: string, requestedHours: number = 0): Promise<RFProviderEdge> {
    // Create an edge between provider and team
    const edge: RFProviderEdge = {
      id: `edge-${crypto.randomUUID()}`,
      source: providerId,
      target: teamId,
      type: 'PROVIDER_TEAM',
      data: {
        label: 'Provider Team',
        allocation: requestedHours,
      },
    };
    
    // Also update the provider's team allocations
    const provider = await this.storage.getNode(providerId) as RFProviderNode;
    if (provider) {
      // Ensure teamAllocations is an array
      let teamAllocations: TeamAllocation[] = [];
      if (Array.isArray(provider.data.teamAllocations)) {
        teamAllocations = [...provider.data.teamAllocations];
      } else if (typeof provider.data.teamAllocations === 'string') {
        try {
          const parsedTeamAllocations = JSON.parse(provider.data.teamAllocations);
          teamAllocations = Array.isArray(parsedTeamAllocations) ? parsedTeamAllocations : [];
        } catch (e) {
          console.warn('Failed to parse teamAllocations string:', e);
        }
      }
      
      // Check if team already exists in allocations
      const existingTeamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      
      if (existingTeamIndex >= 0) {
        // Update existing team
        teamAllocations[existingTeamIndex] = {
          ...teamAllocations[existingTeamIndex],
          requestedHours,
        };
      } else {
        // Add new team
        teamAllocations.push({
          teamId,
          requestedHours,
          allocatedMembers: [],
        });
      }
      
      // Update the provider node
      await this.update({
        id: providerId,
        teamAllocations,
      });
    }
    
    return this.createEdge(edge);
  }

  async removeTeam(providerId: string, teamId: string): Promise<void> {
    // Find the edge between provider and team
    const edges = await this.getEdges(providerId, 'PROVIDER_TEAM');
    const edge = edges.find(e => e.target === teamId);
    
    if (edge) {
      await this.deleteEdge(edge.id);
    }
    
    // Also update the provider's team allocations
    const provider = await this.storage.getNode(providerId) as RFProviderNode;
    if (provider) {
      // Ensure teamAllocations is an array
      let teamAllocations: TeamAllocation[] = [];
      if (Array.isArray(provider.data.teamAllocations)) {
        teamAllocations = [...provider.data.teamAllocations];
      } else if (typeof provider.data.teamAllocations === 'string') {
        try {
          const parsedTeamAllocations = JSON.parse(provider.data.teamAllocations);
          teamAllocations = Array.isArray(parsedTeamAllocations) ? parsedTeamAllocations : [];
        } catch (e) {
          console.warn('Failed to parse teamAllocations string:', e);
        }
      }
      
      const filteredTeamAllocations = teamAllocations.filter(t => t.teamId !== teamId);
      
      // Update the provider node
      await this.update({
        id: providerId,
        teamAllocations: filteredTeamAllocations,
      });
    }
  }

  async updateTeamAllocation(providerId: string, teamId: string, requestedHours: number, allocatedMembers: { memberId: string; hours: number }[] = []): Promise<void> {
    // Find the edge between provider and team
    const edges = await this.getEdges(providerId, 'PROVIDER_TEAM');
    const edge = edges.find(e => e.target === teamId);
    
    if (edge) {
      // Update the edge allocation
      await this.updateEdge(edge.id, { allocation: requestedHours });
    }
    
    // Also update the provider's team allocations
    const provider = await this.storage.getNode(providerId) as RFProviderNode;
    if (provider) {
      // Ensure teamAllocations is an array
      let teamAllocations: TeamAllocation[] = [];
      if (Array.isArray(provider.data.teamAllocations)) {
        teamAllocations = [...provider.data.teamAllocations];
      } else if (typeof provider.data.teamAllocations === 'string') {
        try {
          const parsedTeamAllocations = JSON.parse(provider.data.teamAllocations);
          teamAllocations = Array.isArray(parsedTeamAllocations) ? parsedTeamAllocations : [];
        } catch (e) {
          console.warn('Failed to parse teamAllocations string:', e);
        }
      }
      
      const teamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      
      if (teamIndex >= 0) {
        teamAllocations[teamIndex] = {
          ...teamAllocations[teamIndex],
          requestedHours,
          allocatedMembers,
        };
      } else {
        // Add new team allocation if it doesn't exist
        teamAllocations.push({
          teamId,
          requestedHours,
          allocatedMembers,
        });
      }
      
      // Update the provider node
      await this.update({
        id: providerId,
        teamAllocations,
      });
    }
  }
} 