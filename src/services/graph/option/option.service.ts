import { IGraphStorage } from '@/services/graph/neo4j/graph.interface';
import { RFOptionNode, RFOptionNodeData, CreateOptionNodeParams, UpdateOptionNodeParams, RFOptionEdge, Goal, Risk, MemberAllocation, TeamAllocation } from '@/services/graph/option/option.types';
import { reactFlowToNeo4jEdge, neo4jToReactFlowEdge } from '@/services/graph/option/option.transform';
import { connectOptionToTeam, disconnectOptionFromTeam, updateOptionResourceAllocation, getOptionMemberAvailableHours } from './option-resource-integration';

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
    console.log('[OptionService] Deleting option node:', id);
    try {
      // Get the option node to find its team connections
      const optionNode = await this.storage.getNode(id) as RFOptionNode;
      if (optionNode) {
        // Get team allocations
        let teamAllocations: TeamAllocation[] = [];
        try {
          if (typeof optionNode.data.teamAllocations === 'string') {
            teamAllocations = JSON.parse(optionNode.data.teamAllocations);
          } else if (Array.isArray(optionNode.data.teamAllocations)) {
            teamAllocations = optionNode.data.teamAllocations;
          }
        } catch (error) {
          console.error('[OptionService] Error parsing team allocations:', error);
        }
        
        // Disconnect from all teams
        for (const allocation of teamAllocations) {
          console.log(`[OptionService] Cleaning up resources for team ${allocation.teamId} in option ${id}`);
          disconnectOptionFromTeam(id, allocation.teamId);
        }
      }
      
      // Delete the node from storage
      await this.storage.deleteNode(id);
      console.log('[OptionService] Deleted option node successfully');
    } catch (error) {
      console.error('[OptionService] Error deleting option node:', error);
      throw error;
    }
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
    console.log(`[OptionService] Adding team ${teamId} to option ${optionId}`);
    
    try {
      // Get the option node
      const optionNode = await this.storage.getNode(optionId) as RFOptionNode;
      if (!optionNode) {
        throw new Error(`Option node with ID ${optionId} not found`);
      }
      
      // Get the team node
      const teamNode = await this.storage.getNode(teamId);
      if (!teamNode) {
        throw new Error(`Team node with ID ${teamId} not found`);
      }
      
      // Create the edge
      const edge: RFOptionEdge = {
        id: crypto.randomUUID(),
        source: optionId,
        target: teamId,
        type: 'option-team',
        data: {
          requestedHours,
          allocatedMembers: [],
        },
      };
      
      // Create the edge in Neo4j
      const result = await this.createEdge(edge);
      
      // Update the option node with the team allocation
      let teamAllocations: TeamAllocation[] = [];
      try {
        if (typeof optionNode.data.teamAllocations === 'string') {
          teamAllocations = JSON.parse(optionNode.data.teamAllocations);
        } else if (Array.isArray(optionNode.data.teamAllocations)) {
          teamAllocations = optionNode.data.teamAllocations;
        }
      } catch (error) {
        console.error('Error parsing team allocations:', error);
      }
      
      // Check if the team is already in the allocations
      const existingTeamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      if (existingTeamIndex >= 0) {
        teamAllocations[existingTeamIndex] = {
          ...teamAllocations[existingTeamIndex],
          requestedHours,
        };
      } else {
        // Get team name from the team node
        const teamName = teamNode.data.title || teamNode.data.name || 'Unknown Team';
        
        // Add the team to the allocations
        teamAllocations.push({
          teamId,
          teamName,
          requestedHours,
          allocatedMembers: [],
          teamBandwidth: 0,
          availableBandwidth: 0,
        });
      }
      
      // Update the option node
      await this.update({
        id: optionId,
        teamAllocations: teamAllocations,
      });
      
      // Connect the option to the team's resources
      connectOptionToTeam(
        optionNode,
        teamId,
        (data) => {
          // Handle resource updates
          this.handleTeamResourceUpdate(optionId, teamId, data);
        }
      );
      
      return result;
    } catch (error) {
      console.error(`[OptionService] Error adding team ${teamId} to option ${optionId}:`, error);
      throw error;
    }
  }

  async removeTeam(optionId: string, teamId: string): Promise<void> {
    console.log(`[OptionService] Removing team ${teamId} from option ${optionId}`);
    
    try {
      // Get the option node
      const optionNode = await this.storage.getNode(optionId) as RFOptionNode;
      if (!optionNode) {
        throw new Error(`Option node with ID ${optionId} not found`);
      }
      
      // Get the edges connecting the option to the team
      const edges = await this.getEdges(optionId);
      const teamEdge = edges.find(edge => edge.target === teamId && edge.type === 'option-team');
      
      if (teamEdge) {
        // Delete the edge
        await this.deleteEdge(teamEdge.id);
      }
      
      // Update the option node to remove the team allocation
      let teamAllocations: TeamAllocation[] = [];
      try {
        if (typeof optionNode.data.teamAllocations === 'string') {
          teamAllocations = JSON.parse(optionNode.data.teamAllocations);
        } else if (Array.isArray(optionNode.data.teamAllocations)) {
          teamAllocations = optionNode.data.teamAllocations;
        }
      } catch (error) {
        console.error('Error parsing team allocations:', error);
      }
      
      // Remove the team from the allocations
      teamAllocations = teamAllocations.filter(t => t.teamId !== teamId);
      
      // Update the option node
      await this.update({
        id: optionId,
        teamAllocations: teamAllocations,
      });
      
      // Disconnect the option from the team's resources
      disconnectOptionFromTeam(optionId, teamId);
      
    } catch (error) {
      console.error(`[OptionService] Error removing team ${teamId} from option ${optionId}:`, error);
      throw error;
    }
  }

  async updateTeamAllocation(
    optionId: string, 
    teamId: string, 
    requestedHours: number, 
    allocatedMembers: { memberId: string; hours: number }[] = []
  ): Promise<void> {
    console.log(`[OptionService] Updating team allocation for team ${teamId} in option ${optionId}`);
    
    try {
      // Get the option node
      const optionNode = await this.storage.getNode(optionId) as RFOptionNode;
      if (!optionNode) {
        throw new Error(`Option node with ID ${optionId} not found`);
      }
      
      // Get the team node
      const teamNode = await this.storage.getNode(teamId);
      if (!teamNode) {
        throw new Error(`Team node with ID ${teamId} not found`);
      }
      
      // Update the option node with the team allocation
      let teamAllocations: TeamAllocation[] = [];
      try {
        if (typeof optionNode.data.teamAllocations === 'string') {
          teamAllocations = JSON.parse(optionNode.data.teamAllocations);
        } else if (Array.isArray(optionNode.data.teamAllocations)) {
          teamAllocations = optionNode.data.teamAllocations;
        }
      } catch (error) {
        console.error('Error parsing team allocations:', error);
      }
      
      // Format the allocated members to ensure they have names
      const formattedAllocatedMembers = allocatedMembers.map(member => {
        return {
          memberId: member.memberId,
          name: 'Unknown Member', // Default name
          hours: member.hours,
        };
      });
      
      // Check if the team is already in the allocations
      const existingTeamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      if (existingTeamIndex >= 0) {
        // Update the existing allocation
        teamAllocations[existingTeamIndex] = {
          ...teamAllocations[existingTeamIndex],
          requestedHours,
          allocatedMembers: formattedAllocatedMembers,
        };
      } else {
        // Get team name from the team node
        const teamName = teamNode.data.title || teamNode.data.name || 'Unknown Team';
        
        // Add the team to the allocations
        teamAllocations.push({
          teamId,
          teamName,
          requestedHours,
          allocatedMembers: formattedAllocatedMembers,
          teamBandwidth: 0,
          availableBandwidth: 0,
        });
      }
      
      // Update the option node
      await this.update({
        id: optionId,
        teamAllocations: teamAllocations,
      });
      
      // Get the project duration
      const projectDurationDays = optionNode.data.duration || 5;
      
      // Update resource allocation in the observer
      updateOptionResourceAllocation(
        optionId,
        teamId,
        formattedAllocatedMembers,
        projectDurationDays
      );
      
    } catch (error) {
      console.error(`[OptionService] Error updating team allocation for team ${teamId} in option ${optionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Handle team resource updates from the observer
   */
  private async handleTeamResourceUpdate(
    optionId: string, 
    teamId: string, 
    data: {
      teamBandwidth?: number;
      availableBandwidth?: number;
      memberResources?: Array<{
        memberId: string;
        weeklyCapacity?: number;
        hoursPerDay?: number;
        daysPerWeek?: number;
        allocation?: number;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    }
  ) {
    console.log(`[OptionService] Received resource update for option ${optionId} from team ${teamId}`);
    
    try {
      // Get the option node
      const optionNode = await this.storage.getNode(optionId) as RFOptionNode;
      if (!optionNode) {
        console.warn(`Option node with ID ${optionId} not found`);
        return;
      }
      
      // Update the option node with the team allocation
      let teamAllocations: TeamAllocation[] = [];
      try {
        if (typeof optionNode.data.teamAllocations === 'string') {
          teamAllocations = JSON.parse(optionNode.data.teamAllocations);
        } else if (Array.isArray(optionNode.data.teamAllocations)) {
          teamAllocations = optionNode.data.teamAllocations;
        }
      } catch (error) {
        console.error('Error parsing team allocations:', error);
      }
      
      // Check if the team is already in the allocations
      const existingTeamIndex = teamAllocations.findIndex(t => t.teamId === teamId);
      if (existingTeamIndex >= 0) {
        // Update the existing allocation with bandwidth information
        teamAllocations[existingTeamIndex] = {
          ...teamAllocations[existingTeamIndex],
          teamBandwidth: data.teamBandwidth || 0,
          availableBandwidth: data.availableBandwidth || 0,
        };
        
        // Update member allocations if available
        if (data.memberResources) {
          const allocatedMembers = teamAllocations[existingTeamIndex].allocatedMembers || [];
          
          // Update each member's available hours
          for (let i = 0; i < allocatedMembers.length; i++) {
            const member = allocatedMembers[i];
            const memberResource = data.memberResources.find((m) => m.memberId === member.memberId);
            
            if (memberResource) {
              // Calculate available hours for this member
              const projectDurationDays = optionNode.data.duration || 5;
              const availableHours = getOptionMemberAvailableHours(
                optionId,
                teamId,
                member.memberId,
                memberResource,
                projectDurationDays
              );
              
              // Update the member allocation
              allocatedMembers[i] = {
                ...member,
                availableHours,
              };
            }
          }
          
          // Update the team allocation with the updated members
          teamAllocations[existingTeamIndex].allocatedMembers = allocatedMembers;
        }
      }
      
      // Update the option node
      await this.update({
        id: optionId,
        teamAllocations: teamAllocations,
      });
      
    } catch (error) {
      console.error(`[OptionService] Error handling resource update for option ${optionId} from team ${teamId}:`, error);
    }
  }
} 