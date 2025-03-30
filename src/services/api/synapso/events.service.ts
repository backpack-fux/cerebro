/**
 * Synapso Events Service
 * 
 * Manages real-time event subscriptions with the Synapso backend via SSE
 */

import { Event, EventSubscription, RealTimeEvent } from '@/types/synapso';

export type EventHandler = (event: RealTimeEvent) => void;

class SynapsoEventsService {
  private baseUrl: string;
  private apiKey: string;
  private authToken: string | null = null;
  private eventSource: EventSource | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_SYNAPSO_EVENTS_URL || 'http://localhost:4000/events';
    this.apiKey = process.env.SYNAPSO_API_KEY || '';
  }
  
  /**
   * Set authentication token for connections
   */
  setAuthToken(token: string) {
    this.authToken = token;
    
    // Reconnect if already connected to use the new token
    if (this.isConnected) {
      this.disconnect();
      this.connect();
    }
  }
  
  /**
   * Connect to the Synapso events stream
   */
  connect() {
    if (this.eventSource) {
      return;
    }
    
    const url = new URL(this.baseUrl);
    url.searchParams.append('apiKey', this.apiKey);
    
    if (this.authToken) {
      url.searchParams.append('token', this.authToken);
    }
    
    this.eventSource = new EventSource(url.toString());
    
    this.eventSource.onopen = () => {
      console.log('[SynapsoEventsService] Connected to event stream');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    };
    
    this.eventSource.onerror = (error) => {
      console.error('[SynapsoEventsService] Error connecting to event stream:', error);
      this.isConnected = false;
      this.eventSource?.close();
      this.eventSource = null;
      
      // Attempt to reconnect with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        console.log(`[SynapsoEventsService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
        
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, delay);
      }
    };
    
    this.eventSource.addEventListener('message', (e) => {
      try {
        const event = JSON.parse(e.data) as RealTimeEvent;
        this.handleEvent(event);
      } catch (error) {
        console.error('[SynapsoEventsService] Error parsing event data:', error, e.data);
      }
    });
  }
  
  /**
   * Disconnect from the Synapso events stream
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log('[SynapsoEventsService] Disconnected from event stream');
    }
  }
  
  /**
   * Subscribe to events by type
   */
  on(eventType: string, handler: EventHandler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    this.eventHandlers.get(eventType)!.add(handler);
    
    // Connect if not already connected
    if (!this.isConnected) {
      this.connect();
    }
    
    return () => this.off(eventType, handler);
  }
  
  /**
   * Unsubscribe from events by type
   */
  off(eventType: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
    
    // Disconnect if no more handlers
    if (this.eventHandlers.size === 0) {
      this.disconnect();
    }
  }
  
  /**
   * Handle incoming events and dispatch to registered handlers
   */
  private handleEvent(event: RealTimeEvent) {
    const { event: eventData } = event;
    
    // Call handlers for this specific event type
    const typeHandlers = this.eventHandlers.get(eventData.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('[SynapsoEventsService] Error in event handler:', error);
        }
      });
    }
    
    // Call handlers for wildcard events
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('[SynapsoEventsService] Error in wildcard event handler:', error);
        }
      });
    }
  }
}

// Export singleton instance
export const synapsoEvents = new SynapsoEventsService(); 