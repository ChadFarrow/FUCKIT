import { NextResponse } from 'next/server';
import { ingestV4vTags } from '@/lib/v4v-tags-ingest';
import { isV4VTagsEnabled } from '@/lib/flags';

export const dynamic = 'force-dynamic';
// v4vmusic /items/bytag is slow (30s+ per popular tag). 200 tags @ 3-parallel @ 90s = up to ~100 min worst case.
export const maxDuration = 1800;

// Optional bearer-token gate: set CRON_SECRET in env to require it.
function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${expected}`;
}

async function run(request: Request) {
  if (!isV4VTagsEnabled()) {
    return NextResponse.json({ error: 'v4v tags feature disabled (set V4V_TAGS_ENABLED=true after running add_v4v_tags migration)' }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

  try {
    const result = await ingestV4vTags({ limit });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('v4v ingest failed:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
