import { app, BrowserWindow ,ipcMain, dialog } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import * as os from 'node:os'
import { v4 as uuidv4 } from 'uuid'
import { authConfig } from '../src/types'
import * as fs from 'fs/promises'
import winston from 'winston'
import * as fslog from 'fs'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './db'
import { checkCudaRequirements } from '../src/utils/cuda-utils'

// Create logs directory in temp folder
const logDir = path.join(os.tmpdir(), 'docker-logs')
if (!fslog.existsSync(logDir)) {
  fslog.mkdirSync(logDir, { recursive: true })
}

// Configure the logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'electron-app' },
  transports: [
    // Write to temp log files
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
})

// If not in production, also log to console
if (import.meta.env.VITE_ENVIRONMENT !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }))
}

const execAsync = promisify(exec)
// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const isDevelopment = import.meta.env.VITE_ENVIRONMENT === 'development'

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL && isDevelopment) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// In your main.ts file
let isDevToolsEnabled = import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'

// Listen for a special key combination
app.on('browser-window-created', (_, window) => {
  window.webContents.on('before-input-event', (event, input) => {
    // Enable DevTools with Ctrl+Shift+Alt+D (or Cmd+Shift+Option+D on macOS)
    if (input.control && input.shift && input.alt && input.key === 'd') {
      isDevToolsEnabled = !isDevToolsEnabled
      
      if (isDevToolsEnabled) {
        window.webContents.openDevTools()
      } else {
        window.webContents.closeDevTools()
      }
      
      // Prevent the key event from being handled further
      event.preventDefault()
    }
  })
  
  // Only close DevTools if they're not explicitly enabled
  if (!isDevToolsEnabled) {
    window.webContents.on('devtools-opened', () => {
      window.webContents.closeDevTools()
    })
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

async function isDockerRunning() {
  try {
    await execAsync('docker info')
    return true
  } catch (error) {
    return false
  }
}

// Function to start Docker based on the operating system
async function startDocker() {
  const platform = os.platform()
  
  try {
    if (platform === 'win32') {
      // Windows: Start Docker Desktop
      await execAsync('start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"')
      return { success: true, message: 'Docker Desktop is starting. Please wait...' }
    } 
    else if (platform === 'darwin') {
      // macOS: Start Docker Desktop
      await execAsync('open -a "Docker Desktop"')
      return { success: true, message: 'Docker Desktop is starting. Please wait...' }
    } 
    else if (platform === 'linux') {
      // Linux: Start Docker service
      // This requires sudo, which might prompt for password
      // Consider using a more secure approach in production
      await execAsync('sudo systemctl start docker')
      return { success: true, message: 'Docker service is starting. Please wait...' }
    } 
    else {
      return { 
        success: false, 
        message: `Unsupported platform: ${platform}. Please start Docker manually.` 
      }
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to start Docker: ${(error as Error).message}. Please start Docker manually.` 
    }
  }
}
// Function to wait for Docker to be ready
async function waitForDocker(maxAttempts = 30, delayMs = 1000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (await isDockerRunning()) {
      return true
    }
    
    // Wait before trying again
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  
  return false
}

async function pullDockerImage(dockerImage: string, authConfig: authConfig | null) {
  // Create a unique temporary file for Docker login
  const tempDir = os.tmpdir()
  const tempPasswordFile = path.join(tempDir, `docker-pwd-${uuidv4()}`)
  
  logger.info(`Starting pull process for image: ${dockerImage}`)
  
  try {
    // Check if Docker is running
    try {
      logger.debug('Checking if Docker is running')
      const { stdout } = await execAsync('docker info')
      if (!stdout) throw new Error('Docker is not running')
    } catch (error) {
      logger.error('Docker is not running or not accessible', { error })
      throw new Error('Docker is not running or not accessible')
    }
    
    // If authentication is provided, log in first
    if (authConfig && authConfig.username && authConfig.password) {
      const { username, password, serverAddress = '' } = authConfig
      logger.info(`Authenticating to registry ${serverAddress || 'Docker Hub'} as ${username}`)
      
      try {
        // Write password to temporary file with secure permissions
        logger.debug('Writing temporary password file')
        await fs.writeFile(tempPasswordFile, password, { mode: 0o600 })
        
        // Login to Docker registry
        logger.debug(`Logging in to Docker registry: ${serverAddress || 'Docker Hub'}`)
        const loginCmd = `echo ${password} | docker login ${serverAddress} --username ${username} --password-stdin`
        const { stdout: loginOutput, stderr: loginError } = await execAsync(loginCmd)
        
        logger.info(loginOutput)

        if (loginError && !loginError.includes('Login Succeeded')) {
          logger.error('Docker login failed', { error: loginError })
          throw new Error(`Docker login failed: ${loginError}`)
        }
        
        logger.info('Docker login successful')
      } catch (loginError) {
        logger.error('Authentication failed', { 
          error: loginError instanceof Error ? loginError.message : String(loginError),
          registry: serverAddress || 'Docker Hub',
          username
        })
        throw new Error(`Authentication failed: ${(loginError as Error).message}`)
      }
    }
    
    // Pull the Docker image
    logger.info(`Pulling Docker image: ${dockerImage}`)
    const { stdout, stderr } = await execAsync(`docker pull ${dockerImage}`)
    
    // Log the output for debugging
    if (stdout) logger.debug('Docker pull stdout', { stdout })
    if (stderr) logger.debug('Docker pull stderr', { stderr })
    
    // Check for errors in stderr that aren't progress messages
    if (stderr && 
        !stderr.includes('Downloaded') && 
        !stderr.includes('already up to date') && 
        !stderr.includes('Pulling from') &&
        !stderr.includes('Digest:') &&
        !stderr.includes('Status:')) {
      logger.error('Error in Docker pull stderr', { stderr })
      throw new Error(stderr)
    }
    
    logger.info(`Successfully pulled image: ${dockerImage}`)
    return `Successfully installed ${dockerImage}`
  } catch (error) {
    logger.error(`Error during Docker pull operation for ${dockerImage}`, { 
      error: error instanceof Error ? { 
        message: error.message,
        stack: error.stack
      } : String(error)
    })

    if(error instanceof Error){
      // Provide more specific error messages
      if (error.message.includes('authentication required')) {
        logger.error('Authentication required for registry', { dockerImage })
        throw new Error('Authentication required for this registry. Please provide valid credentials.')
      } else if (error.message.includes('unauthorized')) {
        logger.error('Invalid credentials or insufficient permissions', { dockerImage })
        throw new Error('Invalid credentials or insufficient permissions to pull this image.')
      } else if (error.message.includes('not found')) {
        logger.error('Image not found', { dockerImage })
        throw new Error(`Image not found: ${dockerImage}. Please check the image name and try again.`)
      } else {
        throw error
      }
    }
  } finally {
    // Cleanup: Always try to remove the temporary password file
    try {
      logger.debug('Removing temporary password file')
      await fs.unlink(tempPasswordFile)
      logger.debug('Temporary password file removed successfully')
    } catch (unlinkError) {
      logger.debug('No temporary password file to remove or error removing it', {
        error: unlinkError instanceof Error ? unlinkError.message : String(unlinkError)
      })
    }
    
    // Logout if we logged in
    if (authConfig && authConfig.username) {
      try {
        const serverAddress = authConfig.serverAddress || ''
        logger.info(`Logging out from registry: ${serverAddress || 'Docker Hub'}`)
        await execAsync(`docker logout ${serverAddress}`)
        logger.info('Docker logout successful')
      } catch (logoutError) {
        logger.warn('Docker logout error', {
          error: logoutError instanceof Error ? logoutError.message : String(logoutError),
          registry: authConfig.serverAddress || 'Docker Hub'
        })
      }
    }
  }
}

// Set up IPC handlers for Docker operations
function setupIpcHandlers() {
  // Handler to fetch models
  ipcMain.handle('fetch-models', async () => {
    // In a real app, you would fetch this from a database or API
    try {
        const version = await checkCudaRequirements();
        if(version) {
          const { data , error } = await supabase.from('models').select().eq("cuda_version", version)
          if(error){
            return []
          }else{
            return data
          }
        }
        return []
    } catch (error) {
      return []
    }
  })

  // Handler to check model status
  ipcMain.handle('check-model-status', async (_, dockerImage, containerName) => {
    try {
      // Check if the image exists locally
      const { stdout: imageOutput } = await execAsync(`docker image ls ${dockerImage} --format "{{.Repository}}:{{.Tag}}"`)
      
      if (!imageOutput.trim()) {
        return { status: 'not_installed' }
      }
      
      // Check if a container with this name is running
      const { stdout: containerOutput } = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.ID}}"`)
      
      if (containerOutput.trim()) {
        return { status: 'running' }
      }
      
      return { status: 'installed' }
    } catch (error) {
      logger.error('Error checking model status:', error)
      throw error
    }
  })

  // Handler to install a model with authentication
  ipcMain.handle('install-model', async (_, dockerImage, authConfig = null) => {
    try {
      return await pullDockerImage(dockerImage, authConfig)
    } catch (error) {
      logger.error('Error installing model:', error)
      throw error
    }
  })

  // Handler to run a model with --rm flag and specific container name
  ipcMain.handle('run-model', async (_, model) => {
    try {
      const { docker_image, container_name, port } = model
      
      // First, check if a container with this name already exists (running or stopped)
      try {
        const { stdout: existingContainer } = await execAsync(`docker ps -a --filter "name=${container_name}" --format "{{.ID}}"`)
        
        if (existingContainer.trim()) {
          // Container exists, remove it first
          await execAsync(`docker rm -f ${container_name}`)
        }
      } catch (err) {
        // Ignore errors here, just proceed with creating the container
        logger.info(`No existing container found or error checking: ${(err as Error).message}`)
      }
      
      // Execute docker run command with --rm flag
      const { stdout, stderr } = await execAsync(
        `docker run -d --rm --gpus all --name ${container_name} -p ${port}:7860 -e url=${SUPABASE_URL} -e key=${SUPABASE_ANON_KEY} ${docker_image}`
      )

      logger.info("Stdout ", stdout)
      
      if (stderr && !stderr.includes('Starting')) {
        throw new Error(stderr)
      }
      
      return `Successfully started container ${container_name} for ${docker_image} with auto-removal enabled`
    } catch (error) {
      logger.error('Error running model:', error)
      throw error
    }
  })
  
  // Handler to stop a model
  ipcMain.handle('stop-model', async (_, model) => {
    try {
      const { docker_image, container_name } = model
      logger.info("Stopping ", docker_image)
      // Check if the container is running
      const { stdout: containerRunning } = await execAsync(
        `docker ps --filter "name=${container_name}" --format "{{.ID}}"`
      )
      
      if (!containerRunning.trim()) {
        return `No running container found with name ${container_name}`
      }
      
      // Execute docker stop command
      const { stdout, stderr } = await execAsync(`docker stop ${container_name}`)
      logger.info("Error in docker stop command : ", stdout)

      if (stderr) {
        throw new Error(stderr)
      }
      
      // With --rm flag, the container should be automatically removed after stopping
      return `Successfully stopped container ${container_name}. Container will be automatically removed.`
    } catch (error) {
      logger.error('Error stopping model:', error)
      throw error
    }
  })

  // Handler to check Docker status
  ipcMain.handle('check-docker-status', async () => {
    const isRunning = await isDockerRunning()
    return { isRunning }
  })

  // Handler to start Docker
  ipcMain.handle('start-docker', async () => {
    const isRunning = await isDockerRunning()
    
    if (isRunning) {
      return { success: true, message: 'Docker is already running.' }
    }
    
    // Show a dialog to inform the user
    dialog.showMessageBox({
      type: 'info',
      title: 'Starting Docker',
      message: 'Docker is not running. Attempting to start Docker...',
      buttons: ['OK']
    })
    
    // Try to start Docker
    const startResult = await startDocker()
    
    if (startResult.success) {
      // Wait for Docker to be ready
      const dockerReady = await waitForDocker()
      
      if (dockerReady) {
        return { success: true, message: 'Docker has been started successfully.' }
      } else {
        return { 
          success: false, 
          message: 'Docker was started but is not responding. It might still be initializing.' 
        }
      }
    }
    
    return startResult
  })
}
app.whenReady().then(() => {
  createWindow()
  setupIpcHandlers() // Set up IPC handlers when app is ready
})