"use client";

import { useState, useRef, useEffect, ReactNode } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Wifi, WifiOff } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface ThreePanelLayoutProps {
  canvas: ReactNode;
  utilityPanel: ReactNode;
  chatInterface: ReactNode;
  defaultUtilitySize?: number;
  defaultChatSize?: number;
  isOffline?: boolean;
}

export function ThreePanelLayout({
  canvas,
  utilityPanel,
  chatInterface,
  defaultUtilitySize = 20,
  defaultChatSize = 25,
  isOffline = false
}: ThreePanelLayoutProps) {
  // Store panel sizes in state to allow for collapsing/expanding
  const [utilitySize, setUtilitySize] = useState(defaultUtilitySize);
  const [chatSize, setChatSize] = useState(defaultChatSize);
  
  // Track previous sizes for toggle functionality
  const prevUtilitySizeRef = useRef<number>(defaultUtilitySize);
  const prevChatSizeRef = useRef<number>(defaultChatSize);
  
  // Toggle utility panel
  const toggleUtilityPanel = () => {
    if (utilitySize > 0) {
      // If panel is visible, store size and collapse
      prevUtilitySizeRef.current = utilitySize;
      setUtilitySize(0);
    } else {
      // If panel is collapsed, restore previous size
      setUtilitySize(prevUtilitySizeRef.current);
    }
  };
  
  // Toggle chat panel
  const toggleChatPanel = () => {
    if (chatSize > 0) {
      // If panel is visible, store size and collapse
      prevChatSizeRef.current = chatSize;
      setChatSize(0);
    } else {
      // If panel is collapsed, restore previous size
      setChatSize(prevChatSizeRef.current);
    }
  };
  
  // Handle panel resize
  const handleResize = (sizes: number[]) => {
    if (sizes[0] !== utilitySize) {
      setUtilitySize(sizes[0]);
      if (sizes[0] > 0) {
        prevUtilitySizeRef.current = sizes[0];
      }
    }
    
    if (sizes[2] !== chatSize) {
      setChatSize(sizes[2]);
      if (sizes[2] > 0) {
        prevChatSizeRef.current = sizes[2];
      }
    }
  };
  
  return (
    <div className="h-screen w-full flex flex-col">
      {/* Top toolbar with toggle buttons */}
      <div className="flex items-center justify-between bg-background border-b px-4 h-12">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleUtilityPanel}
            className="p-2 rounded hover:bg-muted text-sm"
          >
            {utilitySize > 0 ? "Hide Utility" : "Show Utility"}
          </button>
          <ThemeToggle />
        </div>
        
        <div className="text-sm font-medium flex items-center gap-2">
          <span>Cerebro</span>
          {isOffline ? (
            <div className="flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full">
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">
              <Wifi className="h-3 w-3" />
              <span>Connected</span>
            </div>
          )}
        </div>
        
        <button
          onClick={toggleChatPanel}
          className="p-2 rounded hover:bg-muted text-sm"
        >
          {chatSize > 0 ? "Hide Chat" : "Show Chat"}
        </button>
      </div>
      
      {/* Main content area with resizable panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={handleResize}
          className="h-full"
        >
          {/* Left utility panel */}
          <ResizablePanel
            defaultSize={utilitySize}
            minSize={0}
            maxSize={40}
            className={`bg-background border-r ${utilitySize === 0 ? 'hidden' : ''}`}
          >
            <div className="h-full overflow-auto p-4">
              {utilityPanel}
            </div>
          </ResizablePanel>
          
          {/* Resizable handle between utility and canvas */}
          {utilitySize > 0 && (
            <ResizableHandle withHandle />
          )}
          
          {/* Main canvas area */}
          <ResizablePanel
            defaultSize={100 - utilitySize - chatSize}
            className="bg-background"
          >
            <div className="h-full">
              {canvas}
            </div>
          </ResizablePanel>
          
          {/* Resizable handle between canvas and chat */}
          {chatSize > 0 && (
            <ResizableHandle withHandle />
          )}
          
          {/* Right chat interface */}
          <ResizablePanel
            defaultSize={chatSize}
            minSize={0}
            maxSize={40}
            className={`bg-background border-l ${chatSize === 0 ? 'hidden' : ''}`}
          >
            <div className="h-full overflow-auto p-4">
              {chatInterface}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
} 