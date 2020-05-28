import { drive_v3 as DriveV3 } from 'googleapis';

interface CacheEntry {
  file: DriveV3.Schema$File;
  created: Date;
}

const MAX_AGE = process.env.CACHE_MAX_AGE ?? 10000;

/**
 * A cache which maps file paths to Drive Ids
 */
const cache: { [path: string]: CacheEntry } = {};

export const get = (path: string): DriveV3.Schema$File | null => {
  if (!path) return null;
  const entry = cache[path];

  if (!entry) {
    console.log(`Cache MISS for ${path}`);
    return null;
  }

  console.log(`Cache HIT for ${path} | id: ${entry.file.id}`);

  if (Date.now() - entry.created.getTime() > MAX_AGE) {
    delete cache[path];
    return null;
  }

  return entry.file;
};

export const add = (path: string, file: DriveV3.Schema$File): void => {
  if (path && file)
    cache[path] = {
      file,
      created: new Date(),
    };
};
