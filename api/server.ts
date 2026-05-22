import "dotenv/config";
import express from "express";
import path from "path";
import { createHmac, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";
import fs from "fs";

import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const AUTH_SECRET = process.env.AUTH_SECRET || "tiny-bookstore-dev-secret";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "1234";
const DB_NAME = process.env.DB_NAME || "bookstore_db";

if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  throw new Error("DB_NAME contains invalid characters.");
}

app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,

  ssl: {
    minVersion: "TLSv1.2",
    rejectUnauthorized: false,
  },
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log("✅ TiDB connected!");
    conn.release();
  } catch (err) {
    console.error("❌ DB ERROR:", err);
  }
}

testConnection();

type UserRole = "admin" | "customer";

interface TokenPayload {
  id: number;
}

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  password: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: Date | string;
}

interface PublicUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface BookRow extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  description: string | null;
  price: string | number;
  cover: string | null;
  stock: number;
  created_at: Date | string;
}

interface PublicBook {
  id: number;
  title: string;
  author: string;
  description: string;
  price: number;
  cover: string;
  stock: number;
  createdAt: string;
}

interface OrderJoinRow extends RowDataPacket {
  order_id: number;
  user_id: number;
  total_amount: string | number;
  status: string;
  order_created_at: Date | string;
  user_created_at: Date | string;
  username: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  book_id: number | null;
  title_snapshot: string;
  author_snapshot: string | null;
  cover_snapshot: string | null;
  price_at_purchase: string | number;
  quantity: number;
}

interface OrderResponse {
  id: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  user: PublicUser;
  items: Array<{
    bookId: number | null;
    title: string;
    author: string;
    cover: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
}

interface UserSummaryRow extends RowDataPacket {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: Date | string;
  order_count: number;
  total_spent: string | number;
}

function createAuthToken(user: TokenPayload) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = createHmac("sha256", AUTH_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function parseAuthToken(token: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", AUTH_SECRET)
    .update(payload)
    .digest("base64url");

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<TokenPayload>;

    if (!Number.isInteger(parsed.id)) {
      return null;
    }

    return {
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function getBearerToken(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim() || null;
}

function serializeUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name ?? "",
    email: user.email ?? "",
    role: user.role,
    createdAt: new Date(user.created_at).toISOString(),
  };
}

function serializeBook(book: BookRow): PublicBook {
  return {
    id: book.id,
    title: book.title,
    author: book.author ?? "Unknown author",
    description: book.description ?? "",
    price: Number(book.price),
    cover: book.cover ?? "",
    stock: Number(book.stock),
    createdAt: new Date(book.created_at).toISOString(),
  };
}

async function columnExists(tableName: string, columnName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [DB_NAME, tableName, columnName],
  );

  return rows.length > 0;
}

async function ensureColumn(
  tableName: string,
  columnName: string,
  statement: string,
) {
  if (!(await columnExists(tableName, columnName))) {
    await pool.query(statement);
  }
}

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NULL,
      email VARCHAR(150) NULL,
      role ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn(
    "users",
    "full_name",
    "ALTER TABLE users ADD COLUMN full_name VARCHAR(150) NULL AFTER password",
  );
  await ensureColumn(
    "users",
    "email",
    "ALTER TABLE users ADD COLUMN email VARCHAR(150) NULL AFTER full_name",
  );
  await ensureColumn(
    "users",
    "role",
    "ALTER TABLE users ADD COLUMN role ENUM('admin', 'customer') NOT NULL DEFAULT 'customer' AFTER email",
  );
  await ensureColumn(
    "users",
    "created_at",
    "ALTER TABLE users ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER role",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(150) NULL,
      description TEXT NULL,
      price DECIMAL(10, 2) NOT NULL,
      cover VARCHAR(500) NULL,
      stock INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn(
    "books",
    "description",
    "ALTER TABLE books ADD COLUMN description TEXT NULL AFTER author",
  );
  await ensureColumn(
    "books",
    "stock",
    "ALTER TABLE books ADD COLUMN stock INT NOT NULL DEFAULT 0 AFTER cover",
  );
  await ensureColumn(
    "books",
    "created_at",
    "ALTER TABLE books ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER stock",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'completed',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      book_id INT NULL,
      title_snapshot VARCHAR(255) NOT NULL,
      author_snapshot VARCHAR(150) NULL,
      cover_snapshot VARCHAR(500) NULL,
      price_at_purchase DECIMAL(10, 2) NOT NULL,
      quantity INT NOT NULL,
      CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_order_items_book
        FOREIGN KEY (book_id) REFERENCES books(id)
        ON DELETE SET NULL
    )
  `);

  const [adminRows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE username = 'admin' LIMIT 1",
  );

  if (adminRows.length === 0) {
    await pool.query(
      `
        INSERT INTO users (username, password, full_name, email, role)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        "admin",
        "admin123",
        "Store Administrator",
        "admin@tinybookstore.local",
        "admin",
      ],
    );
  }
}

