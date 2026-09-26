import client from './client.js';

// GET /api/members/next-id -> { memberId } e.g. "PIC-2026-02-0001"
export async function getNextMemberId() {
  const { data } = await client.get('/members/next-id');
  return data.memberId;
}