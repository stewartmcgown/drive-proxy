import { drive_v3 as DriveV3, drive_v3, google } from 'googleapis';
import { getAuth } from './auth';

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
export type InvalidateOptions = {
  // eslint-disable-next-line @typescript-eslint/camelcase
  [id: string]: drive_v3.Schema$File;
};

export const invalidate = (entries: InvalidateOptions): void => {
  Object.entries(cache)
    .filter(([, entry]) => entries[entry.file.id])
    .forEach(([path, entry]) => {
      if (entries[entry.file.id].trashed) {
        delete cache[path];
      } else {
        cache[path].data = null;
        cache[path].children = null;
        cache[path].created = new Date(0);
      }
    });
};

(async (): Promise<void> => {
  await getAuth();
  let startPageToken = (await google.drive('v3').changes.getStartPageToken())
    .data.startPageToken;

  setInterval(async () => {
    google.drive('v3').files;
    await getAuth();
    const { data } = await google.drive('v3').changes.list({
      pageToken: startPageToken,
    });

    startPageToken = data.newStartPageToken;

    invalidate(
      data.changes.reduce((a, c) => {
        a[c.fileId] = c.file as any;
        return a;
      }, {} as any),
    );
  }, 15000);
})();
