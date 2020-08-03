import { google } from 'googleapis';
import { Readable, Stream } from 'stream';
import { getAuth } from './auth';
import { add, get } from './cache';

const humanFileSize = (bytes: number, si = false, dp = 1): string => {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + ' ' + units[u];
};

export const resolvePath = async (path: string, res): Promise<Stream> => {
  const files = google.drive('v3').files;
  await getAuth();

  let cacheStatus: 'MISS' | 'HIT' | 'PARTIAL-HIT' = 'MISS';

  const cached = get(path)?.file;
  const parts = path.split('/');
  let file =
    cached ??
    (
      await files.get({
        fileId: process.env.ROOT_FOLDER_ID,
        fields: 'id,name,mimeType,size',
      })
    ).data;

  let resolves = cached ? 0 : 1;

  if (path !== '' && !cached) {
    // Attempt to find a cached entrypoint
    let i = parts.length;
    for (; i > 0; i--) {
      const subpath = parts.slice(0, i + 1).join('/');
      const cachedPart = get(subpath)?.file;
      if (cachedPart) {
        file = cachedPart;
        break;
      }
    }

    if (file) {
      cacheStatus = 'PARTIAL-HIT';
      console.log(`[PARTIAL-HIT] ${i + 1}/${parts.length}`);
    }

    // Didn't find deeply nested
    for (; i < parts.length; i++) {
      const part = decodeURI(parts[i]);
      const subpath = parts.slice(0, i + 1).join('/');
      const cachedPart = get(subpath);

      const match = cachedPart
        ? cachedPart.file
        : (
            await files.list({
              q: `'${file.id}' in parents and name = '${part}'`,
              pageSize: 1000,
              fields: 'files(id,mimeType,name,size)',
            })
          ).data.files[0];

      if (!match) throw new Error('404 Not Found');

      if (!cachedPart) {
        resolves++;
        add(subpath, match);
      }

      if (i + 1 < parts.length) {
        if (match.mimeType === 'application/vnd.google-apps.folder') {
          file = match;
          continue;
        } else {
          throw new Error('404 Not Found');
        }
      }

      file = match;
    }
  }

  if (!cached) {
    add(path, file);
  } else if (!cacheStatus) {
    cacheStatus = 'HIT';
  }

  resolves++;

  if (file.mimeType === 'application/vnd.google-apps.folder') {
    let result = get(path)?.children;

    if (result) {
      resolves--;
      cacheStatus = 'HIT';
    } else {
      result = (
        await files.list({
          q: `'${file.id}' in parents`,
          pageSize: 1000,
          fields: 'files(id,mimeType,name,size,modifiedTime)',
        })
      ).data.files;
      add(path, file, result);
    }

    res.setHeader('X-Drive-API-Calls', resolves);
    res.setHeader('X-Drive-Cache-Status', cacheStatus);

    return Readable.from(
      `<h1>/${path}</h1><table><thead><th>Name</th><th>Modified</th><th>Size</th></thead><tbody>` +
        (path !== '/' ? '<tr><td><a href=".."/>..</a></td></tr>' : '') +
        result
          .map(
            (f) =>
              `<tr><td><a href="${
                path[0] === '/' || path === '' ? path : '/' + path
              }/${f.name}">${f.name}</a></td><td>${f.modifiedTime}</td><td>${
                f.size ? humanFileSize(Number.parseInt(f.size, 10)) : 0
              }</td></tr>`,
          )
          .join(' ') +
        '</tbody></table>',
    );
  } else {
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);

    const cachedData = get(path);

    if (cachedData?.data) {
      resolves--;
      cacheStatus = 'HIT';
      res.setHeader('X-Drive-Cache-Status', cacheStatus);
      res.setHeader('X-Drive-API-Calls', resolves);
      return Readable.from(cachedData.data);
    }

    res.setHeader('X-Drive-Cache-Status', cacheStatus);
    res.setHeader('X-Drive-API-Calls', resolves);

    const stream = (
      await files.get(
        {
          fileId: file.id,
          alt: 'media',
        },
        { responseType: 'stream' },
      )
    ).data as Stream;

    const fileSize = Number.parseInt(file.size, 10);
    const CACHE_MAX_FILE_SIZE: number = Number.parseInt(
      process.env.CACHE_MAX_FILE_SIZE,
      10,
    );

    if (fileSize < CACHE_MAX_FILE_SIZE) {
      const cacheBuffers: Buffer[] = [];

      stream.addListener('data', (d) => cacheBuffers.push(d));
      stream.addListener('end', () => {
        add(path, file, null, Buffer.concat(cacheBuffers));
        console.log(
          '[CACHE] Committed buffer of size ' + file.size + ' to memory cache',
        );
      });
    } else {
      console.log(
        `[CACHE] Refusing to commit buffer of size ${humanFileSize(
          fileSize,
        )}. Max is ${humanFileSize(CACHE_MAX_FILE_SIZE)}`,
      );
    }

    return stream;
  }
};
