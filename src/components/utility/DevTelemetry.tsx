"use client";

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause, Trash, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Define the structure of telemetry events
interface TelemetryEvent {
  id: string;
  timestamp: string;
  type: string;
  source: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

export function DevTelemetry() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState("events");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Simulate event stream connection
  useEffect(() => {
    if (!isStreaming) return;
    
    // This would be replaced with actual event source connection
    const eventTypes = ['api.request', 'api.response', 'node.update', 'workflow.status', 'agent.message'];
    const sources = ['api', 'workflow', 'agent', 'node', 'system'];
    const levels = ['info', 'warn', 'error', 'debug'];
    
    const interval = setInterval(() => {
      const newEvent: TelemetryEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        source: sources[Math.floor(Math.random() * sources.length)],
        level: levels[Math.floor(Math.random() * levels.length)] as 'info' | 'warn' | 'error' | 'debug',
        message: `Event ${events.length + 1}: ${Math.random().toString(36).substring(2, 8)}`,
        data: { 
          value: Math.random() * 100,
          nodeId: Math.random().toString(36).substring(2, 10)
        }
      };
      
      setEvents(prev => [...prev.slice(-99), newEvent]);
    }, 1500);
    
    return () => clearInterval(interval);
  }, [isStreaming, events.length]);
  
  // Auto-scroll to bottom of events
  useEffect(() => {
    if (autoScroll && scrollRef.current && events.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);
  
  const toggleStreaming = () => {
    setIsStreaming(!isStreaming);
  };
  
  const clearEvents = () => {
    setEvents([]);
  };
  
  const downloadEvents = () => {
    const eventsJson = JSON.stringify(events, null, 2);
    const blob = new Blob([eventsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry-events-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Format event level as badge
  const getLevelBadge = (level: 'info' | 'warn' | 'error' | 'debug') => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warn':
        return <Badge variant="outline" className="bg-yellow-500 text-white border-yellow-500">Warning</Badge>;
      case 'debug':
        return <Badge variant="outline">Debug</Badge>;
      case 'info':
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Telemetry Monitor</h3>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={toggleStreaming}
            className={isStreaming ? "text-red-500" : "text-green-500"}
          >
            {isStreaming ? (
              <><Pause className="h-4 w-4 mr-1" /> Stop</>
            ) : (
              <><Play className="h-4 w-4 mr-1" /> Start</>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={clearEvents}>
            <Trash className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={downloadEvents}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch
          id="auto-scroll"
          checked={autoScroll}
          onCheckedChange={setAutoScroll}
        />
        <Label htmlFor="auto-scroll">Auto-scroll</Label>
      </div>
      
      <Tabs defaultValue="events" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-2 w-full">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="events" className="space-y-4">
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Streaming events ({events.length})</span>
            </div>
          )}
          
          <ScrollArea className="h-[400px] border rounded-md p-2" ref={scrollRef}>
            <div className="space-y-2">
              {events.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No events captured</p>
                  <p className="text-xs text-muted-foreground">Click Start to begin monitoring</p>
                </div>
              ) : (
                events.map((event) => (
                  <Card key={event.id} className="p-2">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-xs font-medium">{event.type}</span>
                      </div>
                      {getLevelBadge(event.level)}
                    </div>
                    <p className="text-sm">{event.message}</p>
                    {event.data && (
                      <pre className="text-xs bg-muted/50 p-1 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    )}
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="metrics">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">API Performance</CardTitle>
                <CardDescription className="text-xs">Average response times</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Metrics visualization coming soon</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="logs">
          <div className="text-center py-8 border rounded-md">
            <p className="text-sm text-muted-foreground">System logs will appear here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 