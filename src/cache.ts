
interface CacheEntry {
    fileId: string;
    created: Date;
}

const MAX_AGE = 10000;

/**
 * A cache which maps file paths to Drive Ids
 */
const cache: {[path: string]: CacheEntry} = {}

export const get = (path: string): string | null => {
    const entry = cache[path];

    if (!entry) return null;

    if (Date.now() - entry.created.getTime() > MAX_AGE) {
        delete cache[path];
        return null;
    }

    return entry.fileId;
}

export const add = () => null