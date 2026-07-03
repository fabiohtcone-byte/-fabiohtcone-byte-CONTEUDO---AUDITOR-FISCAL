import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, doublePrecision } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  subjectId: integer('subject_id').references(() => subjects.id).notNull(),
  title: text('title').notNull(),
  content: text('content'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userProgress = pgTable('user_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  topicId: integer('topic_id').references(() => topics.id).notNull(),
  masteryLevel: doublePrecision('mastery_level').default(0).notNull(), // 0 to 100
  timesStudied: integer('times_studied').default(0).notNull(),
  lastStudiedAt: timestamp('last_studied_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dailyStudyPlan = pgTable('daily_study_plan', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  topicId: integer('topic_id').references(() => topics.id).notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  completed: boolean('completed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subjectMaterials = pgTable('subject_materials', {
  id: serial('id').primaryKey(),
  subjectId: integer('subject_id').references(() => subjects.id).notNull(),
  fileName: text('file_name').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  studyPlans: many(dailyStudyPlan),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  topics: many(topics),
  materials: many(subjectMaterials),
}));

export const subjectMaterialsRelations = relations(subjectMaterials, ({ one }) => ({
  subject: one(subjects, {
    fields: [subjectMaterials.subjectId],
    references: [subjects.id],
  }),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [topics.subjectId],
    references: [subjects.id],
  }),
  progress: many(userProgress),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [userProgress.topicId],
    references: [topics.id],
  }),
}));

export const dailyStudyPlanRelations = relations(dailyStudyPlan, ({ one }) => ({
  user: one(users, {
    fields: [dailyStudyPlan.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [dailyStudyPlan.topicId],
    references: [topics.id],
  }),
}));
