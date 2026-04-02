var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// api/index.ts
import { serve } from "@hono/node-server";

// api/app.ts
import { serveStatic } from "@hono/node-server/serve-static";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono as OpenAPIHono5 } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";

// api/config.ts
import { config as dotenvConfig } from "dotenv";
import { z } from "zod";
dotenvConfig();
var envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3e3),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  AUTH_MODE: z.enum(["local", "oauth", "both"]).default("both"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  APP_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default("*"),
  LOG_LEVEL: z.string().default("info")
});
var result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("\u274C Invalid environment variables:");
  console.error(result.error.format());
  process.exit(1);
}
var config = result.data;

// api/lib/errors.ts
var AppError = class extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  statusCode;
  code;
  details;
};
var ValidationError = class extends AppError {
  constructor(message, details) {
    super(400, "VALIDATION_ERROR", message, details);
  }
};
var AuthError = class extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
};
var NotFoundError = class extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
};

// api/lib/logger.ts
import pino from "pino";
var logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV !== "production" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname"
    }
  } : void 0
});

// api/middleware/error-handler.ts
var errorHandler = async (err, c) => {
  const logger2 = c.get("logger") || logger;
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger2.error(err, "AppError");
    } else {
      logger2.warn({ code: err.code, message: err.message, details: err.details }, "AppError");
    }
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details
        }
      },
      err.statusCode
    );
  }
  logger2.error(err, "Unhandled Error");
  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred"
      }
    },
    500
  );
};

// api/middleware/logger.ts
import { createMiddleware } from "hono/factory";
var loggerMiddleware = () => {
  return createMiddleware(async (c, next) => {
    const requestId = crypto.randomUUID();
    const logger2 = logger.child({ requestId });
    c.set("logger", logger2);
    c.header("X-Request-Id", requestId);
    const start = Date.now();
    logger2.info({ method: c.req.method, url: c.req.url }, "Request started");
    await next();
    const ms = Date.now() - start;
    logger2.info(
      {
        status: c.res.status,
        durationMs: ms
      },
      "Request completed"
    );
  });
};

// api/middleware/rate-limiter.ts
var store = /* @__PURE__ */ new Map();
setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  },
  5 * 60 * 1e3
).unref?.();
var rateLimiter = (options) => {
  return async (c, next) => {
    const key = options.keyGenerator ? options.keyGenerator(c) : c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "127.0.0.1";
    const now = Date.now();
    const record = store.get(key);
    if (record) {
      if (now > record.resetTime) {
        store.set(key, { count: 1, resetTime: now + options.windowMs });
      } else {
        if (record.count >= options.limit) {
          return c.json(
            {
              error: {
                code: "RATE_LIMIT_EXCEEDED",
                message: options.message || "Too many requests"
              }
            },
            429
          );
        }
        record.count++;
      }
    } else {
      store.set(key, { count: 1, resetTime: now + options.windowMs });
    }
    await next();
  };
};

// api/modules/bbs/bbs.routes.ts
import { createRoute, OpenAPIHono, z as z4 } from "@hono/zod-openapi";

