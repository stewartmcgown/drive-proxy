# drive-proxy
> Reverse proxy for your Google Drive

## Quickstart

Copy .env.example to .env and fill it in. The folder ID should be one of your Drive folders, the private key should be your service account JSON file base64 encoded.

You can create your service account in the Google Developer Console. Make sure you share the folder you plan to use for hosting with the service account.

Run `yarn` and then `yarn start`.

### Deploy with Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/project?template=https://github.com/stewartmcgown/drive-proxy/tree/master)

## Headers

### `X-Drive-API-Calls`
The number of times drive-proxy had to call Google APIs to get the current requests serviced. Will be 1 at best.

### `X-Drive-Cache-Status`
Whether the leaf path of the request was able to be pulled from the in-memory cache.