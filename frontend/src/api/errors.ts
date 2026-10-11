import axios from 'axios';

export interface ApiError {
  status?: number;
  code?: string;
  message: string;
}

interface ErrorBody {
  code?: string;
  message?: string | string[];
}

export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError<ErrorBody>(error)) {
    if (!error.response) {
      return { message: 'Cannot reach the server. Check your connection and try again.' };
    }
    const { status, data } = error.response;
    if (status === 429) {
      return { status, message: 'Too many attempts. Please wait a minute and try again.' };
    }
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return {
      status,
      code: data?.code,
      message: message ?? 'Something went wrong. Please try again.',
    };
  }
  return { message: 'Something went wrong. Please try again.' };
}
