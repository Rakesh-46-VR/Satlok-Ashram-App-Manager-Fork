import { ipcRenderer, contextBridge } from 'electron'
import { authConfig

 } from '../src/types'
// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

contextBridge.exposeInMainWorld('api', {
  // Docker container management
  fetchModels: () => ipcRenderer.invoke('fetch-models'),
  checkModelStatus: (dockerImage: string, containerName : string) => ipcRenderer.invoke('check-model-status', dockerImage, containerName),
  installModel: (dockerImage: string, authConfig: authConfig) => ipcRenderer.invoke('install-model', dockerImage, authConfig),
  runModel: (model: string) => ipcRenderer.invoke('run-model', model),
  stopModel: (model: string) => ipcRenderer.invoke('stop-model', model),

  checkDockerStatus: () => ipcRenderer.invoke('check-docker-status'),
  startDocker: () => ipcRenderer.invoke('start-docker'),
})