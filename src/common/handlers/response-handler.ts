export type ServiceResponseData = {
  message: string;
  accessToken?: string;
} & Record<string, unknown>;

export interface ApiSuccessResponse<T = Record<string, unknown>> {
  statusCode: number;
  status: 'success';
  message: string;
  accessToken?: string;
  data: T;
  meta: {
    timestamp: string;
  };
}

export function buildSuccessResponse<T extends Record<string, unknown>>(
  statusCode: number,
  payload: ServiceResponseData | Record<string, unknown> | null | undefined,
): ApiSuccessResponse<T> {
  if (payload === null || payload === undefined) {
    return {
      statusCode,
      status: 'success',
      message: '',
      data: {} as T,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      statusCode,
      status: 'success',
      message: '',
      data: { result: payload } as unknown as T,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  const record = payload as ServiceResponseData;
  const { message, accessToken, ...data } = record;

  const response: ApiSuccessResponse<T> = {
    statusCode,
    status: 'success',
    message: message ?? '',
    data: data as T,
    meta: { timestamp: new Date().toISOString() },
  };

  if (typeof accessToken === 'string') {
    response.accessToken = accessToken;
  }

  return response;
}
