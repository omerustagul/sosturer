import { AsyncLocalStorage } from 'async_hooks';

export const requestContext = new AsyncLocalStorage<{
  userId: string;
  userEmail: string;
  fullName: string;
  role: string;
  companyId?: string;
}>();
