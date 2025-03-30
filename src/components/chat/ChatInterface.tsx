"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Send, Bot, RefreshCw, Plus } from "lucide-react";
import { AgentProfile } from './AgentProfile';

// Message type definition
interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  agentName?: string;
  agentAvatar?: string;
}

interface ChatInterfaceProps {
  workflowId?: string;
  isOffline?: boolean;
}

export function ChatInterface({ workflowId, isOffline = false }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Welcome to Cerebro. This chat interface allows you to interact with agents in your workflow.',
      timestamp: new Date(),
    }
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle sending a message
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);
    
    // Simulate agent response
    setTimeout(() => {
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: `I'm analyzing your request about "${inputValue}". In a real implementation, this would be handled by the Synapso backend.`,
        timestamp: new Date(),
        agentName: 'Assistant',
      };
      
      setMessages(prev => [...prev, agentMessage]);
      setIsStreaming(false);
    }, 1500);
  };
  
  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Render messages
  const renderMessage = (message: Message) => {
    switch (message.role) {
      case 'user':
        return (
          <div key={message.id} className="flex gap-3 mb-4 ml-auto max-w-[80%]">
            <div className="flex-1 bg-primary text-primary-foreground p-3 rounded-lg">
              <p className="text-sm">{message.content}</p>
              <div className="text-xs opacity-70 mt-1 text-right">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>
        );
        
      case 'agent':
        return (
          <div key={message.id} className="flex gap-3 mb-4 max-w-[80%]">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                <Bot className="h-4 w-4" />
              </AvatarFallback>
              {message.agentAvatar && (
                <AvatarImage src={message.agentAvatar} alt={message.agentName || 'Agent'} />
              )}
            </Avatar>
            <div className="flex-1">
              {message.agentName && (
                <div className="text-xs font-medium mb-1">{message.agentName}</div>
              )}
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">{message.content}</p>
                <div className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'system':
        return (
          <div key={message.id} className="flex justify-center mb-4">
            <div className="bg-muted px-3 py-1.5 rounded-full text-xs text-center max-w-[85%]">
              {message.content}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Agent Profile */}
      <AgentProfile workflowId={workflowId} isOffline={isOffline} />
      
      {/* Chat Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Chat Interface</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Chat Messages */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 min-h-full">
          {messages.map(renderMessage)}
          <div ref={endOfMessagesRef} />
          
          {isStreaming && (
            <div className="flex gap-3 mb-4 max-w-[80%]">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-xs font-medium mb-1">Assistant</div>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Message Input */}
      <div className="mt-4 relative">
        <Input
          placeholder="Send a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isStreaming}
          className="pr-10"
        />
        <Button
          size="sm"
          className="absolute right-1 top-1 h-8 w-8 p-0"
          disabled={!inputValue.trim() || isStreaming}
          onClick={handleSendMessage}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 