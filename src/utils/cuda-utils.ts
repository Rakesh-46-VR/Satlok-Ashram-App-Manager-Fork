// src/main/utils/cuda-utils.ts
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

interface CudaVersionInfo {
  version: string;
  fullOutput: string;
  driverVersion?: string;
  isInstalled: boolean;
}

/**
 * Gets the installed NVIDIA CUDA version
 * @returns Promise with CUDA version information
 */
export async function getNvidiaCudaVersion(): Promise<CudaVersionInfo> {
  const platform = os.platform();

  // For Windows, use nvidia-smi like in the Python code
  if (platform === "win32") {
    try {
      // First try nvidia-smi to get CUDA version (like the Python code)
      const { stdout: smiOutput } = await execAsync("nvidia-smi");

      // Extract CUDA version using regex similar to the Python code
      const cudaVersionMatch = smiOutput.match(/CUDA Version:\s*([\d.]+)/);

      if (cudaVersionMatch && cudaVersionMatch[1]) {
        // Also get driver version while we're at it
        const driverVersionMatch = smiOutput.match(
          /Driver Version:\s*([\d.]+)/
        );
        const driverVersion = driverVersionMatch
          ? driverVersionMatch[1]
          : undefined;

          console.log(cudaVersionMatch[1], driverVersion)
        return {
          version: cudaVersionMatch[1],
          fullOutput: smiOutput,
          driverVersion,
          isInstalled: true,
        };
      }

      throw Error("Could not find cuda.")
    } catch (error) {
      return {
        version: "Unknown",
        fullOutput: "No output.",
        isInstalled: false,
      };
    }
  }else{
    return {
      version: "Unknown",
      fullOutput: "No output.",
      isInstalled: false,
    };
  }
}

/**
 * Checks if CUDA is installed and meets minimum version requirements
 * @returns Promise<string | null> version if CUDA installed
 */
export async function checkCudaRequirements(): Promise<string | null> {
  try {
    const cudaInfo = await getNvidiaCudaVersion();
    if (!cudaInfo.isInstalled) {
      return null;
    }
    // Compare versions
    const currentVersion = parseFloat(cudaInfo.version);

    if (isNaN(currentVersion)) {
      return null;
    }

    return cudaInfo.version;
  } catch (error) {
    return null;
  }
}
