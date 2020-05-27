import { google } from 'googleapis';
import * as privatekey from '../service-account.json';
import { Stream } from 'stream';

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
  let id = process.env.ROOT_FOLDER_ID
  for (let i = 0; i < parts.length; i++) {
    const result = await files.list({
      q: `'${id}' in parents and name = '${parts[i]}'`,
      pageSize: 1000,
      fields: 'files(id,mimeType,name)'
    });

    const match = result.data.files[0];

    if (!match) throw new Error('404 Not Found');

    if ((i + 1) < parts.length) {
        if (match.kind === 'application/vnd.google-apps.folder') {
        id = match.id;
        continue;
        } else {
            throw new Error('404 Not Found')
        }
    }

    id = match.id;
  }

  const res = await files.get({
      fileId: id,
      alt: 'media'
  },     { responseType: 'stream' }
  )

  return res.data as Stream
};
