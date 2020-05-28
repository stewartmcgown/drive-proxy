import { google } from 'googleapis';
import { Stream, Readable } from 'stream';
import { get, add } from './cache';

const cachedJWTClient = {
  jwtClient: null,
  created: new Date(0),
};

export const getAuth = async (): Promise<
  InstanceType<typeof google.auth.JWT>
> => {
  if (
    !cachedJWTClient.jwtClient ||
    Date.now() - cachedJWTClient.created.getTime() > 60000
  ) {
    const privatekey = JSON.parse(
      Buffer.from(process.env.GOOGLE_PRIVATE_KEY, 'base64').toString('ascii'),
    );

    const jwtClient = new google.auth.JWT(
      privatekey.client_email,
      null,
      privatekey.private_key,
      ['https://www.googleapis.com/auth/drive'],
    );

    await jwtClient.authorize();

    cachedJWTClient.created = new Date();
    cachedJWTClient.jwtClient = jwtClient;

    return jwtClient;
  }

  return cachedJWTClient.jwtClient;
};

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
  const auth = await getAuth();
  google.options({
    auth,
  });

  const cached = get(path);
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

  console.log(path);

  if (path !== '' && !cached) {
    // Attempt to find a cached entrypoint
    let i = parts.length;
    for (; i > 0; i--) {
      const subpath = parts.slice(0, i + 1).join('/');
      const cachedPart = get(subpath);
      if (cachedPart) {
        file = cachedPart;
        break;
      }
    }

    if (file) {
      console.log(`Cache matched ${i + 1}/${parts.length} parts of path`);
    }

    // Didn't find deeply nested
    for (; i < parts.length; i++) {
      const part = decodeURI(parts[i]);
      const subpath = parts.slice(0, i + 1).join('/');
      const cachedPart = get(subpath);

      const match =
        cachedPart ??
        (
          await files.list({
            q: `'${file.id}' in parents and name = '${part}'`,
            pageSize: 1000,
            fields: 'files(id,mimeType,name,size)',
          })
        ).data.files[0];

      if (!match) throw new Error('404 Not Found');

      if (!cachedPart) {
        resolves++;
        add(subpath, cachedPart);
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
  }

  resolves++;

  res.setHeader('X-Drive-Cache-Status', cached ? 'HIT' : 'MISS');
  res.setHeader('X-Drive-API-Calls', resolves);

  if (file.mimeType === 'application/vnd.google-apps.folder') {
    const result = await files.list({
      q: `'${file.id}' in parents`,
      pageSize: 1000,
      fields: 'files(id,mimeType,name,size,modifiedTime)',
    });

    return Readable.from(
      `<h1>/${path}</h1><table><thead><th>Name</th><th>Modified</th><th>Size</th></thead><tbody>` +
        (path !== '/' ? '<tr><td><a href=""/>..</a></td></tr>' : '') +
        result.data.files
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

    const stream = await files.get(
      {
        fileId: file.id,
        alt: 'media',
      },
      { responseType: 'stream' },
    );

    return stream.data as Stream;
  }
};
