import { CurrentUser, SignupRole } from '../types/user';
import { api, SessionResponse } from './client';

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: SignupRole;
}

export type SignupResponse =
  ({ status: 'active' } & SessionResponse) | { status: 'pending_approval'; user: CurrentUser };

export async function signup(input: SignupInput): Promise<SignupResponse> {
  const { data } = await api.post<SignupResponse>('/auth/signup', input);
  return data;
}

export async function login(email: string, password: string): Promise<SessionResponse> {
  const { data } = await api.post<SessionResponse>('/auth/login', { email, password });
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
