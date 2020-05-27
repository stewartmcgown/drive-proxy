import { google } from 'googleapis';
import { Stream, Readable } from 'stream';

export const getAuth = () => {
const privatekey = JSON.parse(Buffer.from(process.env.GOOGLE_PRIVATE_KEY, 'base64').toString('ascii'))

  const jwtClient = new google.auth.JWT(
    privatekey.client_email,
    null,
    privatekey.private_key,
    [
      'https://www.googleapis.com/auth/drive',
    ],
  );

  jwtClient.authorize((err) => {
    if (err) {
      console.error(err);
      return;
    } else {
      console.log('Successfully connected!');
    }
  });

  return jwtClient;
};

function humanFileSize(bytes, si=false, dp=1) {
    const thresh = si ? 1000 : 1024;
  
    if (Math.abs(bytes) < thresh) {
      return bytes + ' B';
    }
  
    const units = si 
      ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] 
      : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10**dp;
  
    do {
      bytes /= thresh;
      ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
  
  
    return bytes.toFixed(dp) + ' ' + units[u];
  }
  

export const resolvePath = async (path: string): Promise<Stream> => {
  const files = google.drive('v3').files;
  const auth = await getAuth();
  google.options({
      auth
  });

  const parts = path.split('/');
  let { data: file } = await files.get({ fileId: process.env.ROOT_FOLDER_ID, fields: 'id,name,mimeType,size' })
  console.log(file);
  for (let i = 0; i < parts.length; i++) {
    const result = await files.list({
      q: `'${file.id}' in parents and name = '${parts[i]}'`,
      pageSize: 1000,
      fields: 'files(id,mimeType,name,size)'
    });

    const match = result.data.files[0];

    console.log(match)

    if (!match) throw new Error('404 Not Found');

    if ((i + 1) < parts.length) {
        if (match.mimeType === 'application/vnd.google-apps.folder') {
        file = match;
        continue;
        } else {
            throw new Error('404 Not Found')
        }
    }

    file = match;
  }

  if (file.mimeType === 'application/vnd.google-apps.folder') {
    const result = await files.list({
        q: `'${file.id}' in parents`,
        pageSize: 1000,
        fields: 'files(id,mimeType,name,size,modifiedTime)'
      });

    return Readable.from(`<h1>/${path}</h1><table><thead><th>Name</th><th>Modifier</th><th>Size</th></thead><tbody>` + result.data.files.map(f => `<tr><td><a href="/${path}/${f.name}">${f.name}</a></td><td>${f.modifiedTime}</td><td>${humanFileSize(f.size)}</td></tr>`).join(' ') + '</tbody></table>')
  } else {
  const res = await files.get({
      fileId: file.id,
      alt: 'media'
  },     { responseType: 'stream' }
  )

  return res.data as Stream}
};