// shared/schemas/bbs.schema.ts
import { z as z2 } from "@hono/zod-openapi";
import sanitizeHtml from "sanitize-html";
var sanitize = (val) => sanitizeHtml(val);
var commentSchema = z2.object({
  id: z2.string().openapi({ example: "comment-uuid" }),
  threadId: z2.string().openapi({ example: "thread-uuid" }),
  parentId: z2.string().nullable().openapi({ example: null }),
  content: z2.string().openapi({ example: "My comment" }),
  authorId: z2.string().openapi({ example: "user-uuid" }),
  createdAt: z2.string().openapi({ example: "2026-04-02T11:47:06.000Z" }),
  updatedAt: z2.string().openapi({ example: "2026-04-02T11:47:06.000Z" })
}).openapi("Comment");
var threadSchema = z2.object({
  id: z2.string().openapi({ example: "thread-uuid" }),
  title: z2.string().openapi({ example: "My Thread" }),
  content: z2.string().openapi({ example: "Thread content" }),
  authorId: z2.string().openapi({ example: "user-uuid" }),
  createdAt: z2.string().openapi({ example: "2026-04-02T11:47:06.000Z" }),
  updatedAt: z2.string().openapi({ example: "2026-04-02T11:47:06.000Z" }),
  comments: z2.array(commentSchema).optional()
}).openapi("Thread");
var createThreadSchema = z2.object({
  title: z2.string().min(1).transform(sanitize).openapi({ example: "My First Thread" }),
  content: z2.string().min(1).transform(sanitize).openapi({ example: "Hello, this is the content of my first thread." })
}).openapi("CreateThreadInput");
var createCommentSchema = z2.object({
  content: z2.string().min(1).transform(sanitize).openapi({ example: "Great thread!" }),
  parentId: z2.string().uuid().optional().openapi({ example: "uuid-of-parent-comment" })
}).openapi("CreateCommentInput");
var listThreadsResponseSchema = z2.object({
  threads: z2.array(threadSchema)
});
var threadResponseSchema = z2.object({
  thread: threadSchema
});

// api/middleware/auth.ts
import { createMiddleware as createMiddleware2 } from "hono/factory";

// api/services/token.service.ts
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";

