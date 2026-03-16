import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

interface SearchUserItem {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
}

interface SearchGroupItem {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
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
}

export interface SearchResponse {
  query: string;
  users: SearchUserItem[];
  groups: SearchGroupItem[];
  posts: SearchPostItem[];
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: SearchQueryDto): Promise<SearchResponse> {
    const q = query.q.trim();
    const take = query.limit ?? 10;

    if (!q) {
      return {
        query: q,
        users: [],
        groups: [],
        posts: [],
      };
    }

    const [users, groups, posts] = await Promise.all([
      this.prisma.user.findMany({
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
        orderBy: {
          createdAt: 'desc',
        },
        take,
      }),
      this.prisma.group.findMany({
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
        orderBy: {
          createdAt: 'desc',
        },
        take,
      }),
      this.prisma.post.findMany({
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
                { authorId: userId },
                { visibility: 'public' },
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
        orderBy: {
          createdAt: 'desc',
        },
        take,
      }),
    ]);

    return {
      query: q,
      users: users.map((item) => ({
        id: item.id,
        displayName: item.profile?.displayName ?? 'Unknown',
        avatarUrl: item.profile?.avatarUrl ?? null,
        email: item.email,
      })),
      groups: groups.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        organizationId: item.organizationId,
      })),
      posts: posts.map((item) => ({
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
      })),
    };
  }
}
