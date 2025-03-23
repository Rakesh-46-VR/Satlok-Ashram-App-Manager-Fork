# Docker Container Manager

An Electron-based desktop application for managing Docker containers. This application provides a user-friendly interface to pull Docker images, manage running containers, and monitor Docker resources.

![Application Screenshot](https://upload.wikimedia.org/wikipedia/commons/9/91/Electron_Software_Framework_Logo.svg)

## Features

- **Container Management**: Start, stop, restart, and remove Docker containers
- **Image Management**: Pull, list, and remove Docker images
- **Container Monitoring**: View logs and resource usage of running containers
- **User-friendly Interface**: Intuitive UI for managing Docker operations
- **Cross-platform**: Works on Windows, macOS, and Linux

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)


### Install from Source

#### Clone the repository:
  ```bash
  git clone https://github.com/Rakesh-46-VR/Satlok-Ashram-App-Manager.git
  
  cd docker-container-manager
  ```
#### Install dependencies:
  
  ```bash
  npm install
  ```

#### Build the application:

```shellscript
npm run build
```


#### Start the application:

```shellscript
npm run preview
```

## Usage
### Container Management

1. **View Containers**: The main dashboard displays all running and stopped containers
2. **Start/Stop Containers**: Use the play/stop buttons to control container state
3. **Container Details**: Click on a container to view detailed information and logs

### Image Management

1. **Pull Images**: Pull images from Docker Hub or private registries
