import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

type SearchScope = 'all' | 'users' | 'groups' | 'posts';

type SectionCursor = {
  score: number;
  createdAt: string;
  id: string;
};

interface SearchUserItem {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  relevanceScore: number;
}

interface SearchGroupItem {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  relevanceScore: number;
}

interface SearchPostItem {
  id: string;
  authorId: string;
  groupId: string | null;
  content: string;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  relevanceScore: number;
}

export interface SearchResponse {
  query: string;
  users: SearchUserItem[];
  groups: SearchGroupItem[];
  posts: SearchPostItem[];
  pageInfo: {
    usersNextCursor: string | null;
    groupsNextCursor: string | null;
    postsNextCursor: string | null;
  };
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: SearchQueryDto): Promise<SearchResponse> {
    const q = query.q.trim();
    const normalizedQuery = q.toLowerCase();
    const take = query.limit ?? 10;
    const scope: SearchScope = query.scope ?? 'all';

    if (!q) {
      return {
        query: q,
        users: [],
        groups: [],
        posts: [],
        pageInfo: {
          usersNextCursor: null,
          groupsNextCursor: null,
          postsNextCursor: null,
        },
      };
    }

    const shouldSearchUsers = scope === 'all' || scope === 'users';
    const shouldSearchGroups = scope === 'all' || scope === 'groups';
    const shouldSearchPosts = scope === 'all' || scope === 'posts';

    const [usersRaw, groupsRaw, postsRaw] = await Promise.all([
      shouldSearchUsers
        ? this.prisma.user.findMany({
            where: {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                {
                  profile: {
                    displayName: { contains: q, mode: 'insensitive' },
                  },
                },
              ],
            },
            include: {
              profile: true,
            },
            orderBy: [
              {
                createdAt: 'desc',
              },
              {
                id: 'desc',
              },
            ],
            take: 200,
          })
        : Promise.resolve([]),
      shouldSearchGroups
        ? this.prisma.group.findMany({
            where: {
              AND: [
                {
                  organization: {
                    members: {
                      some: {
                        userId,
                      },
                    },
                  },
                },
                {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } },
                  ],
                },
              ],
            },
            orderBy: [
              {
                createdAt: 'desc',
              },
              {
                id: 'desc',
              },
            ],
            take: 200,
          })
        : Promise.resolve([]),
      shouldSearchPosts
        ? this.prisma.post.findMany({
            where: {
              AND: [
                {
                  content: {
                    contains: q,
                    mode: 'insensitive',
                  },
                },
                {
                  OR: [
                    {
                      authorId: userId,
                    },
                    {
                      AND: [
                        {
                          groupId: null,
                        },
                        {
                          visibility: 'public',
                        },
                      ],
                    },
                    {
                      AND: [
                        {
                          groupId: null,
                        },
                        {
                          visibility: 'followers',
                        },
                        {
                          author: {
                            followers: {
                              some: {
                                followerId: userId,
                              },
                            },
                          },
                        },
                      ],
                    },
                    {
                      group: {
                        members: {
                          some: {
                            userId,
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
            include: {
              author: {
                include: {
                  profile: true,
                },
              },
            },
            orderBy: [
              {
                createdAt: 'desc',
              },
              {
                id: 'desc',
              },
            ],
            take: 300,
          })
        : Promise.resolve([]),
    ]);

    const rankedUsers = usersRaw
      .map((item) => {
        const displayName = item.profile?.displayName ?? 'Unknown';
        return {
          id: item.id,
          displayName,
          avatarUrl: item.profile?.avatarUrl ?? null,
          email: item.email,
          createdAt: item.createdAt.toISOString(),
          relevanceScore: this.scoreTextMatch(normalizedQuery, displayName, item.email),
        };
      })
      .sort((a, b) => this.compareRankedItems(a, b));

    const rankedGroups = groupsRaw
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        organizationId: item.organizationId,
        createdAt: item.createdAt.toISOString(),
        relevanceScore: this.scoreTextMatch(normalizedQuery, item.name, item.description ?? ''),
      }))
      .sort((a, b) => this.compareRankedItems(a, b));

    const rankedPosts = postsRaw
      .map((item) => ({
        id: item.id,
        authorId: item.authorId,
        groupId: item.groupId,
        content: item.content,
        createdAt: item.createdAt.toISOString(),
        author: {
          id: item.author.id,
          displayName: item.author.profile?.displayName ?? 'Unknown',
          avatarUrl: item.author.profile?.avatarUrl ?? null,
        },
        relevanceScore: this.scoreTextMatch(normalizedQuery, item.content),
      }))
      .sort((a, b) => this.compareRankedItems(a, b));

    const usersPage = this.paginateRankedSection(rankedUsers, query.usersCursor, take);
    const groupsPage = this.paginateRankedSection(rankedGroups, query.groupsCursor, take);
    const postsPage = this.paginateRankedSection(rankedPosts, query.postsCursor, take);

    return {
      query: q,
      users: usersPage.items.map((item) => ({
        id: item.id,
        displayName: item.displayName,
        avatarUrl: item.avatarUrl,
        email: item.email,
        relevanceScore: item.relevanceScore,
      })),
      groups: groupsPage.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        organizationId: item.organizationId,
        relevanceScore: item.relevanceScore,
      })),
      posts: postsPage.items.map((item) => ({
        id: item.id,
        authorId: item.authorId,
        groupId: item.groupId,
        content: item.content,
        createdAt: item.createdAt,
        author: item.author,
        relevanceScore: item.relevanceScore,
      })),
      pageInfo: {
        usersNextCursor: usersPage.nextCursor,
        groupsNextCursor: groupsPage.nextCursor,
        postsNextCursor: postsPage.nextCursor,
      },
    };
  }

  private scoreTextMatch(query: string, ...candidates: string[]): number {
    const normalizedCandidates = candidates
      .map((candidate) => candidate.toLowerCase())
      .filter((candidate) => candidate.length > 0);

    if (normalizedCandidates.some((candidate) => candidate === query)) {
      return 500;
    }

    if (normalizedCandidates.some((candidate) => candidate.startsWith(query))) {
      return 400;
    }

    if (normalizedCandidates.some((candidate) => candidate.includes(query))) {
      return 300;
    }

    return 100;
  }

  private compareRankedItems(
    a: {
      relevanceScore: number;
      createdAt: string;
      id: string;
    },
    b: {
      relevanceScore: number;
      createdAt: string;
      id: string;
    },
  ): number {
    if (a.relevanceScore !== b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }

    const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return b.id.localeCompare(a.id);
  }

  private parseCursor(cursor: string | undefined): SectionCursor | null {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded) as SectionCursor;
      if (
        typeof parsed.score !== 'number' ||
        typeof parsed.createdAt !== 'string' ||
        typeof parsed.id !== 'string'
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private encodeCursor(cursor: SectionCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');
  }

  private isAfterCursor(
    item: {
      relevanceScore: number;
      createdAt: string;
      id: string;
    },
    cursor: SectionCursor,
  ): boolean {
    if (item.relevanceScore !== cursor.score) {
      return item.relevanceScore < cursor.score;
    }

    const itemDate = new Date(item.createdAt).getTime();
    const cursorDate = new Date(cursor.createdAt).getTime();
    if (itemDate !== cursorDate) {
      return itemDate < cursorDate;
    }

    return item.id.localeCompare(cursor.id) < 0;
  }

  private paginateRankedSection<T extends { id: string; createdAt: string; relevanceScore: number }>(
    items: T[],
    cursorValue: string | undefined,
    take: number,
  ): {
    items: T[];
    nextCursor: string | null;
  } {
    const cursor = this.parseCursor(cursorValue);
    const filtered = cursor ? items.filter((item) => this.isAfterCursor(item, cursor)) : items;

    const pageItems = filtered.slice(0, take);
    const last = pageItems[pageItems.length - 1];
    const hasMore = filtered.length > take;

    return {
      items: pageItems,
      nextCursor:
        hasMore && last
          ? this.encodeCursor({
              score: last.relevanceScore,
              createdAt: last.createdAt,
              id: last.id,
            })
          : null,
    };
  }
}