// api/db/client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// api/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  comments: () => comments,
  refreshTokens: () => refreshTokens,
  threads: () => threads,
  userExternalAccounts: () => userExternalAccounts,
  users: () => users
});
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
var commonColumns = {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => /* @__PURE__ */ new Date()).notNull()
};
var users = pgTable("users", {
  ...commonColumns,
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull()
});
var refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    userIdIdx: index("rt_user_id_idx").on(table.userId)
  })
);
var userExternalAccounts = pgTable(
  "user_external_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    // 'google', 'github'
    externalId: text("external_id").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    providerExternalIdIdx: index("uex_provider_ext_idx").on(table.provider, table.externalId),
    userIdIdx: index("uex_user_id_idx").on(table.userId)
  })
);
var threads = pgTable(
  "threads",
  {
    ...commonColumns,
    title: text("title").notNull(),
    content: text("content").notNull(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" })
  },
  (table) => ({
    authorIdIdx: index("threads_author_id_idx").on(table.authorId)
  })
);
var comments = pgTable(
  "comments",
  {
    ...commonColumns,
    threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references(() => comments.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" })
  },
  (table) => ({
    threadIdIdx: index("comments_thread_id_idx").on(table.threadId),
    authorIdIdx: index("comments_author_id_idx").on(table.authorId)
  })
);

// api/db/client.ts
var client = postgres(config.DATABASE_URL, { max: 10 });
var db = drizzle(client, { schema: schema_exports });

// api/lib/types.ts
import { z as z3 } from "zod";
var jwtPayloadSchema = z3.object({
  userId: z3.string(),
  email: z3.string().email(),
  type: z3.enum(["access", "refresh"])
});

// api/services/token.service.ts
var secretKey = new TextEncoder().encode(config.JWT_SECRET);
var hashToken = (token) => {
  return createHash("sha256").update(token).digest("hex");
};
var generateAccessToken = async (payload) => {
  return new SignJWT({ ...payload, type: "access" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(config.JWT_ACCESS_EXPIRES_IN).sign(secretKey);
};
var generateRefreshToken = async (payload, tx) => {
  const token = await new SignJWT({ ...payload, type: "refresh" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(config.JWT_REFRESH_EXPIRES_IN).sign(secretKey);
  const { payload: decoded } = await jwtVerify(token, secretKey);
  const expiresAt = new Date(decoded.exp * 1e3);
  const tokenHash = hashToken(token);
  const d = tx || db;
  await d.insert(refreshTokens).values({
    token: tokenHash,
    userId: payload.userId,
    expiresAt
  });
  return token;
};
var verifyAccessToken = async (token) => {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (payload.type !== "access") throw new Error("Invalid token type");
    return jwtPayloadSchema.parse(payload);
  } catch {
    throw new AuthError("Invalid or expired access token");
  }
};
var verifyRefreshToken = async (token, tx) => {
  const tokenHash = hashToken(token);
  const d = tx || db;
  const [storedToken] = await d.select().from(refreshTokens).where(eq(refreshTokens.token, tokenHash));
  if (!storedToken) {
    throw new AuthError("Invalid refresh token");
  }
  if (/* @__PURE__ */ new Date() > storedToken.expiresAt) {
    await revokeRefreshToken(token, tx);
    throw new AuthError("Refresh token expired");
  }
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (payload.type !== "refresh") throw new Error("Invalid token type");
    return jwtPayloadSchema.parse(payload);
  } catch {
    await revokeRefreshToken(token, tx);
    throw new AuthError("Invalid refresh token");
  }
};
var revokeRefreshToken = async (token, tx) => {
  const tokenHash = hashToken(token);
  const d = tx || db;
  await d.delete(refreshTokens).where(eq(refreshTokens.token, tokenHash));
};

// api/middleware/auth.ts
var authMiddleware = () => {
  return createMiddleware2(async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AuthError("Missing or invalid Authorization header");
    }
    const token = authHeader.split(" ")[1];
    try {
      const payload = await verifyAccessToken(token);
      c.set("user", payload);
    } catch {
      throw new AuthError("Invalid or expired token");
    }
    await next();
  });
};

// api/modules/bbs/bbs.repository.ts
import { desc, eq as eq2 } from "drizzle-orm";
var findAllThreads = async () => {
  return db.select({
    id: threads.id,
    title: threads.title,
    content: threads.content,
    authorId: threads.authorId,
    createdAt: threads.createdAt,
    updatedAt: threads.updatedAt
  }).from(threads).orderBy(desc(threads.createdAt));
};
var findThreadById = async (id) => {
  const [thread] = await db.select().from(threads).where(eq2(threads.id, id));
  return thread || null;
};
var findCommentsByThreadId = async (threadId) => {
  return db.select().from(comments).where(eq2(comments.threadId, threadId)).orderBy(comments.createdAt);
};
var findCommentById = async (id) => {
  const [comment] = await db.select().from(comments).where(eq2(comments.id, id));
  return comment || null;
};
var insertThread = async (data, authorId) => {
  const [thread] = await db.insert(threads).values({
    title: data.title,
    content: data.content,
    authorId
  }).returning();
  return thread;
};
var insertComment = async (threadId, data, authorId) => {
  const [comment] = await db.insert(comments).values({
    threadId,
    content: data.content,
    parentId: data.parentId || null,
    authorId
  }).returning();
  return comment;
};

// api/modules/bbs/bbs.service.ts
var listThreads = async () => {
  return findAllThreads();
};
var getThread = async (id) => {
  const thread = await findThreadById(id);
  if (!thread) throw new NotFoundError("Thread not found");
  const threadComments = await findCommentsByThreadId(id);
  return {
    ...thread,
    comments: threadComments
  };
};
var createThread = async (data, authorId) => {
  return insertThread(data, authorId);
};
var createComment = async (threadId, data, authorId) => {
  const thread = await findThreadById(threadId);
  if (!thread) throw new NotFoundError("Thread not found");
  if (data.parentId) {
    const parentComment = await findCommentById(data.parentId);
    if (!parentComment) throw new NotFoundError("Parent comment not found");
    if (parentComment.threadId !== threadId) {
      throw new ValidationError("Parent comment must belong to the same thread");
    }
  }
  return insertComment(threadId, data, authorId);
};

// api/modules/bbs/bbs.routes.ts
var listThreadsRoute = createRoute({
  method: "get",
  path: "/threads",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: listThreadsResponseSchema
        }
      },
      description: "List of all threads"
    }
  }
});
var getThreadRoute = createRoute({
  method: "get",
  path: "/threads/:id",
  request: {
    params: z4.object({
      id: z4.string().uuid().openapi({ example: "thread-uuid" })
    })
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: threadResponseSchema
        }
      },
      description: "The thread detail with comments"
    },
    404: {
      description: "Thread not found"
    }
  }
});
var createThreadRoute = createRoute({
  method: "post",
  path: "/threads",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createThreadSchema
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: threadSchema
        }
      },
      description: "Thread created successfully"
    }
  }
});
var createCommentRoute = createRoute({
  method: "post",
  path: "/threads/:id/comments",
  request: {
    params: z4.object({
      id: z4.string().uuid().openapi({ example: "thread-uuid" })
    }),
    body: {
      content: {
        "application/json": {
          schema: createCommentSchema
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: commentSchema
        }
      },
      description: "Comment created successfully"
    },
    404: {
      description: "Thread not found"
    }
  }
});
var publicBbs = new OpenAPIHono().openapi(listThreadsRoute, async (c) => {
  const threads2 = await listThreads();
  return c.json({ threads: threads2 }, 200);
}).openapi(getThreadRoute, async (c) => {
  const id = c.req.param("id");
  const thread = await getThread(id);
  return c.json({ thread }, 200);
});
var protectedBbsBase = new OpenAPIHono();
protectedBbsBase.use("*", authMiddleware());
var protectedBbs = protectedBbsBase.openapi(createThreadRoute, async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  if (!user) {
    throw new AuthError("Unauthorized");
  }
  const thread = await createThread(data, user.userId);
  return c.json(thread, 201);
}).openapi(createCommentRoute, async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const user = c.get("user");
  if (!user) {
    throw new AuthError("Unauthorized");
  }
  const comment = await createComment(id, data, user.userId);
  return c.json(comment, 201);
});
var bbsRouter = new OpenAPIHono().route("/", publicBbs).route("/", protectedBbs);

