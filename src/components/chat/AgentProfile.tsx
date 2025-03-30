"use client";

import { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, Wifi, WifiOff } from 'lucide-react';
import { synapsoClient } from '@/services/api/synapso/synapso.client';
import { Agent, AgentStatus } from '@/types/synapso';

interface AgentProfileProps {
  agentId?: string;
  workflowId?: string;
  isOffline?: boolean;
}

export function AgentProfile({ agentId, workflowId, isOffline = false }: AgentProfileProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch agent data
  useEffect(() => {
    const fetchAgent = async () => {
      if (!agentId) {
        // Use a default agent if no ID is provided (for demo/development)
        setAgent({
          id: 'default',
          name: 'Workflow Assistant',
          description: 'I can help you manage your workflow and complete tasks.',
          capabilities: [],
          status: AgentStatus.IDLE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          config: {
            avatar: null
          }
        });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const agentData = await synapsoClient.getAgent(agentId);
        setAgent(agentData);
      } catch (err) {
        console.error('Failed to fetch agent:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch agent'));
        
        // Set fallback agent data when offline or error
        setAgent({
          id: agentId,
          name: 'Assistant',
          description: 'Workflow assistant (offline mode)',
          capabilities: [],
          status: AgentStatus.STOPPED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [agentId]);

  // If not loading and no agent, return empty
  if (!loading && !agent) {
    return null;
  }

  // Status indicator based on agent status or offline state
  const getStatusIndicator = () => {
    if (isOffline) {
      return (
        <Badge variant="outline" className="ml-2 text-xs gap-1 py-0 font-normal bg-yellow-500/10 text-yellow-600 border-yellow-200">
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </Badge>
      );
    }

    const status = agent?.status || AgentStatus.IDLE;
    
    // Status badge styling based on status
    switch (status) {
      case AgentStatus.ACTIVE:
        return (
          <Badge variant="outline" className="ml-2 text-xs gap-1 py-0 font-normal bg-orange-500/10 text-orange-600 border-orange-200">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            <span>Busy</span>
          </Badge>
        );
      case AgentStatus.PAUSED:
        return (
          <Badge variant="outline" className="ml-2 text-xs gap-1 py-0 font-normal bg-blue-500/10 text-blue-600 border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            <span>Paused</span>
          </Badge>
        );
      case AgentStatus.STOPPED:
        return (
          <Badge variant="outline" className="ml-2 text-xs gap-1 py-0 font-normal bg-red-500/10 text-red-600 border-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
            <span>Stopped</span>
          </Badge>
        );
      case AgentStatus.IDLE:
      default:
        return (
          <Badge variant="outline" className="ml-2 text-xs gap-1 py-0 font-normal bg-green-500/10 text-green-600 border-green-200">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
            <span>Available</span>
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center p-3 border-b mb-3">
      <Avatar className="h-10 w-10 mr-3">
        <AvatarFallback>
          <Bot className="h-5 w-5" />
        </AvatarFallback>
        {agent?.config?.avatar && (
          <AvatarImage src={agent.config.avatar} alt={agent.name} />
        )}
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <h3 className="font-medium text-sm truncate">{agent?.name || 'Assistant'}</h3>
          {getStatusIndicator()}
        </div>
        <p className="text-xs text-muted-foreground truncate">{agent?.description || 'AI Assistant'}</p>
      </div>
    </div>
  );
} 