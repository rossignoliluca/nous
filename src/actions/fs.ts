/**
 * Filesystem Actions
 */

import * as fs from 'fs';
import * as path from 'path';
import { ActionResult } from './index';

/**
 * Read a file
 */
export async function readFile(filePath: string): Promise<ActionResult> {
  try {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    return {
      success: true,
      output: content,
      metadata: {
        path: absolutePath,
        size: content.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error}`,
    };
  }
}

/**
 * Write to a file
 */
export async function writeFile(
  filePath: string,
  content: string,
  options?: { createDirs?: boolean }
): Promise<ActionResult> {
  try {
    const absolutePath = path.resolve(filePath);

    // Create parent directories if needed
    if (options?.createDirs) {
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    fs.writeFileSync(absolutePath, content);
    return {
      success: true,
      output: `Written ${content.length} bytes to ${filePath}`,
      metadata: {
        path: absolutePath,
        size: content.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write file: ${error}`,
    };
  }
}

/**
 * List directory contents
 */
export async function listDir(
  dirPath: string,
  options?: { recursive?: boolean; showHidden?: boolean }
): Promise<ActionResult> {
  try {
    const absolutePath = path.resolve(dirPath);

    if (!fs.existsSync(absolutePath)) {
      return {
        success: false,
        error: `Directory not found: ${dirPath}`,
      };
    }

    const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

    const items = entries
      .filter(entry => options?.showHidden || !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(absolutePath, entry.name),
      }));

    return {
      success: true,
      output: items.map(i => `${i.type === 'directory' ? '📁' : '📄'} ${i.name}`).join('\n'),
      metadata: { items },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list directory: ${error}`,
    };
  }
}

/**
 * Create a directory
 */
export async function createDir(dirPath: string): Promise<ActionResult> {
  try {
    const absolutePath = path.resolve(dirPath);

    if (fs.existsSync(absolutePath)) {
      return {
        success: true,
        output: `Directory already exists: ${dirPath}`,
      };
    }

    fs.mkdirSync(absolutePath, { recursive: true });
    return {
      success: true,
      output: `Created directory: ${dirPath}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create directory: ${error}`,
    };
  }
}

/**
 * Delete a file
 */
export async function deleteFile(filePath: string): Promise<ActionResult> {
  try {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    fs.unlinkSync(absolutePath);
    return {
      success: true,
      output: `Deleted: ${filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to delete file: ${error}`,
    };
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<ActionResult> {
  const absolutePath = path.resolve(filePath);
  const exists = fs.existsSync(absolutePath);

  return {
    success: true,
    output: exists ? 'true' : 'false',
    metadata: { exists, path: absolutePath },
  };
}

/**
 * Get file info
 */
export async function fileInfo(filePath: string): Promise<ActionResult> {
  try {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    const stats = fs.statSync(absolutePath);

    return {
      success: true,
      output: JSON.stringify({
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        created: stats.birthtime,
        modified: stats.mtime,
      }, null, 2),
      metadata: { stats },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get file info: ${error}`,
    };
  }
}
