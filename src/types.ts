// src/types.ts
export interface Model {
  id: number;
  display_name: string;
  docker_image: string;
  container_name: string;
  port: string
}

interface DockerStatusResponse {
  isRunning: boolean;
}

export interface authConfig {
  username: string;
  password: string;
  serverAddress: string;
}

interface DockerStartResponse {
  success: boolean;
  message: string;
}

export type ContainerStatus = 
  | 'not_installed' 
  | 'installing' 
  | 'installed' 
  | 'starting' 
  | 'running' 
  | 'stopping' 
  | 'error';

export interface ContainerStatusResponse {
  status: ContainerStatus;
  message?: string;
}

// Define the window.api interface
declare global {
  interface Window {
    api: {
      fetchModels: () => Promise<Model[]>;
      checkModelStatus: (dockerImage: string, containerName: string) => Promise<ContainerStatusResponse>;
      installModel: (dockerImage: string, authConfig: authConfig) => Promise<string>;
      runModel: (model: Model) => Promise<string>;
      stopModel: (model: Model) => Promise<string>;
      // Add any other existing API methods here
      send: (channel: string, data: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;

        // Docker status and startup
      checkDockerStatus: () => Promise<DockerStatusResponse>;
      startDocker: () => Promise<DockerStartResponse>;
    };
  }
}