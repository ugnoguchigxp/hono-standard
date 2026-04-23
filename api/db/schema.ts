import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const commonColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
};

export const users = pgTable('users', {
  ...commonColumns,
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('rt_user_id_idx').on(table.userId),
  })
);

export const userExternalAccounts = pgTable(
  'user_external_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'google', 'github'
    externalId: text('external_id').notNull(),
    email: text('email'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    providerExternalIdUniqueIdx: uniqueIndex('uex_provider_ext_uidx').on(
      table.provider,
      table.externalId
    ),
    userIdIdx: index('uex_user_id_idx').on(table.userId),
  })
);

export const threads = pgTable(
  'threads',
  {
    ...commonColumns,
    title: text('title').notNull(),
    content: text('content').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    authorIdIdx: index('threads_author_id_idx').on(table.authorId),
  })
);

export const comments = pgTable(
  'comments',
  {
    ...commonColumns,
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    threadIdIdx: index('comments_thread_id_idx').on(table.threadId),
    authorIdIdx: index('comments_author_id_idx').on(table.authorId),
  })
);

// Medical Questionnaire Tables
export const medicalInterviews = pgTable('medical_interviews', {
  ...commonColumns,
  sessionId: text('session_id').notNull().unique(),
  patientAge: integer('patient_age'),
  patientGender: text('patient_gender'),
  status: text('status').default('IN_PROGRESS').notNull(), // IN_PROGRESS, COMPLETED, CANCELLED
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const medicalQuestions = pgTable(
  'medical_questions',
  {
    ...commonColumns,
    interviewId: uuid('interview_id')
      .notNull()
      .references(() => medicalInterviews.id, { onDelete: 'cascade' }),
    questionText: text('question_text').notNull(),
    answerText: text('answer_text'),
    questionOrder: integer('question_order').notNull(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    interviewIdIdx: index('mq_interview_id_idx').on(table.interviewId),
  })
);

export const medicalDiagnoses = pgTable('medical_diagnoses', {
  ...commonColumns,
  interviewId: uuid('interview_id')
    .notNull()
    .references(() => medicalInterviews.id, { onDelete: 'cascade' })
    .unique(),
  primaryDiagnosis: text('primary_diagnosis').notNull(),
  confidence: doublePrecision('confidence').notNull(),
  recommendations: text('recommendations').notNull(),
  urgencyLevel: text('urgency_level').default('LOW').notNull(), // LOW, MEDIUM, HIGH, EMERGENCY
});