// api/routes/auth.ts
import { createRoute as createRoute2, OpenAPIHono as OpenAPIHono2, z as z6 } from "@hono/zod-openapi";

// api/schemas/auth.schema.ts
import { z as z5 } from "@hono/zod-openapi";

// api/lib/sanitizer.ts
import sanitizeHtml2 from "sanitize-html";
function sanitize2(input) {
  if (!input) return input;
  return sanitizeHtml2(input, {
    allowedTags: [],
    // Strip absolutely all HTML tags
    allowedAttributes: {},
    disallowedTagsMode: "discard"
  });
}

// api/schemas/auth.schema.ts
var registerSchema = z5.object({
  email: z5.string().email().openapi({ example: "user@example.com" }),
  password: z5.string().min(8).openapi({ example: "password123" }),
  name: z5.string().min(1).transform(sanitize2).openapi({ example: "John Doe" })
}).openapi("RegisterInput");
var loginSchema = z5.object({
  email: z5.string().email().openapi({ example: "user@example.com" }),
  password: z5.string().min(1).openapi({ example: "password123" })
}).openapi("LoginInput");
var refreshSchema = z5.object({
  refreshToken: z5.string().openapi({ example: "some-refresh-token" })
}).openapi("RefreshInput");
var logoutSchema = z5.object({
  refreshToken: z5.string().openapi({ example: "some-refresh-token" })
}).openapi("LogoutInput");

// api/services/auth.service.ts
import { and, eq as eq4 } from "drizzle-orm";

// api/lib/password.ts
import * as argon2 from "argon2";
async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1
  });
}
async function verifyPassword(password, hash2) {
  return argon2.verify(hash2, password);
}

// api/services/user.service.ts
import { eq as eq3 } from "drizzle-orm";
var findById = async (id, tx) => {
  const d = tx || db;
  const [user] = await d.select().from(users).where(eq3(users.id, id));
  return user;
};
var findByEmail = async (email, tx) => {
  const d = tx || db;
  const [user] = await d.select().from(users).where(eq3(users.email, email));
  return user;
};
var create = async (data, tx) => {
  const d = tx || db;
  const [user] = await d.insert(users).values(data).returning();
  return user;
};

