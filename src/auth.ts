import * as dotenv from 'dotenv';
import { google } from 'googleapis';

const cachedJWTClient = {
  jwtClient: null,
  created: new Date(0),
};

export const getAuth = async (): Promise<
  InstanceType<typeof google.auth.JWT>
> => {
  if (!process.env.GOOGLE_PRIVATE_KEY) {
    dotenv.config();
  }
  if (
    !cachedJWTClient.jwtClient ||
    Date.now() - cachedJWTClient.created.getTime() > 60000
  ) {
    console.log('[AUTH] Refreshing JWT Client');
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
  }

  google.options({
    auth: cachedJWTClient.jwtClient,
  });

  return cachedJWTClient.jwtClient;
};
