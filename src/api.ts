interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  token?: string | null;
  body?: unknown;
}

export async function apiRequest<T>(
  input: string,
  options: ApiRequestOptions = {}
) {
  const { token, headers, body, ...rest } = options;
  const normalizedHeaders = new Headers(headers);

  if (token) {
    normalizedHeaders.set('Authorization', `Bearer ${token}`);
  }

  const shouldJsonEncode =
    body !== undefined &&
    body !== null &&
    !(body instanceof FormData) &&
    typeof body !== 'string';

  if (shouldJsonEncode) {
    normalizedHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...rest,
    headers: normalizedHeaders,
    body:
      body === undefined
        ? undefined
        : shouldJsonEncode
          ? JSON.stringify(body)
          : (body as BodyInit),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed');
  }

  return payload as T;
}
