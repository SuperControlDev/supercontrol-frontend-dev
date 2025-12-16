/**
 * Red5 Pro SDK TypeScript 类型定义
 */

declare global {
  interface Window {
    red5prosdk: Red5ProSDK | any;
    red5proSDKLoaded?: boolean;
    red5proSDKError?: string;
  }
}

export interface Red5ProSubscriberConfig {
  protocol: 'http' | 'https' | 'ws' | 'wss';
  host: string;
  port?: number;
  app: string;
  streamName: string;
  rtcConfiguration?: RTCConfiguration;
  connectionParams?: Record<string, string>;
}

export interface Red5ProSubscriber {
  init(config: Red5ProSubscriberConfig): Promise<void>;
  subscribe(): Promise<void>;
  unsubscribe(): Promise<void>;
  getView(): HTMLVideoElement | null;
  on(event: string, callback: (event: any) => void): void;
  off(event: string, callback?: (event: any) => void): void;
  getType(): string;
}

export interface HLSSubscriber extends Red5ProSubscriber {
  getType(): 'hls';
}

export interface RTCSubscriber extends Red5ProSubscriber {
  getType(): 'rtc';
}

export interface Red5ProSubscriberClass {
  new (): Red5ProSubscriber;
  setPlaybackOrder(order: string[]): Red5ProSubscriberClass;
  init(config: {
    rtc?: Red5ProSubscriberConfig;
    hls?: Red5ProSubscriberConfig;
  }): Promise<void>;
}

export interface WHEPClient {
  init(config: {
    protocol: 'http' | 'https' | 'ws' | 'wss';
    host: string;
    port?: number;
    app: string;
    streamName: string;
    rtcConfiguration?: RTCConfiguration;
    connectionParams?: Record<string, string>;
  }): Promise<void>;
  subscribe(): Promise<void>;
  unsubscribe(): Promise<void>;
  getView(): HTMLVideoElement | null;
  on(event: string, callback: (event: any) => void): void;
  off(event: string, callback?: (event: any) => void): void;
  getType(): 'whep';
}

export interface Red5ProSDK {
  HLSSubscriber: {
    new (): HLSSubscriber;
  };
  RTCSubscriber: {
    new (): RTCSubscriber;
  };
  Red5ProSubscriber: Red5ProSubscriberClass;
  WHEPClient?: {
    new (): WHEPClient;
  };
  WHIPClient?: {
    new (): any; // Publisher용
  };
  version: string;
}

export {};

