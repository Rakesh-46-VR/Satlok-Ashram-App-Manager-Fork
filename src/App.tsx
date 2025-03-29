"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Box, Download, Play, Square, AlertCircle, CheckCircle, Loader2, Server, Power } from "lucide-react"
import type { Model, ContainerStatus } from "./types"

interface ModelSelectorProps {
  models: Model[]
  selectedModel: Model | null
  setSelectedModel: (model: Model | null) => void
  isLoading: boolean
}

const SERVER = import.meta.env.VITE_DOCKER_SOURCE;
const ID = import.meta.env.VITE_ID;
const PASSWORD = import.meta.env.VITE_PASSWORD;

function ModelSelector({ models, selectedModel, setSelectedModel, isLoading }: ModelSelectorProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-gray-800">Select Model</h2>
        {isLoading && (
          <div className="flex items-center text-blue-600">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            <span className="text-sm">Loading models...</span>
          </div>
        )}
      </div>

      <div className="relative">
        <select
          value={selectedModel?.id || ""}
          onChange={(e) => {
            const modelId = Number.parseInt(e.target.value, 10)
            const chosen = models.find((m) => m.id === modelId)
            setSelectedModel(chosen || null)
          }}
          className="w-full p-3 pr-10 text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        >
          <option value="">-- Choose a Model --</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.display_name}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>
    </div>
  )
}

interface StatusBadgeProps {
  status: ContainerStatus
}

interface StatusConfig {
  color: string
  icon: React.ReactNode
  text: string
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<ContainerStatus, StatusConfig> = {
    not_installed: {
      color: "bg-gray-100 text-gray-800",
      icon: <Server className="w-4 h-4 mr-1" />,
      text: "Not Installed",
    },
    installing: {
      color: "bg-blue-100 text-blue-800",
      icon: <Loader2 className="w-4 h-4 mr-1 animate-spin" />,
      text: "Installing",
    },
    installed: {
      color: "bg-green-100 text-green-800",
      icon: <CheckCircle className="w-4 h-4 mr-1" />,
      text: "Installed",
    },
    starting: {
      color: "bg-yellow-100 text-yellow-800",
      icon: <Loader2 className="w-4 h-4 mr-1 animate-spin" />,
      text: "Starting",
    },
    running: {
      color: "bg-indigo-100 text-indigo-800",
      icon: <Play className="w-4 h-4 mr-1" />,
      text: "Running",
    },
    stopping: {
      color: "bg-orange-100 text-orange-800",
      icon: <Loader2 className="w-4 h-4 mr-1 animate-spin" />,
      text: "Stopping",
    },
    error: {
      color: "bg-red-100 text-red-800",
      icon: <AlertCircle className="w-4 h-4 mr-1" />,
      text: "Error",
    },
  }

  const config = statusConfig[status] || statusConfig.not_installed

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.icon}
      {config.text}
    </span>
  )
}

interface DockerControlsProps {
  selectedModel: Model | null
}

