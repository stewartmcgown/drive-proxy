import { drive_v3 as DriveV3 } from 'googleapis';

interface CacheEntry {
  file: DriveV3.Schema$File;
  children: DriveV3.Schema$File[] | null;
  created: Date;
  data: Buffer | null;
}

const MAX_AGE = process.env.CACHE_MAX_AGE ?? 10000;

/**
 * A cache which maps file paths to Drive Ids
 */
const cache: { [path: string]: CacheEntry } = {};

export const get = (path: string): CacheEntry | null => {
  if (!path) return null;
  const entry = cache[path];

  if (!entry) {
    console.log(`[MISS] ${path}`);
    return null;
  }

  console.log(`[HIT] ${path} --> ${entry.file.id}`);

  if (Date.now() - entry.created.getTime() > MAX_AGE) {
    delete cache[path];
    return null;
  }

  return entry;
};

export const add = (
  path: string,
  file: DriveV3.Schema$File,
  children: DriveV3.Schema$File[] = null,
  data: Buffer = null,
): void => {
  if (path && file)
    cache[path] = {
      file,
      created: new Date(),
      children,
      data,
    };
};