// api/services/auth.service.ts
var checkLocalMode = () => {
  if (config.AUTH_MODE === "oauth") {
    throw new ValidationError("Local authentication is disabled");
  }
};
var register = async (data) => {
  checkLocalMode();
  const { email, password, name } = data;
  const existingUser = await findByEmail(email);
  if (existingUser) {
    throw new ValidationError("Email already in use");
  }
  const passwordHash = await hashPassword(password);
  const user = await create({
    email,
    passwordHash,
    name
  });
  return generateTokens(user);
};
var login = async (data) => {
  checkLocalMode();
  const { email, password } = data;
  const user = await findByEmail(email);
  if (!user?.passwordHash || !user.isActive) {
    throw new AuthError("Invalid email or password");
  }
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new AuthError("Invalid email or password");
  }
  return generateTokens(user);
};
var refresh = async (token) => {
  return db.transaction(async (tx) => {
    const payload = await verifyRefreshToken(token, tx);
    await revokeRefreshToken(token, tx);
    const user = await findById(payload.userId, tx);
    if (!user?.isActive) {
      throw new AuthError("User account is inactive or deleted");
    }
    return generateTokens(user, tx);
  });
};
var logout = async (token) => {
  if (token) {
    await revokeRefreshToken(token);
  }
};
var generateTokens = async (user, tx) => {
  const payload = { userId: user.id, email: user.email };
  const accessToken = await generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(payload, tx);
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email
    }
  };
};
var handleExternalUser = async (provider, oauthUser) => {
  return db.transaction(async (tx) => {
    const [existingExternal] = await tx.select().from(userExternalAccounts).where(
      and(
        eq4(userExternalAccounts.provider, provider),
        eq4(userExternalAccounts.externalId, oauthUser.id)
      )
    );
    if (existingExternal) {
      const [user2] = await tx.select().from(users).where(eq4(users.id, existingExternal.userId));
      return user2;
    }
    let user;
    const [existingUserByEmail] = await tx.select().from(users).where(eq4(users.email, oauthUser.email));
    if (existingUserByEmail) {
      user = existingUserByEmail;
    } else {
      const [newUser] = await tx.insert(users).values({
        email: oauthUser.email,
        name: oauthUser.name
      }).returning();
      user = newUser;
    }
    await tx.insert(userExternalAccounts).values({
      userId: user.id,
      provider,
      externalId: oauthUser.id,
      email: oauthUser.email
    });
    return user;
  });
};

// api/routes/auth.ts
var tokenResponseSchema = z6.object({
  accessToken: z6.string(),
  refreshToken: z6.string(),
  user: z6.object({
    id: z6.string(),
    email: z6.string()
  })
});
var registerRoute = createRoute2({
  method: "post",
  path: "/register",
  request: {
    body: {
      content: {
        "application/json": {
          schema: registerSchema
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: tokenResponseSchema
        }
      },
      description: "Registration successful"
    }
  }
});
var loginRoute = createRoute2({
  method: "post",
  path: "/login",
  request: {
    body: {
      content: {
        "application/json": {
          schema: loginSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: tokenResponseSchema
        }
      },
      description: "Login successful"
    }
  }
});
var refreshRoute = createRoute2({
  method: "post",
  path: "/refresh",
  request: {
    body: {
      content: {
        "application/json": {
          schema: refreshSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: tokenResponseSchema
        }
      },
      description: "Token refresh successful"
    }
  }
});
var logoutRoute = createRoute2({
  method: "post",
  path: "/logout",
  request: {
    body: {
      content: {
        "application/json": {
          schema: logoutSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z6.object({ success: z6.boolean() })
        }
      },
      description: "Logout successful"
    }
  }
});
var meRoute = createRoute2({
  method: "get",
  path: "/me",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z6.object({
            userId: z6.string(),
            email: z6.string()
          })
        }
      },
      description: "Get current user profile"
    }
  }
});
var publicAuthRouter = new OpenAPIHono2().openapi(registerRoute, async (c) => {
  const data = c.req.valid("json");
  const result2 = await register(data);
  return c.json(result2, 201);
}).openapi(loginRoute, async (c) => {
  const data = c.req.valid("json");
  const result2 = await login(data);
  return c.json(result2, 200);
}).openapi(refreshRoute, async (c) => {
  const { refreshToken } = c.req.valid("json");
  const result2 = await refresh(refreshToken);
  return c.json(result2, 200);
}).openapi(logoutRoute, async (c) => {
  const { refreshToken } = c.req.valid("json");
  await logout(refreshToken);
  return c.json({ success: true }, 200);
});
var protectedAuthRouterBase = new OpenAPIHono2();
protectedAuthRouterBase.use("/me", authMiddleware());
var protectedAuthRouter = protectedAuthRouterBase.openapi(meRoute, (c) => {
  const user = c.get("user");
  return c.json(user, 200);
});
var authRouter = new OpenAPIHono2().route("/", publicAuthRouter).route("/", protectedAuthRouter);

