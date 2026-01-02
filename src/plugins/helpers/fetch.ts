import { getUserAgent } from '@hooks/persisted/useUserAgent';
import NativeFile from '@specs/NativeFile';
import { parse as parseProto } from 'protobufjs';
import { CookieManager } from '@services/network/CookieManager';
import { CloudflareDetector } from '@services/network/CloudflareDetector';
import { CloudflareBypass } from '@services/network/CloudflareBypass';

type FetchInit = {
  headers?: Record<string, string> | Headers;
  method?: string;
  body?: FormData | string;
  [x: string]: string | Record<string, string> | undefined | FormData | Headers;
};

const makeInit = (init?: FetchInit) => {
  const defaultHeaders = {
    'Connection': 'keep-alive',
    'Accept': '*/*',
    'Accept-Language': '*',
    'Sec-Fetch-Mode': 'cors',
    'Accept-Encoding': 'gzip, deflate',
    'Cache-Control': 'max-age=0',
    'User-Agent': getUserAgent(),
  };
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      if (!init.headers.get('User-Agent') && defaultHeaders['User-Agent']) {
        init.headers.set('User-Agent', defaultHeaders['User-Agent']);
      }
    } else {
      init.headers = {
        ...defaultHeaders,
        ...init.headers,
      };
    }
  } else {
    init = {
      ...init,
      headers: defaultHeaders,
    };
  }
  return init;
};

export const fetchApi = async (
  url: string,
  init?: FetchInit,
): Promise<Response> => {
  init = makeInit(init);

  // STEP 1: Inject cookies from CookieManager
  try {
    const storedCookies = await CookieManager.getCookies(url);
    if (Object.keys(storedCookies).length > 0) {
      const cookieString = Object.entries(storedCookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

      if (init.headers instanceof Headers) {
        init.headers.set('Cookie', cookieString);
      } else {
        init.headers = {
          ...init.headers,
          Cookie: cookieString,
        };
      }
    }
  } catch (error) {
    // Silently fail cookie injection - don't block the request
  }

  // STEP 2: Make request
  const response = await fetch(url, init);

  // STEP 3: Check for Cloudflare challenge
  if (CloudflareDetector.isChallenge(response)) {
    try {
      // Attempt automatic bypass
      const bypassResult = await CloudflareBypass.solve({
        url,
        timeout: 30000,
        hidden: true, // Try hidden mode first
        userAgent:
          init.headers instanceof Headers
            ? init.headers.get('User-Agent') || undefined
            : init.headers?.['User-Agent'],
      });

      if (bypassResult.success) {
        // Retry request with new cookies (auto-injected by STEP 1)
        return fetchApi(url, init);
      }
    } catch (error) {
      // Bypass error - fall through to return original response
    }

    // Bypass failed or error - return original response
    // UI layer can detect Cloudflare challenge and offer manual bypass
    return response;
  }

  // STEP 4: Save Set-Cookie headers
  try {
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      const cookies: Record<string, string> = {};

      // Parse Set-Cookie header (can be comma-separated for multiple cookies)
      // Note: This is a simplified parser. Complex cookies with commas in values may need more robust parsing
      setCookieHeader.split(',').forEach(cookieStr => {
        const [nameValue] = cookieStr.split(';');
        if (nameValue) {
          const [name, value] = nameValue.split('=');
          if (name && value) {
            cookies[name.trim()] = value.trim();
          }
        }
      });

      if (Object.keys(cookies).length > 0) {
        await CookieManager.setCookies(url, cookies);
      }
    }
  } catch (error) {
    // Silently fail cookie saving - don't affect the response
  }

  return response;
};

const FILE_READER_PREFIX_LENGTH = 'data:application/octet-stream;base64,'
  .length;

export const downloadFile = async (
  url: string,
  destPath: string,
  init?: FetchInit,
): Promise<void> => {
  init = makeInit(init);
  return NativeFile.downloadFile(
    url,
    destPath,
    init.method || 'get',
    init.headers as Record<string, string>,
    init.body?.toString(),
  );
};

/**
 *
 * @param url
 * @param init
 * @param encoding link: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/encoding
 * @returns plain text
 */
export const fetchText = async (
  url: string,
  init?: FetchInit,
  encoding?: string,
): Promise<string> => {
  init = makeInit(init);
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error();
    }
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onloadend = () => {
        resolve(fr.result as string);
      };
      fr.onerror = () => reject();
      fr.onabort = () => reject();
      fr.readAsText(blob, encoding);
    });
  } catch {
    return '';
  }
};

function base64ToBytesArr(str: string) {
  const abc = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  ]; // base64 alphabet
  const result = [];

  for (let i = 0; i < str.length / 4; i++) {
    const chunk = [...str.slice(4 * i, 4 * i + 4)];
    const bin = chunk
      .map(x => abc.indexOf(x).toString(2).padStart(6, '0'))
      .join('');
    const bytes = bin.match(/.{1,8}/g)?.map(x => +('0b' + x)) || [];
    result.push(
      ...bytes.slice(
        0,
        3 - Number(str[4 * i + 2] === '=') - Number(str[4 * i + 3] === '='),
      ),
    );
  }
  return result;
}

interface ProtoRequestInit {
  // merged .proto file
  proto: string;
  requestType: string;
  requestData?: Record<string, unknown> | unknown[];
  responseType: string;
}

const BYTE_MARK = BigInt((1 << 8) - 1);

export const fetchProto = async function (
  protoInit: ProtoRequestInit,
  url: string,
  init?: FetchInit,
) {
  const protoRoot = parseProto(protoInit.proto).root;
  const RequestMessge = protoRoot.lookupType(protoInit.requestType);
  const requestData = protoInit.requestData;
  if (!requestData) {
    throw new Error('Invalid Proto: requestData is required');
  }
  const verifyResult = RequestMessge.verify(requestData);
  if (verifyResult) {
    throw new Error('Invalid Proto');
  }
  // encode request data
  const encodedrequest = RequestMessge.encode(requestData as any).finish();
  const requestLength = BigInt(encodedrequest.length);
  const headers = new Uint8Array(
    Array(5)
      .fill(0)
      .map((v, idx) => {
        if (idx === 0) {
          return 0;
        }
        return Number((requestLength >> BigInt(8 * (5 - idx - 1))) & BYTE_MARK);
      }),
  );
  init = await makeInit(init);
  const bodyArray = new Uint8Array(headers.length + encodedrequest.length);
  bodyArray.set(headers, 0);
  bodyArray.set(encodedrequest, headers.length);

  return fetch(url, {
    method: 'POST',
    ...init,
    body: bodyArray,
  } as RequestInit)
    .then(r => r.blob())
    .then(blob => {
      // decode response data
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => {
          const payload = new Uint8Array(
            base64ToBytesArr(
              fr.result?.slice(FILE_READER_PREFIX_LENGTH) as string,
            ),
          );
          const length = Number(
            BigInt(payload[1] << 24) |
              BigInt(payload[2] << 16) |
              BigInt(payload[3] << 8) |
              BigInt(payload[4]),
          );
          const ResponseMessage = protoRoot.lookupType(protoInit.responseType);
          resolve(ResponseMessage.decode(payload.slice(5, 5 + length)));
        };
        fr.onerror = () => reject();
        fr.onabort = () => reject();
        fr.readAsDataURL(blob);
      });
    });
};
