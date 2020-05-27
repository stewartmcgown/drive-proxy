import { google } from 'googleapis';
import * as privatekey from '../service-account.json';
import { Stream, Readable } from 'stream';

export const getAuth = () => {
  const jwtClient = new google.auth.JWT(
    privatekey.client_email,
    null,
    privatekey.private_key,
    [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/calendar',
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
      fields: 'files(id,mimeType,name, size)'
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
        fields: 'id,mimeType,name,size'
      });

    return Readable.from('<div>' + result.data.files.map(f => `<h1>${f.name}</h1>`).join(' ') + '</div>')
  } else {
  const res = await files.get({
      fileId: file.id,
      alt: 'media'
  },     { responseType: 'stream' }
  )

  return res.data as Stream}
};
