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
  const entry = cache[path];

  console.log(entry);
  if (!entry) return null;

  if (Date.now() - entry.created.getTime() > MAX_AGE) {
    delete cache[path];
    return null;
  }

  return entry.file;
};

export const add = (path: string, file: DriveV3.Schema$File): void => {
  cache[path] = {
    file,
    created: new Date(),
  };
};
