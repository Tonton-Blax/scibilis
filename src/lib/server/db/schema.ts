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

export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;