// api/routes/health.ts
import { createRoute as createRoute3, OpenAPIHono as OpenAPIHono3, z as z7 } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
var healthSchema = z7.object({
  status: z7.string().openapi({ example: "healthy" }),
  database: z7.string().openapi({ example: "connected" }),
  timestamp: z7.string().openapi({ example: "2026-04-02T11:47:06.000Z" }),
  version: z7.string().openapi({ example: "1.0.0" })
});
var route = createRoute3({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: healthSchema
        }
      },
      description: "The health check response"
    }
  }
});
var healthRouter = new OpenAPIHono3().openapi(route, async (c) => {
  let dbStatus = "connected";
  try {
    await db.execute(sql`select 1`);
  } catch (_err) {
    dbStatus = "disconnected";
  }
  return c.json({
    status: dbStatus === "connected" ? "healthy" : "degraded",
    database: dbStatus,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: "1.0.0"
  });
});

// api/routes/oauth.ts
import { createRoute as createRoute4, OpenAPIHono as OpenAPIHono4, z as z8 } from "@hono/zod-openapi";
import { getCookie, setCookie } from "hono/cookie";

// api/services/oauth/github.ts
var GitHubOAuthClient = class {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }
  clientId;
  clientSecret;
  redirectUri;
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: "read:user user:email",
      state
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
  async exchangeCode(code) {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri
      })
    });
    if (!tokenRes.ok) throw new AuthError("Failed to exchange GitHub token");
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new AuthError(tokenData.error_description || tokenData.error);
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (!userRes.ok) throw new AuthError("Failed to get GitHub user profile");
    const userData = await userRes.json();
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    let primaryEmail = userData.email;
    if (emailRes.ok) {
      const emails = await emailRes.json();
      const primary = emails.find((e) => e.primary) || emails[0];
      if (primary) primaryEmail = primary.email;
    }
    if (!primaryEmail) throw new AuthError("Email access required from GitHub");
    return {
      accessToken: tokenData.access_token,
      user: {
        id: userData.id.toString(),
        email: primaryEmail,
        name: userData.name || userData.login
      }
    };
  }
};

// api/services/oauth/google.ts
var GoogleOAuthClient = class {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }
  clientId;
  clientSecret;
  redirectUri;
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  async exchangeCode(code) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri
      })
    });
    if (!tokenRes.ok) throw new AuthError("Failed to exchange Google token");
    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userRes.ok) throw new AuthError("Failed to get Google user profile");
    const userData = await userRes.json();
    return {
      accessToken: tokenData.access_token,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.given_name || "Google User"
      }
    };
  }
};

