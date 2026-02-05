import AdmZip from "adm-zip";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const TEMP_PREFIX = "loc-counter-";
const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024; // 200MB safeguard
const BINARY_SNIFF_LENGTH = 2048;
const TOP_FILE_LIMIT = 200;

export type CountLinesResult = {
  total_files: number;
  total_lines: number;
  line_counts_by_ext: Record<string, number>;
  file_counts_by_ext: Record<string, number>;
  top_files: { path: string; lines: number }[];
};

class ArchiveError extends Error {}

async function withExtractedArchive<T>(archive: File, handler: (root: string) => Promise<T>): Promise<T> {
  if (archive.size === 0) {
    throw new ArchiveError("Uploaded archive is empty.");
  }

  if (archive.size > MAX_ARCHIVE_BYTES) {
    throw new ArchiveError("Archive exceeds the 200MB limit.");
  }

  const arrayBuffer = await archive.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));

  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      throw new ArchiveError("Archive does not contain any files.");
    }

    for (const entry of entries) {
      const normalized = path.normalize(entry.entryName);

      if (!normalized || normalized === "." || normalized.startsWith("..") || path.isAbsolute(normalized)) {
        throw new ArchiveError("Archive contains unsafe paths.");
      }

      const outputPath = path.join(tempDir, normalized);

      if (!outputPath.startsWith(tempDir)) {
        throw new ArchiveError("Archive contains unsafe paths.");
      }

      if (entry.isDirectory) {
        await fs.mkdir(outputPath, { recursive: true });
        continue;
      }

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      const data = entry.getData();
      await fs.writeFile(outputPath, data);
    }

    return await handler(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function collectFiles(root: string): Promise<string[]> {
  const queue: string[] = [root];
  const files: string[] = [];

  while (queue.length) {
    const current = queue.pop()!;
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

async function isBinaryFile(filePath: string): Promise<boolean> {
  try {
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(BINARY_SNIFF_LENGTH);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytesRead).includes(0);
    } finally {
      await handle.close();
    }
  } catch {
    return true;
  }
}

async function countLinesInFile(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, { encoding: "utf8" });
    if (content.length === 0) {
      return 0;
    }

    const segments = content.match(/\n/g);
    return (segments ? segments.length : 0) + 1;
  } catch {
    return 0;
  }
}

export async function scanExtensionsFromArchive(archive: File): Promise<string[]> {
  return withExtractedArchive(archive, async (root) => {
    const files = await collectFiles(root);
    const extensions = new Set<string>();

    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      if (!ext) {
        continue;
      }

      if (await isBinaryFile(filePath)) {
        continue;
      }

      extensions.add(ext);
    }

    return Array.from(extensions).sort((a, b) => a.localeCompare(b));
  });
}

export async function countLinesFromArchive(archive: File, selectedExtensions: string[]): Promise<CountLinesResult> {
  if (!selectedExtensions.length) {
    throw new ArchiveError("At least one extension must be selected.");
  }

  const allowed = new Set(selectedExtensions.map((ext) => ext.toLowerCase()));

  return withExtractedArchive(archive, async (root) => {
    const files = await collectFiles(root);
    const lineCountsByExt = new Map<string, number>();
    const fileCountsByExt = new Map<string, number>();
    const topFiles: { path: string; lines: number }[] = [];
    let totalLines = 0;
    let totalFiles = 0;

    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      if (!allowed.has(ext)) {
        continue;
      }

      if (await isBinaryFile(filePath)) {
        continue;
      }

      const lines = await countLinesInFile(filePath);
      totalLines += lines;
      totalFiles += 1;

      lineCountsByExt.set(ext, (lineCountsByExt.get(ext) ?? 0) + lines);
      fileCountsByExt.set(ext, (fileCountsByExt.get(ext) ?? 0) + 1);

      topFiles.push({
        path: path.relative(root, filePath) || path.basename(filePath),
        lines,
      });
    }

    topFiles.sort((a, b) => b.lines - a.lines);

    return {
      total_files: totalFiles,
      total_lines: totalLines,
      line_counts_by_ext: Object.fromEntries(
        Array.from(lineCountsByExt.entries()).sort((a, b) => b[1] - a[1]),
      ),
      file_counts_by_ext: Object.fromEntries(
        Array.from(fileCountsByExt.entries()).sort((a, b) => b[1] - a[1]),
      ),
      top_files: topFiles.slice(0, TOP_FILE_LIMIT),
    };
  });
}

export { ArchiveError };