async function getUserById(userId: number) {
  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT id, username, password, full_name, email, role, created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

async function requireAuth(req: express.Request, res: express.Response) {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      message: "Missing token",
    });
    return null;
  }

  const payload = parseAuthToken(token);

  if (!payload) {
    res.status(401).json({
      message: "Invalid token",
    });
    return null;
  }

  const user = await getUserById(payload.id);

  if (!user) {
    res.status(401).json({
      message: "User not found",
    });
    return null;
  }

  return user;
}

async function requireAdmin(req: express.Request, res: express.Response) {
  const user = await requireAuth(req, res);

  if (!user) {
    return null;
  }

  if (user.role !== "admin") {
    res.status(403).json({
      message: "Admin access required",
    });
    return null;
  }

  return user;
}

async function fetchBooks() {
  const [rows] = await pool.query<BookRow[]>(
    `
      SELECT id, title, author, description, price, cover, stock, created_at
      FROM books
      ORDER BY created_at DESC, id DESC
    `,
  );

  return rows.map(serializeBook);
}

async function fetchOrders(whereClause = "1 = 1", params: unknown[] = []) {
  const [rows] = await pool.query<OrderJoinRow[]>(
    `
      SELECT
        o.id AS order_id,
        o.user_id,
        o.total_amount,
        o.status,
        o.created_at AS order_created_at,
        u.created_at AS user_created_at,
        u.username,
        u.full_name,
        u.email,
        u.role,
        oi.book_id,
        oi.title_snapshot,
        oi.author_snapshot,
        oi.cover_snapshot,
        oi.price_at_purchase,
        oi.quantity
      FROM orders o
      INNER JOIN users u ON u.id = o.user_id
      INNER JOIN order_items oi ON oi.order_id = o.id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC, o.id DESC, oi.id ASC
    `,
    params,
  );

  const orderMap = new Map<number, OrderResponse>();

  for (const row of rows) {
    if (!orderMap.has(row.order_id)) {
      orderMap.set(row.order_id, {
        id: row.order_id,
        totalAmount: Number(row.total_amount),
        status: row.status,
        createdAt: new Date(row.order_created_at).toISOString(),
        user: {
          id: row.user_id,
          username: row.username,
          fullName: row.full_name ?? "",
          email: row.email ?? "",
          role: row.role,
          createdAt: new Date(row.user_created_at).toISOString(),
        },
        items: [],
      });
    }

    const order = orderMap.get(row.order_id)!;
    const price = Number(row.price_at_purchase);

    order.items.push({
      bookId: row.book_id,
      title: row.title_snapshot,
      author: row.author_snapshot ?? "Unknown author",
      cover: row.cover_snapshot ?? "",
      price,
      quantity: row.quantity,
      lineTotal: price * row.quantity,
    });
  }

  return Array.from(orderMap.values());
}

function normalizeBookPayload(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const author = String(body.author ?? "").trim();
  const description = String(body.description ?? "").trim();
  const cover = String(body.cover ?? "").trim();
  const price = Number(body.price);
  const stock = Number(body.stock);

  if (!title) {
    return {
      error: "Title is required",
    };
  }

  if (!Number.isFinite(price) || price <= 0) {
    return {
      error: "Price must be greater than 0",
    };
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return {
      error: "Stock must be a non-negative integer",
    };
  }

  return {
    value: {
      title,
      author,
      description,
      cover,
      price,
      stock,
    },
  };
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body.username ?? "").trim();
    const password = String(req.body.password ?? "").trim();
    const fullName = String(req.body.fullName ?? "").trim();
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    const [usernameRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [username],
    );

    if (usernameRows.length > 0) {
      return res.status(400).json({
        message: "Username already exists",
      });
    }

    if (email) {
      const [emailRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email],
      );

      if (emailRows.length > 0) {
        return res.status(400).json({
          message: "Email already exists",
        });
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `
        INSERT INTO users (username, password, full_name, email, role)
        VALUES (?, ?, ?, ?, 'customer')
      `,
      [username, password, fullName || username, email || null],
    );

    const user = await getUserById(result.insertId);

    if (!user) {
      throw new Error("User creation failed");
    }

    res.status(201).json({
      message: "User registered successfully",
      token: createAuthToken({ id: user.id }),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not connect to the database",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body.username ?? "").trim();
    const password = String(req.body.password ?? "").trim();

    const [rows] = await pool.query<UserRow[]>(
      `
        SELECT id, username, password, full_name, email, role, created_at
        FROM users
        WHERE username = ? AND password = ?
        LIMIT 1
      `,
      [username, password],
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const user = rows[0];

    res.json({
      message: "Login successful",
      token: createAuthToken({ id: user.id }),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not connect to the database",
    });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await requireAuth(req, res);

    if (!user) {
      return;
    }

    res.json(serializeUser(user));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not connect to the database",
    });
  }
});

