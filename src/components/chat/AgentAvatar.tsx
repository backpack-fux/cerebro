"use client";

import React, { useState, useEffect } from 'react';
import { AgentStatus } from '@/types/synapso';
import { Bot } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AgentAvatarProps {
  name?: string;
  status?: AgentStatus;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isAnimating?: boolean;
}

export function AgentAvatar({ 
  name = 'AI Assistant',
  status = 'idle' as AgentStatus,
  avatarUrl = null,
  size = 'lg',
  isAnimating = false,
}: AgentAvatarProps) {
  const [animationState, setAnimationState] = useState<string>('idle');
  
  // Define size classes based on the size prop
  const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-14 w-14',
    lg: 'h-20 w-20',
    xl: 'h-28 w-28',
  }[size];
  
  const iconSizes = {
    sm: 'h-5 w-5',
    md: 'h-7 w-7',
    lg: 'h-10 w-10',
    xl: 'h-14 w-14',
  }[size];
  
  // Update animation state based on status and isAnimating prop
  useEffect(() => {
    if (isAnimating) {
      setAnimationState('talking');
    } else {
      // Map agent status to animation state
      switch (status) {
        case 'busy' as AgentStatus:
          setAnimationState('thinking');
          break;
        case 'idle' as AgentStatus:
          setAnimationState('idle');
          break;
        default:
          setAnimationState('idle');
      }
    }
  }, [status, isAnimating]);
  
  // Default avatar URL with fallback to a placeholder
  const defaultAvatarUrl = "/avatars/default-assistant.png";
  
  return (
    <div className={`agent-avatar relative ${sizeClasses}`}>
      <Avatar className={sizeClasses}>
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/30">
          <Bot className={`${iconSizes} text-primary`} />
        </AvatarFallback>
        
        {(avatarUrl || defaultAvatarUrl) && (
          <AvatarImage 
            src={avatarUrl || defaultAvatarUrl} 
            alt={name}
            className="object-cover" 
          />
        )}
      </Avatar>
      
      {/* Animation overlay */}
      <div 
        className={`avatar-animation absolute inset-0 rounded-lg overflow-hidden pointer-events-none transition-opacity duration-300 
                    ${animationState !== 'idle' ? 'opacity-100' : 'opacity-0'}`}
      >
        {animationState === 'talking' && (
          <div className="talking-animation w-full h-full">
            <div className="waveform flex items-end justify-center h-full w-full gap-1 pb-2">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className="wave-bar w-1 bg-primary/70 rounded-full"
                  style={{ 
                    height: `${15 + Math.random() * 60}%`,
                    animationDelay: `${i * 0.1}s`,
                    animation: 'waveform 0.5s ease-in-out infinite alternate'
                  }}
                ></div>
              ))}
            </div>
          </div>
        )}
        
        {animationState === 'thinking' && (
          <div className="thinking-animation flex items-center justify-center h-full">
            <div className="thinking-dots flex gap-1.5">
              <div className="dot w-2 h-2 bg-primary/70 rounded-full animate-pulse" 
                  style={{ animationDelay: '0s' }}></div>
              <div className="dot w-2 h-2 bg-primary/70 rounded-full animate-pulse"
                  style={{ animationDelay: '0.3s' }}></div>
              <div className="dot w-2 h-2 bg-primary/70 rounded-full animate-pulse"
                  style={{ animationDelay: '0.6s' }}></div>
            </div>
          </div>
        )}
      </div>
      
      {/* Status indicator */}
      <div className={`status-indicator absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background
                      ${status === 'idle' as AgentStatus ? 'bg-green-500' : 
                        status === 'busy' as AgentStatus ? 'bg-orange-500' : 
                        status === 'error' as AgentStatus ? 'bg-red-500' : 
                        'bg-gray-500'}`}>
      </div>
    </div>
  );
} 