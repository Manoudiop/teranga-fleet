import { forwardAuth } from '@/server/auth-route';

export function POST(request: Request) {
  return forwardAuth(request, '/auth/login');
}
