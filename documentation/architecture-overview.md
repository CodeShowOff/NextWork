# Architecture Overview

## System Context

NextWork is a social-style collaboration platform with:

- user profiles
- social feed
- likes and comments
- follow graph
- real-time messaging
- notifications

## Target Stack

- Mobile: React Native + TypeScript
- API: NestJS + TypeScript
- Database: PostgreSQL (Prisma ORM)
- Cache and transport: Redis
- Realtime: Socket.IO + Redis adapter

## Architectural Style

- Modular monolith first, service boundaries ready for extraction.
- Domain-driven module boundaries.
- Event-driven side effects for notifications, counters, and feed updates.

## Module Boundaries

- Auth
- Users
- Profiles
- Posts
- Feed
- Comments
- Likes
- Follows
- Messages
- Notifications
- Realtime

Planned module boundaries for incomplete roadmap features:

- Stories
- Reels
- Hashtags
- Mentions
- Polls
- Events
- Announcements
- Bookmarks
- Shares

## Dependency Flow

- API layer -> Application service -> Domain logic -> Repository interface -> Infrastructure adapter

Forbidden:

- controllers calling Prisma directly
- module-to-module direct data store access

## Scalability Building Blocks

- Redis cache-aside for high-read endpoints
- Redis pub/sub for real-time fan-out
- background jobs for side effects
- keyset pagination for feed and messages