function DockerControls({ selectedModel }: DockerControlsProps) {
  const [status, setStatus] = useState<ContainerStatus>("not_installed")
  const [message, setMessage] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Reset state when model changes
    setStatus("not_installed")
    setMessage("")
    setError(null)

    // Check if model is already installed/running when selected
    if (selectedModel) {
      checkModelStatus()
    }
  }, [selectedModel])

  if (!selectedModel) {
    return (
      <div className="p-6 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
        <Server className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-600 mb-1">No Model Selected</h3>
        <p className="text-sm text-gray-500">
          Please select a model from the dropdown above to manage its Docker container.
        </p>
      </div>
    )
  }

  async function handleInstall(): Promise<void> {
    setIsLoading(true)
    setStatus("installing")
    setMessage("Installing model...")
    setError(null)
    if (!selectedModel) {
      return
    }
    try {
      const result = await window.api.installModel(selectedModel.docker_image, {
        username: ID,
        password: PASSWORD,
        serverAddress: SERVER
      })
      setStatus("installed")
      setMessage(result)
    } catch (err) {
      setStatus("error")
      setError(`Installation failed: ${(err as Error).message}`)
      setMessage("")
    } finally {
      setIsLoading(false)
    }
  }

  // In your DockerControls component
  async function handleRun(): Promise<void> {
    setIsLoading(true)
    setStatus("starting")
    setMessage("Starting container...")
    setError(null)
    if (!selectedModel) return
    try {
      // Pass the entire model object instead of just the docker_image
      const result = await window.api.runModel(selectedModel)
      setStatus("running")
      if(result){
        const url = `http://localhost:${selectedModel.port}/`
        setMessage(`Running on url ${url}`)
      }
    } catch (err) {
      setStatus("error")
      setError(`Failed to start: ${(err as Error).message}`)
      setMessage("")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStop(): Promise<void> {
    setIsLoading(true)
    setStatus("stopping")
    setMessage("Stopping container...")
    setError(null)
    if (!selectedModel) return
    try {
      // Pass the entire model object
      const result = await window.api.stopModel(selectedModel)
      setStatus("installed")
      setMessage(result)
    } catch (err) {
      setStatus("error")
      setError(`Failed to stop: ${(err as Error).message}`)
      setMessage("")
    } finally {
      setIsLoading(false)
    }
  }

  async function checkModelStatus(): Promise<void> {
    if (!selectedModel) return
    try {
      setIsLoading(true)
      // Pass both docker_image and container_name
      const containerStatus = await window.api.checkModelStatus(
        selectedModel.docker_image,
        selectedModel.container_name,
      )
      setStatus(containerStatus.status)
    } catch (err) {
      setError(`Failed to check status: ${(err as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-800">{selectedModel.display_name}</h2>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 text-sm text-gray-600">{selectedModel.docker_image}</p>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          {status === "not_installed" && (
            <button
              onClick={handleInstall}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Install
            </button>
          )}

          {status === "installed" && (
            <button
              onClick={handleRun}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Run
            </button>
          )}

          {status === "running" && (
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
              Stop
            </button>
          )}

          <button
            onClick={checkModelStatus}
            disabled={isLoading || !selectedModel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Box className="w-4 h-4 mr-2" />}
            Refresh Status
          </button>
        </div>

        {message && <div className="mt-3 p-3 bg-gray-50 rounded-md text-sm text-gray-700">{message}</div>}

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-md flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [dockerStatus, setDockerStatus] = useState<"checking" | "running" | "not-running">("checking")
  const [dockerMessage, setDockerMessage] = useState<string>("")
  const [isStartingDocker, setIsStartingDocker] = useState<boolean>(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  
  // Check Docker status on component mount
  useEffect(() => {
    checkDockerStatus()
  }, [])

  // Regular function to check Docker status
  async function checkDockerStatus() {
    try {
      const { isRunning } = await window.api.checkDockerStatus()
      setDockerStatus(isRunning ? "running" : "not-running")

      if (isRunning) {
        // If Docker is running, fetch models
        fetchModels()
      } else {
        setDockerMessage("Docker is not running. Click the button below to start Docker.")
        setIsLoading(false)
      }
    } catch (err) {
      // logger.error("Failed to check Docker status:", err)
      setDockerStatus("not-running")
      setDockerMessage("Failed to check Docker status. Please ensure Docker is installed.")
      setIsLoading(false)
    }
  }

  // Regular function to start Docker
  async function handleStartDocker() {
    try {
      setIsStartingDocker(true)
      setDockerMessage("Attempting to start Docker...")
      const result = await window.api.startDocker()
      setDockerMessage(result.message)

      if (result.success) {
        setDockerStatus("running")
        // Fetch models after Docker starts successfully
        fetchModels()
      }
    } catch (err) {
      // logger.error("Failed to start Docker:", err)
      setDockerMessage(`Failed to start Docker: ${(err as Error).message}`)
      setIsLoading(false)
    } finally {
      setIsStartingDocker(false)
    }
  }

  // Function to fetch models
  async function fetchModels() {
    try {
      setIsLoading(true)
      const result = await window.api.fetchModels()
      setModels(result)
      setError(null)
    } catch (err) {
      // logger.error("Failed to fetch models:", err)
      setError("Failed to fetch models. Please restart the application.")
    } finally {
      setIsLoading(false)
    }
  }

  // Render Docker status and start button if Docker is not running
  const renderDockerStatus = () => {
    if (dockerStatus === "checking") {
      return (
        <div className="p-6 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-lg text-gray-700">Checking Docker status...</p>
        </div>
      )
    }

    if (dockerStatus === "not-running") {
      return (
        <div className="p-6 border border-yellow-200 rounded-lg bg-yellow-50 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">Docker is not running</h3>
              <p className="text-yellow-700 mb-4">{dockerMessage}</p>
              <button
                onClick={handleStartDocker}
                disabled={isStartingDocker}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStartingDocker ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting Docker...
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4 mr-2" />
                    Start Docker
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )
    }

    return null // Don't show anything if Docker is running
  }

  return (
    <div className="w-full min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <Server className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">App Manager</h1>
            </div>
            <p className="mt-2 text-gray-600">Manage your AI model Docker containers</p>
          </div>

          <div className="p-6">
            {renderDockerStatus()}

            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 mb-6">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span>{error}</span>
                </div>
              </div>
            ) : (
              <>
                {dockerStatus === "running" && (
                  <>
                    <ModelSelector
                      models={models}
                      selectedModel={selectedModel}
                      setSelectedModel={setSelectedModel}
                      isLoading={isLoading}
                    />

                    <DockerControls selectedModel={selectedModel} />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-gray-500">
          <p>Satlok Ashram App Manager v1.0.0 by Satlok Ashram Developers</p>
        </div>
      </div>
    </div>
  )
}