app.put("/api/users/me", async (req, res) => {
  try {
    const currentUser = await requireAuth(req, res);

    if (!currentUser) {
      return;
    }

    const username = String(req.body.username ?? currentUser.username).trim();
    const fullName = String(
      req.body.fullName ?? currentUser.full_name ?? currentUser.username,
    ).trim();
    const email = String(req.body.email ?? currentUser.email ?? "")
      .trim()
      .toLowerCase();

    if (!username) {
      return res.status(400).json({
        message: "Username is required",
      });
    }

    const [conflictRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT id
        FROM users
        WHERE (username = ? OR (? <> '' AND email = ?))
          AND id <> ?
        LIMIT 1
      `,
      [username, email, email, currentUser.id],
    );

    if (conflictRows.length > 0) {
      return res.status(400).json({
        message: "Username or email is already used by another account",
      });
    }

    await pool.query(
      `
        UPDATE users
        SET username = ?, full_name = ?, email = ?
        WHERE id = ?
      `,
      [username, fullName || username, email || null, currentUser.id],
    );

    const refreshedUser = await getUserById(currentUser.id);

    if (!refreshedUser) {
      throw new Error("Failed to reload user");
    }

    res.json({
      message: "Profile updated successfully",
      user: serializeUser(refreshedUser),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not update profile",
    });
  }
});

app.get("/api/books", async (_req, res) => {
  try {
    res.json(await fetchBooks());
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load books",
    });
  }
});

app.get("/api/books/:id", async (req, res) => {
  try {
    const bookId = Number(req.params.id);

    if (!Number.isInteger(bookId) || bookId <= 0) {
      return res.status(400).json({
        message: "Invalid book id",
      });
    }

    const [rows] = await pool.query<BookRow[]>(
      `
        SELECT id, title, author, description, price, cover, stock, created_at
        FROM books
        WHERE id = ?
        LIMIT 1
      `,
      [bookId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    res.json(serializeBook(rows[0]));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load book details",
    });
  }
});

app.post("/api/orders", async (req, res) => {
  let connection: PoolConnection | null = null;

  try {
    const currentUser = await requireAuth(req, res);

    if (!currentUser) {
      return;
    }

    const incomingItems = Array.isArray(req.body.items) ? req.body.items : [];

    if (incomingItems.length === 0) {
      return res.status(400).json({
        message: "Your cart is empty",
      });
    }

    const quantities = new Map<number, number>();

    for (const rawItem of incomingItems) {
      const bookId = Number((rawItem as Record<string, unknown>).bookId);
      const quantity = Number((rawItem as Record<string, unknown>).quantity);

      if (!Number.isInteger(bookId) || bookId <= 0) {
        return res.status(400).json({
          message: "Invalid book id in cart",
        });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          message: "Quantity must be a positive integer",
        });
      }

      quantities.set(bookId, (quantities.get(bookId) ?? 0) + quantity);
    }

    const bookIds = Array.from(quantities.keys());
    const placeholders = bookIds.map(() => "?").join(", ");

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [bookRows] = await connection.query<BookRow[]>(
      `
        SELECT id, title, author, description, price, cover, stock, created_at
        FROM books
        WHERE id IN (${placeholders})
        FOR UPDATE
      `,
      bookIds,
    );

    const booksById = new Map(bookRows.map((book) => [book.id, book]));

    let totalAmount = 0;
    const orderItems: Array<{
      book: BookRow;
      quantity: number;
      price: number;
    }> = [];

    for (const [bookId, quantity] of quantities.entries()) {
      const book = booksById.get(bookId);

      if (!book) {
        await connection.rollback();
        connection.release();
        connection = null;

        return res.status(400).json({
          message: `Book ${bookId} no longer exists`,
        });
      }

      if (book.stock < quantity) {
        await connection.rollback();
        connection.release();
        connection = null;

        return res.status(400).json({
          message: `Only ${book.stock} copies left for "${book.title}"`,
        });
      }

      const price = Number(book.price);
      totalAmount += price * quantity;
      orderItems.push({
        book,
        quantity,
        price,
      });
    }

    const [orderResult] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO orders (user_id, total_amount, status)
        VALUES (?, ?, 'completed')
      `,
      [currentUser.id, totalAmount],
    );

    for (const item of orderItems) {
      await connection.query(
        `
          INSERT INTO order_items (
            order_id,
            book_id,
            title_snapshot,
            author_snapshot,
            cover_snapshot,
            price_at_purchase,
            quantity
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderResult.insertId,
          item.book.id,
          item.book.title,
          item.book.author ?? null,
          item.book.cover ?? null,
          item.price,
          item.quantity,
        ],
      );

      await connection.query(
        "UPDATE books SET stock = stock - ? WHERE id = ?",
        [item.quantity, item.book.id],
      );
    }

    await connection.commit();
    connection.release();
    connection = null;

    const orders = await fetchOrders("o.id = ?", [orderResult.insertId]);

    res.status(201).json({
      message: "Order placed successfully",
      order: orders[0] ?? null,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }

    console.error(error);

    res.status(500).json({
      message: "Could not complete checkout",
    });
  }
});

app.get("/api/orders/me", async (req, res) => {
  try {
    const currentUser = await requireAuth(req, res);

    if (!currentUser) {
      return;
    }

    res.json(await fetchOrders("o.user_id = ?", [currentUser.id]));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load orders",
    });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const [rows] = await pool.query<UserSummaryRow[]>(
      `
        SELECT
          u.id,
          u.username,
          u.full_name,
          u.email,
          u.role,
          u.created_at,
          COUNT(o.id) AS order_count,
          COALESCE(SUM(o.total_amount), 0) AS total_spent
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        GROUP BY u.id, u.username, u.full_name, u.email, u.role, u.created_at
        ORDER BY u.created_at DESC, u.id DESC
      `,
    );

    res.json(
      rows.map((row) => ({
        ...serializeUser({
          ...row,
          password: "",
        } as UserRow),
        orderCount: Number(row.order_count),
        totalSpent: Number(row.total_spent),
      })),
    );
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load user list",
    });
  }
});

app.patch("/api/admin/users/:id/role", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const userId = Number(req.params.id);
    const role = req.body.role as UserRole;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "Invalid user id",
      });
    }

    if (role !== "admin" && role !== "customer") {
      return res.status(400).json({
        message: "Invalid role",
      });
    }

    if (userId === adminUser.id && role !== "admin") {
      return res.status(400).json({
        message: "You cannot remove your own admin role",
      });
    }

    await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
    const updatedUser = await getUserById(userId);

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      message: "User role updated",
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not update user role",
    });
  }
});

app.get("/api/admin/orders", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    res.json(await fetchOrders());
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load orders",
    });
  }
});

app.post("/api/admin/books", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const parsed = normalizeBookPayload(req.body as Record<string, unknown>);

    if ("error" in parsed) {
      return res.status(400).json({
        message: parsed.error,
      });
    }

    const { title, author, description, price, cover, stock } = parsed.value;

    const [result] = await pool.query<ResultSetHeader>(
      `
        INSERT INTO books (title, author, description, price, cover, stock)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [title, author || null, description || null, price, cover || null, stock],
    );

    const [rows] = await pool.query<BookRow[]>(
      `
        SELECT id, title, author, description, price, cover, stock, created_at
        FROM books
        WHERE id = ?
      `,
      [result.insertId],
    );

    res.status(201).json({
      message: "Book created successfully",
      book: serializeBook(rows[0]),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not create book",
    });
  }
});

app.put("/api/admin/books/:id", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const bookId = Number(req.params.id);

    if (!Number.isInteger(bookId) || bookId <= 0) {
      return res.status(400).json({
        message: "Invalid book id",
      });
    }

    const parsed = normalizeBookPayload(req.body as Record<string, unknown>);

    if ("error" in parsed) {
      return res.status(400).json({
        message: parsed.error,
      });
    }

    const { title, author, description, price, cover, stock } = parsed.value;

    await pool.query(
      `
        UPDATE books
        SET title = ?, author = ?, description = ?, price = ?, cover = ?, stock = ?
        WHERE id = ?
      `,
      [
        title,
        author || null,
        description || null,
        price,
        cover || null,
        stock,
        bookId,
      ],
    );

    const [rows] = await pool.query<BookRow[]>(
      `
        SELECT id, title, author, description, price, cover, stock, created_at
        FROM books
        WHERE id = ?
      `,
      [bookId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    res.json({
      message: "Book updated successfully",
      book: serializeBook(rows[0]),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not update book",
    });
  }
});

app.delete("/api/admin/books/:id", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const bookId = Number(req.params.id);

    if (!Number.isInteger(bookId) || bookId <= 0) {
      return res.status(400).json({
        message: "Invalid book id",
      });
    }

    await pool.query("DELETE FROM books WHERE id = ?", [bookId]);

    res.json({
      message: "Book deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not delete book",
    });
  }
});

async function startServer() {
  await setupDatabase();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });

    app.use(vite.middlewares);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log("Default admin account: admin / admin123");
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

if (process.env.NODE_ENV !== "production") {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

export default app;