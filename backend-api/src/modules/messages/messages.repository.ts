import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

const conversationInclude = {
  participants: {
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  },
  messages: {
    take: 1,
    orderBy: {
      createdAt: 'desc' as const,
    },
    include: {
      sender: {
        include: {
          profile: true,
        },
      },
      attachments: {
        orderBy: {
          createdAt: 'asc' as const,
        },
      },
      reactions: {
        orderBy: {
          createdAt: 'asc' as const,
        },
      },
    },
  },
};

const messageInclude = {
  sender: {
    include: {
      profile: true,
    },
  },
  attachments: {
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  reactions: {
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
};

export interface ConversationWithRelations {
  id: string;
  type: string;
  createdAt: Date;
  participants: Array<{
    conversationId: string;
    userId: string;
    role: string;
    joinedAt: Date;
    lastReadMessageId: string | null;
    user: {
      id: string;
      profile: {
        displayName: string;
        avatarUrl: string | null;
      } | null;
    };
  }>;
  messages: Array<{
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    messageType: string;
    createdAt: Date;
    editedAt: Date | null;
    sender: {
      id: string;
      profile: {
        displayName: string;
        avatarUrl: string | null;
      } | null;
    };
    attachments: Array<{
      attachmentId: string;
      mediaType: string;
      mimeType: string;
      fileName: string;
      fileSizeBytes: number;
      storageKey: string;
      publicUrl: string;
      width: number | null;
      height: number | null;
      durationMs: number | null;
      thumbnailKey: string | null;
      createdAt: Date;
    }>;
    reactions: Array<{
      userId: string;
      reactionType: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
}

export interface MessageWithSender {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  messageType: string;
  createdAt: Date;
  editedAt: Date | null;
  sender: {
    id: string;
    profile: {
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
  attachments: Array<{
    attachmentId: string;
    mediaType: string;
    mimeType: string;
    fileName: string;
    fileSizeBytes: number;
    storageKey: string;
    publicUrl: string;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    thumbnailKey: string | null;
    createdAt: Date;
  }>;
  reactions: Array<{
    userId: string;
    reactionType: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countUsersByIds(userIds: string[]): Promise<number> {
    return this.prisma.user.count({
      where: {
        id: {
          in: userIds,
        },
      },
    });
  }

  findDirectConversationBetweenUsers(userAId: string, userBId: string): Promise<ConversationWithRelations | null> {
    return this.prisma.conversation.findFirst({
      where: {
        type: 'direct',
        participants: {
          some: {
            userId: userAId,
          },
        },
        AND: {
          participants: {
            some: {
              userId: userBId,
            },
          },
        },
      },
      include: conversationInclude,
    }) as unknown as Promise<ConversationWithRelations | null>;
  }

  async createConversation(params: {
    createdBy: string;
    type: string;
    participantIds: string[];
  }): Promise<ConversationWithRelations> {
    return this.prisma.conversation.create({
      data: {
        type: params.type,
        createdBy: params.createdBy,
        participants: {
          createMany: {
            data: params.participantIds.map((userId) => ({
              userId,
              role: 'member',
            })),
            skipDuplicates: true,
          },
        },
      },
      include: conversationInclude,
    }) as unknown as Promise<ConversationWithRelations>;
  }

  async listConversationsForUser(params: {
    userId: string;
    before?: Date;
    take: number;
  }): Promise<ConversationWithRelations[]> {
    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: params.userId,
          },
        },
        ...(params.before ? { createdAt: { lt: params.before } } : {}),
      },
      include: conversationInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
    }) as unknown as Promise<ConversationWithRelations[]>;
  }

  async findConversationForUser(conversationId: string, userId: string): Promise<ConversationWithRelations | null> {
    return this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId,
          },
        },
      },
      include: conversationInclude,
    }) as unknown as Promise<ConversationWithRelations | null>;
  }

  async listMessagesForConversation(params: {
    conversationId: string;
    userId: string;
    before?: Date;
    take: number;
  }): Promise<MessageWithSender[]> {
    return this.prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
        conversation: {
          participants: {
            some: {
              userId: params.userId,
            },
          },
        },
        ...(params.before ? { createdAt: { lt: params.before } } : {}),
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
    }) as unknown as Promise<MessageWithSender[]>;
  }

  async createMessage(params: {
    conversationId: string;
    senderId: string;
    body: string;
    messageType: string;
    attachments?: Array<{
      attachmentId: string;
      mediaType: string;
      mimeType: string;
      fileName: string;
      fileSizeBytes: number;
      storageKey: string;
      publicUrl: string;
      width?: number | null;
      height?: number | null;
      durationMs?: number | null;
      thumbnailKey?: string | null;
    }>;
  }): Promise<MessageWithSender> {
    return this.prisma.message.create({
      data: {
        conversation: {
          connect: {
            id: params.conversationId,
          },
        },
        sender: {
          connect: {
            id: params.senderId,
          },
        },
        body: params.body,
        messageType: params.messageType,
        ...(params.attachments?.length
          ? {
              attachments: {
                createMany: {
                  data: params.attachments.map((attachment) => ({
                    attachmentId: attachment.attachmentId,
                    mediaType: attachment.mediaType,
                    mimeType: attachment.mimeType,
                    fileName: attachment.fileName,
                    fileSizeBytes: attachment.fileSizeBytes,
                    storageKey: attachment.storageKey,
                    publicUrl: attachment.publicUrl,
                    ...(attachment.width !== undefined && attachment.width !== null ? { width: attachment.width } : {}),
                    ...(attachment.height !== undefined && attachment.height !== null ? { height: attachment.height } : {}),
                    ...(attachment.durationMs !== undefined && attachment.durationMs !== null
                      ? { durationMs: attachment.durationMs }
                      : {}),
                    ...(attachment.thumbnailKey ? { thumbnailKey: attachment.thumbnailKey } : {}),
                  })),
                },
              },
            }
          : {}),
      },
      include: messageInclude,
    }) as unknown as Promise<MessageWithSender>;
  }

  async markConversationRead(params: {
    conversationId: string;
    userId: string;
    lastReadMessageId: string;
  }): Promise<void> {
    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
      },
      data: {
        lastReadMessageId: params.lastReadMessageId,
      },
    });
  }

  findMessageInConversation(messageId: string, conversationId: string): Promise<{ id: string; createdAt: Date } | null> {
    return this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  findMessageById(
    messageId: string,
  ): Promise<{
    id: string;
    conversationId: string;
    senderId: string;
    createdAt: Date;
  } | null> {
    return this.prisma.message.findUnique({
      where: {
        id: messageId,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        createdAt: true,
      },
    });
  }

  findMessageForConversation(
    messageId: string,
    conversationId: string,
  ): Promise<{
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    createdAt: Date;
    editedAt: Date | null;
  } | null> {
    return this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        body: true,
        createdAt: true,
        editedAt: true,
      },
    });
  }

  updateMessageBody(messageId: string, body: string): Promise<MessageWithSender> {
    return this.prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        body,
        editedAt: new Date(),
      },
      include: messageInclude,
    }) as unknown as Promise<MessageWithSender>;
  }

  async upsertReaction(params: { messageId: string; userId: string; reactionType: string }): Promise<void> {
    await this.prisma.messageReaction.upsert({
      where: {
        messageId_userId: {
          messageId: params.messageId,
          userId: params.userId,
        },
      },
      update: {
        reactionType: params.reactionType,
      },
      create: {
        messageId: params.messageId,
        userId: params.userId,
        reactionType: params.reactionType,
      },
    });
  }

  async removeReaction(params: { messageId: string; userId: string; reactionType?: string }): Promise<number> {
    const result = await this.prisma.messageReaction.deleteMany({
      where: {
        messageId: params.messageId,
        userId: params.userId,
        ...(params.reactionType ? { reactionType: params.reactionType } : {}),
      },
    });

    return result.count;
  }

  listMessageReactions(messageId: string): Promise<Array<{ userId: string; reactionType: string }>> {
    return this.prisma.messageReaction.findMany({
      where: {
        messageId,
      },
      select: {
        userId: true,
        reactionType: true,
      },
    });
  }

  findMessageWithRelations(messageId: string): Promise<MessageWithSender | null> {
    return this.prisma.message.findUnique({
      where: {
        id: messageId,
      },
      include: messageInclude,
    }) as unknown as Promise<MessageWithSender | null>;
  }

  async countUnreadMessagesForUser(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ unreadCount: number }>>`
      SELECT COUNT(m.id)::int AS "unreadCount"
      FROM conversation_participants cp
      JOIN messages m
        ON m.conversation_id = cp.conversation_id
      LEFT JOIN messages lr
        ON lr.id = cp.last_read_message_id
      WHERE cp.user_id = ${userId}::uuid
        AND m.sender_id <> ${userId}::uuid
        AND (cp.last_read_message_id IS NULL OR m.created_at > lr.created_at)
    `;

    return rows[0]?.unreadCount ?? 0;
  }

  async countUnreadMessages(params: {
    conversationId: string;
    userId: string;
    lastReadMessageId: string | null;
  }): Promise<number> {
    if (!params.lastReadMessageId) {
      return this.prisma.message.count({
        where: {
          conversationId: params.conversationId,
          senderId: {
            not: params.userId,
          },
        },
      });
    }

    const lastReadMessage = await this.findMessageInConversation(params.lastReadMessageId, params.conversationId);
    if (!lastReadMessage) {
      return this.prisma.message.count({
        where: {
          conversationId: params.conversationId,
          senderId: {
            not: params.userId,
          },
        },
      });
    }

    return this.prisma.message.count({
      where: {
        conversationId: params.conversationId,
        senderId: {
          not: params.userId,
        },
        createdAt: {
          gt: lastReadMessage.createdAt,
        },
      },
    });
  }

  listParticipantIds(conversationId: string): Promise<Array<{ userId: string }>> {
    return this.prisma.conversationParticipant.findMany({
      where: {
        conversationId,
      },
      select: {
        userId: true,
      },
    });
  }

  async assertParticipant(conversationId: string, userId: string): Promise<boolean> {
    const row = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: {
        userId: true,
      },
    });

    return Boolean(row);
  }
}
