import { NextResponse } from 'next/server';
import { clearSession } from '@/server/session';

export function POST() {
  const response = new NextResponse(null, { status: 204 });
  clearSession(response);
  return response;
}
