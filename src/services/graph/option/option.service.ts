import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { RFOptionNode, RFOptionNodeData, CreateOptionNodeParams, UpdateOptionNodeParams, RFOptionEdge, Goal, Risk, MemberAllocation, TeamAllocation } from '@/services/graph/option/option.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge } from '@/services/graph/option/option.transform';

export class OptionService {
  constructor(private storage: IGraphStorage<RFOptionNodeData>) {}

  async create(params: CreateOptionNodeParams): Promise<RFOptionNode> {
    const node: RFOptionNode = {
      id: crypto.randomUUID(),
      type: 'option',
      position: params.position,
      data: {
        title: params.title,
        description: params.description || '',
        name: params.title, // Default name to title
        optionType: params.optionType,
        duration: params.duration,
        goals: params.goals || [], // Initialize with empty goals if not provided
        risks: params.risks || [], // Initialize with empty risks if not provided
        status: params.status || 'planning', // Default status
        teamMembers: [],
        memberAllocations: [],
        teamAllocations: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    return this.storage.createNode('option', node.data) as Promise<RFOptionNode>;
  }

  async update(params: UpdateOptionNodeParams): Promise<RFOptionNode> {
    const { id, ...updateData } = params;
    return this.storage.updateNode(id, updateData as Partial<RFOptionNodeData>) as Promise<RFOptionNode>;
  }

  async delete(id: string): Promise<void> {
    return this.storage.deleteNode(id);
  }

  // Edge operations
  async createEdge(edge: RFOptionEdge): Promise<RFOptionEdge> {
    const graphEdge = reactFlowToNeo4jEdge(edge);
    const result = await this.storage.createEdge(graphEdge);
    return neo4jToReactFlowEdge(result);
  }

  async getEdges(nodeId: string, type?: string): Promise<RFOptionEdge[]> {
    const edges = await this.storage.getEdges(nodeId, type);
    return edges.map(edge => neo4jToReactFlowEdge(edge));
  }

  async getEdge(edgeId: string): Promise<RFOptionEdge | null> {
    const edge = await this.storage.getEdge(edgeId);
    return edge ? neo4jToReactFlowEdge(edge) : null;
  }

  async updateEdge(edgeId: string, properties: Partial<RFOptionEdge['data']>): Promise<RFOptionEdge> {
    const result = await this.storage.updateEdge(edgeId, properties);
    return neo4jToReactFlowEdge(result);
  }

  async deleteEdge(edgeId: string): Promise<void> {
    return this.storage.deleteEdge(edgeId);
  }

  // Option-specific operations
  async addGoal(optionId: string, goal: Goal): Promise<RFOptionNode> {
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (!option) {
      throw new Error(`Option with ID ${optionId} not found`);
    }
    
    // Ensure goals is an array
    let goals: Goal[] = [];
    if (Array.isArray(option.data.goals)) {
      goals = [...option.data.goals];
    } else if (typeof option.data.goals === 'string') {
      try {
        const parsedGoals = JSON.parse(option.data.goals);
        goals = Array.isArray(parsedGoals) ? parsedGoals : [];
      } catch (e) {
        console.warn('Failed to parse goals string:', e);
      }
    }
    
    // Check if goal with same ID already exists
    const existingGoalIndex = goals.findIndex(g => g.id === goal.id);
    if (existingGoalIndex >= 0) {
      goals[existingGoalIndex] = goal;
    } else {
      goals.push(goal);
    }
    
    return this.update({
      id: optionId,
      goals,
    });
  }

  async removeGoal(optionId: string, goalId: string): Promise<RFOptionNode> {
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (!option) {
      throw new Error(`Option with ID ${optionId} not found`);
    }
    
    // Ensure goals is an array
    let goals: Goal[] = [];
    if (Array.isArray(option.data.goals)) {
      goals = [...option.data.goals];
    } else if (typeof option.data.goals === 'string') {
      try {
        const parsedGoals = JSON.parse(option.data.goals);
        goals = Array.isArray(parsedGoals) ? parsedGoals : [];
      } catch (e) {
        console.warn('Failed to parse goals string:', e);
      }
    }
    
    // Filter out the goal with the specified ID
    const filteredGoals = goals.filter(g => g.id !== goalId);
    
    return this.update({
      id: optionId,
      goals: filteredGoals,
    });
  }

  async addRisk(optionId: string, risk: Risk): Promise<RFOptionNode> {
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (!option) {
      throw new Error(`Option with ID ${optionId} not found`);
    }
    
    // Ensure risks is an array
    let risks: Risk[] = [];
    if (Array.isArray(option.data.risks)) {
      risks = [...option.data.risks];
    } else if (typeof option.data.risks === 'string') {
      try {
        const parsedRisks = JSON.parse(option.data.risks);
        risks = Array.isArray(parsedRisks) ? parsedRisks : [];
      } catch (e) {
        console.warn('Failed to parse risks string:', e);
      }
    }
    
    // Check if risk with same ID already exists
    const existingRiskIndex = risks.findIndex(r => r.id === risk.id);
    if (existingRiskIndex >= 0) {
      risks[existingRiskIndex] = risk;
    } else {
      risks.push(risk);
    }
    
    return this.update({
      id: optionId,
      risks,
    });
  }

  async removeRisk(optionId: string, riskId: string): Promise<RFOptionNode> {
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (!option) {
      throw new Error(`Option with ID ${optionId} not found`);
    }
    
    // Ensure risks is an array
    let risks: Risk[] = [];
    if (Array.isArray(option.data.risks)) {
      risks = [...option.data.risks];
    } else if (typeof option.data.risks === 'string') {
      try {
        const parsedRisks = JSON.parse(option.data.risks);
        risks = Array.isArray(parsedRisks) ? parsedRisks : [];
      } catch (e) {
        console.warn('Failed to parse risks string:', e);
      }
    }
    
    // Filter out the risk with the specified ID
    const filteredRisks = risks.filter(r => r.id !== riskId);
    
    return this.update({
      id: optionId,
      risks: filteredRisks,
    });
  }

  async updateTransactionDetails(optionId: string, transactionFeeRate?: number, monthlyVolume?: number): Promise<RFOptionNode> {
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (!option) {
      throw new Error(`Option with ID ${optionId} not found`);
    }
    
    return this.update({
      id: optionId,
      transactionFeeRate,
      monthlyVolume,
    });
  }

  async updateBuildDuration(optionId: string, buildDuration: number): Promise<RFOptionNode> {
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (!option) {
      throw new Error(`Option with ID ${optionId} not found`);
    }
    
    return this.update({
      id: optionId,
      buildDuration,
    });
  }

  async updateTimeToClose(optionId: string, timeToClose: number): Promise<RFOptionNode> {
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (!option) {
      throw new Error(`Option with ID ${optionId} not found`);
    }
    
    return this.update({
      id: optionId,
      timeToClose,
    });
  }

  async addTeamMember(optionId: string, memberId: string, timePercentage: number = 0): Promise<RFOptionEdge> {
    // Create an edge between option and team member
    const edge: RFOptionEdge = {
      id: `edge-${crypto.randomUUID()}`,
      source: optionId,
      target: memberId,
      type: 'OPTION_MEMBER',
      data: {
        label: 'Option Member',
        allocation: timePercentage,
      },
    };
    
    // Also update the option's member allocations
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (option) {
      // Ensure memberAllocations is an array
      let memberAllocations: MemberAllocation[] = [];
      if (Array.isArray(option.data.memberAllocations)) {
        memberAllocations = [...option.data.memberAllocations];
      } else if (typeof option.data.memberAllocations === 'string') {
        try {
          const parsedMemberAllocations = JSON.parse(option.data.memberAllocations);
          memberAllocations = Array.isArray(parsedMemberAllocations) ? parsedMemberAllocations : [];
        } catch (e) {
          console.warn('Failed to parse memberAllocations string:', e);
        }
      }
      
      // Ensure teamMembers is an array
      let teamMembers: string[] = [];
      if (Array.isArray(option.data.teamMembers)) {
        teamMembers = [...option.data.teamMembers];
      } else if (typeof option.data.teamMembers === 'string') {
        try {
          const parsedTeamMembers = JSON.parse(option.data.teamMembers);
          teamMembers = Array.isArray(parsedTeamMembers) ? parsedTeamMembers : [];
        } catch (e) {
          console.warn('Failed to parse teamMembers string:', e);
        }
      }
      
      // Check if member already exists in allocations
      const existingMemberIndex = memberAllocations.findIndex(m => m.memberId === memberId);
      
      if (existingMemberIndex >= 0) {
        // Update existing member
        memberAllocations[existingMemberIndex] = {
          ...memberAllocations[existingMemberIndex],
          timePercentage,
        };
      } else {
        // Add new member
        memberAllocations.push({
          memberId,
          timePercentage,
        });
      }
      
      // Add member to teamMembers if not already present
      if (!teamMembers.includes(memberId)) {
        teamMembers.push(memberId);
      }
      
      // Update the option node
      await this.update({
        id: optionId,
        memberAllocations,
        teamMembers,
      });
    }
    
    return this.createEdge(edge);
  }

  async removeTeamMember(optionId: string, memberId: string): Promise<void> {
    // Find the edge between option and member
    const edges = await this.getEdges(optionId, 'OPTION_MEMBER');
    const edge = edges.find(e => e.target === memberId);
    
    if (edge) {
      await this.deleteEdge(edge.id);
    }
    
    // Also update the option's member allocations
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (option) {
      // Ensure memberAllocations is an array
      let memberAllocations: MemberAllocation[] = [];
      if (Array.isArray(option.data.memberAllocations)) {
        memberAllocations = [...option.data.memberAllocations];
      } else if (typeof option.data.memberAllocations === 'string') {
        try {
          const parsedMemberAllocations = JSON.parse(option.data.memberAllocations);
          memberAllocations = Array.isArray(parsedMemberAllocations) ? parsedMemberAllocations : [];
        } catch (e) {
          console.warn('Failed to parse memberAllocations string:', e);
        }
      }
      
      // Ensure teamMembers is an array
      let teamMembers: string[] = [];
      if (Array.isArray(option.data.teamMembers)) {
        teamMembers = [...option.data.teamMembers];
      } else if (typeof option.data.teamMembers === 'string') {
        try {
          const parsedTeamMembers = JSON.parse(option.data.teamMembers);
          teamMembers = Array.isArray(parsedTeamMembers) ? parsedTeamMembers : [];
        } catch (e) {
          console.warn('Failed to parse teamMembers string:', e);
        }
      }
      
      // Filter out the member
      const filteredMemberAllocations = memberAllocations.filter(m => m.memberId !== memberId);
      const filteredTeamMembers = teamMembers.filter(id => id !== memberId);
      
      // Update the option node
      await this.update({
        id: optionId,
        memberAllocations: filteredMemberAllocations,
        teamMembers: filteredTeamMembers,
      });
    }
  }

  async addTeam(optionId: string, teamId: string, requestedHours: number = 0): Promise<RFOptionEdge> {
    // Create an edge between option and team
    const edge: RFOptionEdge = {
      id: `edge-${crypto.randomUUID()}`,
      source: optionId,
      target: teamId,
      type: 'OPTION_TEAM',
      data: {
        label: 'Option Team',
        allocation: requestedHours,
      },
    };
    
    // Also update the option's team allocations
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (option) {
      // Ensure teamAllocations is an array
      let teamAllocations: TeamAllocation[] = [];
      if (Array.isArray(option.data.teamAllocations)) {
        teamAllocations = [...option.data.teamAllocations];
      } else if (typeof option.data.teamAllocations === 'string') {
        try {
          const parsedTeamAllocations = JSON.parse(option.data.teamAllocations);
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
      
      // Update the option node
      await this.update({
        id: optionId,
        teamAllocations,
      });
    }
    
    return this.createEdge(edge);
  }

  async removeTeam(optionId: string, teamId: string): Promise<void> {
    // Find the edge between option and team
    const edges = await this.getEdges(optionId, 'OPTION_TEAM');
    const edge = edges.find(e => e.target === teamId);
    
    if (edge) {
      await this.deleteEdge(edge.id);
    }
    
    // Also update the option's team allocations
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (option) {
      // Ensure teamAllocations is an array
      let teamAllocations: TeamAllocation[] = [];
      if (Array.isArray(option.data.teamAllocations)) {
        teamAllocations = [...option.data.teamAllocations];
      } else if (typeof option.data.teamAllocations === 'string') {
        try {
          const parsedTeamAllocations = JSON.parse(option.data.teamAllocations);
          teamAllocations = Array.isArray(parsedTeamAllocations) ? parsedTeamAllocations : [];
        } catch (e) {
          console.warn('Failed to parse teamAllocations string:', e);
        }
      }
      
      // Filter out the team
      const filteredTeamAllocations = teamAllocations.filter(t => t.teamId !== teamId);
      
      // Update the option node
      await this.update({
        id: optionId,
        teamAllocations: filteredTeamAllocations,
      });
    }
  }

  async updateTeamAllocation(optionId: string, teamId: string, requestedHours: number, allocatedMembers: { memberId: string; hours: number }[] = []): Promise<void> {
    // Find the edge between option and team
    const edges = await this.getEdges(optionId, 'OPTION_TEAM');
    const edge = edges.find(e => e.target === teamId);
    
    if (edge) {
      // Update the edge allocation
      await this.updateEdge(edge.id, { allocation: requestedHours });
    }
    
    // Also update the option's team allocations
    const option = await this.storage.getNode(optionId) as RFOptionNode;
    if (option) {
      // Ensure teamAllocations is an array
      let teamAllocations: TeamAllocation[] = [];
      if (Array.isArray(option.data.teamAllocations)) {
        teamAllocations = [...option.data.teamAllocations];
      } else if (typeof option.data.teamAllocations === 'string') {
        try {
          const parsedTeamAllocations = JSON.parse(option.data.teamAllocations);
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
      
      // Update the option node
      await this.update({
        id: optionId,
        teamAllocations,
      });
    }
  }
} 