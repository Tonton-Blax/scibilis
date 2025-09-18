import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	email: text('email').unique(),
	passwordHash: text('password_hash').notNull(),
	name: text('name'),
	age: integer('age'),
	avatar: text('avatar'),
	bio: text('bio'),
	// new subscriber column
	subscriber: text('subscriber', { enum: ['free', 'pro', 'premium', 'max'] }).default('free').notNull(),
	// lastSeen timestamp for inactivity checks
	lastSeen: integer('lastSeen', { mode: 'timestamp' }).default(new Date()).notNull(),
	role: text('role', { enum: ['user', 'admin'] }).default('user').notNull(),
	isActive: integer('isActive', { mode: 'boolean' }).default(true).notNull(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false).notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).default(new Date()).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(new Date()).notNull()
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => user.id),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull()
});

// New track table
export const track = sqliteTable('track', {
	id: text('id').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => user.id),
	filePath: text('filePath').notNull(),
	fileName: text('fileName').notNull(),
	title: text('title'),
	wasVideo: integer('wasVideo', { mode: 'boolean' }).default(false).notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).default(new Date()).notNull()
});

// New transcription table
export const transcription = sqliteTable('transcription', {
	id: text('id').primaryKey(),
	trackId: text('trackId').notNull().references(() => track.id),
	content: text('content').notNull(),
	withTimestamps: integer('withTimestamps', { mode: 'boolean' }).default(false).notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).default(new Date()).notNull()
});

export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;
export type Track = typeof track.$inferSelect;
export type TrackInsert = typeof track.$inferInsert;
export type Transcription = typeof transcription.$inferSelect;
export type TranscriptionInsert = typeof transcription.$inferInsert;