// api/routes/oauth.ts
var providers = /* @__PURE__ */ new Map();
if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
  const fallback = `http://localhost:${config.PORT}`;
  const redirectUrl = `${config.APP_URL || fallback}/api/auth/oauth/google/callback`;
  providers.set(
    "google",
    new GoogleOAuthClient(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, redirectUrl)
  );
}
if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
  const fallback = `http://localhost:${config.PORT}`;
  const redirectUrl = `${config.APP_URL || fallback}/api/auth/oauth/github/callback`;
  providers.set(
    "github",
    new GitHubOAuthClient(config.GITHUB_CLIENT_ID, config.GITHUB_CLIENT_SECRET, redirectUrl)
  );
}
var loginRoute2 = createRoute4({
  method: "get",
  path: "/:provider",
  request: {
    params: z8.object({
      provider: z8.string().openapi({ example: "google" })
    })
  },
  responses: {
    302: {
      description: "Redirect to OAuth provider"
    }
  }
});
var callbackRoute = createRoute4({
  method: "get",
  path: "/:provider/callback",
  request: {
    params: z8.object({
      provider: z8.string().openapi({ example: "google" })
    }),
    query: z8.object({
      code: z8.string().optional(),
      state: z8.string().optional()
    })
  },
  responses: {
    302: {
      description: "Redirect to frontend with tokens"
    }
  }
});
var oauthRouter = new OpenAPIHono4().openapi(loginRoute2, (c) => {
  if (config.AUTH_MODE === "local") throw new AuthError("OAuth authentication is disabled");
  const providerId = c.req.param("provider");
  const provider = providers.get(providerId);
  if (!provider) throw new ValidationError("Invalid or disabled OAuth provider");
  const state = crypto.randomUUID();
  setCookie(c, "oauth_state", state, { httpOnly: true, maxAge: 60 * 10, path: "/" });
  const url = provider.getAuthorizationUrl(state);
  return c.redirect(url);
}).openapi(callbackRoute, async (c) => {
  const providerId = c.req.param("provider");
  const provider = providers.get(providerId);
  if (!provider) throw new ValidationError("Invalid or disabled OAuth provider");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const savedState = getCookie(c, "oauth_state");
  if (!code || !state || state !== savedState) {
    throw new AuthError("Invalid state or code");
  }
  setCookie(c, "oauth_state", "", { httpOnly: true, maxAge: 0, path: "/" });
  const { user: oauthUser } = await provider.exchangeCode(code);
  const user = await handleExternalUser(providerId, {
    id: oauthUser.id,
    email: oauthUser.email,
    name: oauthUser.name
  });
  if (!user?.isActive) {
    throw new AuthError("Account blocked or inactive");
  }
  const tokens = await generateTokens(user);
  const frontendUrl = new URL(
    "/oauth/callback",
    config.APP_URL || `http://localhost:${config.PORT}`
  );
  frontendUrl.hash = new URLSearchParams({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken
  }).toString();
  return c.redirect(frontendUrl.toString());
});

// api/app.ts
var apiRoutes = new OpenAPIHono5().route("/health", healthRouter).route("/auth/oauth", oauthRouter).route("/auth", authRouter).route("/bbs", bbsRouter);
var app = new OpenAPIHono5();
app.use("*", timing());
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (config.CORS_ORIGIN === "*") return origin || "";
      if (origin && config.CORS_ORIGIN.split(",").includes(origin)) return origin;
      return null;
    },
    credentials: true
  })
);
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        ...config.CORS_ORIGIN === "*" ? ["*"] : config.CORS_ORIGIN.split(",")
      ]
    }
  })
);
app.use("*", loggerMiddleware());
app.onError(errorHandler);
app.use("/api/*", rateLimiter({ windowMs: 60 * 1e3, limit: 100 }));
app.use("/api/auth/login", rateLimiter({ windowMs: 60 * 1e3, limit: 5 }));
app.use("/api/auth/register", rateLimiter({ windowMs: 60 * 1e3, limit: 5 }));
app.use("/api/*", csrf());
app.doc("/api/doc", {
  openapi: "3.0.0",
  info: {
    title: "Hono Standard API",
    version: "1.0.0"
  }
});
app.get("/api/ui", swaggerUI({ url: "/api/doc" }));
app.route("/api", apiRoutes);
if (config.NODE_ENV === "production") {
  const serveIndex = serveStatic({ path: "./dist/index.html" });
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.use("/favicon.ico", serveStatic({ root: "./dist" }));
  app.get("*", async (c, next) => {
    if (c.req.path.startsWith("/api")) return next();
    return serveIndex(c, next);
  });
}
var app_default = app;

// api/index.ts
var port = config.PORT;
var server = serve({
  fetch: app_default.fetch,
  port
});
logger.info(`\u{1F680} Server running on port ${port}`);
var shutdown = async () => {
  logger.info("Shutting down...");
  server.close();
  await client.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
