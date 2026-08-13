import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/nostr/activity
 * Get user's activity (boosts, shares, follows)
 * Query: ?userId=string (optional, defaults to current user), ?limit=number, ?offset=number
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currentUserId = requireUser(request);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // No ?userId= override. It used to let any caller read any account's rows
    // by passing a hex pubkey, which is public information.
    const userId = currentUserId;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID required',
        },
        { status: 400 }
      );
    }

    // Get boosts
    const boosts = await prisma.boostEvent.findMany({
      where: { userId },
      include: {
        User: {
          select: {
            id: true,
            nostrNpub: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Get shares
    const shares = await prisma.nostrPost.findMany({
      where: {
        userId,
        kind: 1, // Text notes
        OR: [{ trackId: { not: null } }, { feedId: { not: null } }],
      },
      include: {
        User: {
          select: {
            id: true,
            nostrNpub: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Get follows
    const follows = await prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        User_Follow_followingIdToUser: {
          select: {
            id: true,
            nostrNpub: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Combine and sort by date
    const activities = [
      ...boosts.map(boost => ({
        type: 'boost',
        id: boost.id,
        createdAt: boost.createdAt,
        data: boost,
      })),
      ...shares.map(share => ({
        type: 'share',
        id: share.id,
        createdAt: share.createdAt,
        data: share,
      })),
      ...follows.map(follow => ({
        type: 'follow',
        id: follow.id,
        createdAt: follow.createdAt,
        data: follow,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({
      success: true,
      data: activities.slice(0, limit),
      count: activities.length,
    });
  } catch (error) {
    console.error('Get activity error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get activity',
      },
      { status: 500 }
    );
  }
}

