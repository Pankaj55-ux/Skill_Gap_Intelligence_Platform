import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  NotificationType,
  Prisma,
  RecordStatus,
  UserRole,
} from "../../generated/prisma/client.js";
import type { ListNotificationsQuery } from "./notification.schemas.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  actorId?: string;
  targetRole?: UserRole;
  metadata?: Prisma.InputJsonValue;
}

const notificationSelect = {
  id: true,
  userId: true,
  title: true,
  message: true,
  type: true,
  read: true,
  targetRole: true,
  createdAt: true,
  metadata: true,
} satisfies Prisma.NotificationSelect;

const auditData = (
  context: AuditContext,
  options: {
    actorId: string;
    userId: string;
    action: string;
    notificationId?: string;
    payload?: Prisma.InputJsonValue;
  },
): Prisma.AuditEventCreateInput => ({
  action: options.action,
  entityType: "Notification",
  entityId: options.notificationId,
  payload: options.payload,
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.actorId,
  updatedBy: options.actorId,
  user: { connect: { id: options.userId } },
  actor: { connect: { id: options.actorId } },
});

const visibilityWhere = (
  user: { id: string; role: UserRole },
): Prisma.NotificationWhereInput => ({
  userId: user.id,
  deletedAt: null,
  status: RecordStatus.ACTIVE,
  OR: [
    { targetRole: null },
    { targetRole: user.role },
  ],
});

const listWhere = (
  user: { id: string; role: UserRole },
  query: ListNotificationsQuery,
): Prisma.NotificationWhereInput => ({
  ...visibilityWhere(user),
  ...(query.unreadOnly ? { read: false } : {}),
  ...(query.type ? { type: query.type } : {}),
  ...(query.search ? {
    AND: [
      {
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { message: { contains: query.search, mode: "insensitive" } },
        ],
      },
    ],
  } : {}),
});

export class NotificationService {
  async create(input: CreateNotificationInput) {
    return database.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        targetRole: input.targetRole,
        metadata: input.metadata,
        createdBy: input.actorId ?? input.userId,
        updatedBy: input.actorId ?? input.userId,
      },
      select: notificationSelect,
    });
  }

  async createForUsers(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) return { count: 0 };

    const result = await database.notification.createMany({
      data: inputs.map((input) => ({
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        targetRole: input.targetRole,
        metadata: input.metadata,
        createdBy: input.actorId ?? input.userId,
        updatedBy: input.actorId ?? input.userId,
      })),
    });

    return { count: result.count };
  }

  async list(
    user: { id: string; role: UserRole },
    query: ListNotificationsQuery,
  ) {
    const where = listWhere(user, query);
    const unreadWhere = {
      ...visibilityWhere(user),
      read: false,
    } satisfies Prisma.NotificationWhereInput;
    const skip = (query.page - 1) * query.limit;

    const [notifications, total, unreadCount] = await database.$transaction([
      database.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      database.notification.count({ where }),
      database.notification.count({ where: unreadWhere }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getById(
    user: { id: string; role: UserRole },
    id: string,
  ) {
    const notification = await database.notification.findFirst({
      where: { id, ...visibilityWhere(user) },
      select: notificationSelect,
    });

    if (!notification) {
      throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found");
    }

    return notification;
  }

  async markRead(
    user: { id: string; role: UserRole },
    id: string,
    context: AuditContext,
  ) {
    const existing = await database.notification.findFirst({
      where: { id, ...visibilityWhere(user) },
      select: { id: true, read: true },
    });

    if (!existing) {
      throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found");
    }

    const notification = await database.$transaction(async (transaction) => {
      const updated = await transaction.notification.update({
        where: { id },
        data: {
          read: true,
          updatedBy: user.id,
        },
        select: notificationSelect,
      });

      await transaction.auditEvent.create({
        data: auditData(context, {
          actorId: user.id,
          userId: user.id,
          action: "notification_marked_read",
          notificationId: id,
        }),
      });

      return updated;
    });

    return notification;
  }

  async markAllRead(
    user: { id: string; role: UserRole },
    context: AuditContext,
  ) {
    const where = {
      ...visibilityWhere(user),
      read: false,
    } satisfies Prisma.NotificationWhereInput;

    const result = await database.$transaction(async (transaction) => {
      const updated = await transaction.notification.updateMany({
        where,
        data: {
          read: true,
          updatedBy: user.id,
        },
      });

      await transaction.auditEvent.create({
        data: auditData(context, {
          actorId: user.id,
          userId: user.id,
          action: "notifications_marked_all_read",
          payload: { count: updated.count },
        }),
      });

      return updated;
    });

    return { updatedCount: result.count };
  }

  async delete(
    user: { id: string; role: UserRole },
    id: string,
    context: AuditContext,
  ) {
    const existing = await database.notification.findFirst({
      where: { id, ...visibilityWhere(user) },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found");
    }

    const notification = await database.$transaction(async (transaction) => {
      const deleted = await transaction.notification.update({
        where: { id },
        data: {
          status: RecordStatus.ARCHIVED,
          deletedAt: new Date(),
          updatedBy: user.id,
        },
        select: notificationSelect,
      });

      await transaction.auditEvent.create({
        data: auditData(context, {
          actorId: user.id,
          userId: user.id,
          action: "notification_deleted",
          notificationId: id,
        }),
      });

      return deleted;
    });

    return notification;
  }
}

export const notificationService = new NotificationService();
