import "dotenv/config";
import express from "express";
import path from "path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { connect } from "@tidbcloud/serverless";
// XÓA: Import vite tĩnh đã được loại bỏ để tránh làm crash Vercel Production
import { validateRegistrationData, validateProfileUpdateData, validateBookData, validateCategoryData, validateOrderItems } from "./utils/validation.js";

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

// Khởi tạo kết nối TiDB Cloud Serverless qua HTTP Client
const config = {
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 4000,
};

const pool = connect(config);

// ====== HELPER ĐỂ ĐỌC DATA AN TOÀN TỪ TiDB ======
// Đảm bảo không bị crash khi TiDB trả về Object { rows: [] } thay vì Array
function getRows<T>(result: any): T[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result?.[0])) return result[0];
  return [];
}

type UserRole = "admin" | "customer";

interface TokenPayload {
  id: number;
}

interface UserRow {
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

interface BookRow {
  id: number;
  category_id?: number | null;
  category_name?: string | null;
  book_code?: string | null;
  title: string;
  author: string | null;
  translator: string | null;
  publisher: string | null;
  published_year: number | null;
  description: string | null;
  price: string | number;
  cover: string | null;
  stock: number;
  weight: number | null;
  dimensions: string | null;
  pages: number | null;
  format: string | null;
  created_at: Date | string;
}

interface PublicBook {
  id: number;
  categoryId?: number | null;
  categoryName?: string | null;
  bookCode?: string | null;
  title: string;
  author: string;
  translator?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  description: string;
  price: number;
  cover: string;
  stock: number;
  weight?: number | null;
  dimensions?: string | null;
  pages?: number | null;
  format?: string | null;
  createdAt: string;
}

interface OrderJoinRow {
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
  book_code?: string | null;
  format?: string | null;
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
    bookCode?: string | null;
    format?: string | null;
    title: string;
    author: string;
    cover: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
}

interface UserSummaryRow {
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
    categoryId: book.category_id ?? null,
    categoryName: book.category_name ?? null,
    bookCode: book.book_code ?? null,
    title: book.title,
    author: book.author ?? "Unknown author",
    translator: book.translator ?? null,
    publisher: book.publisher ?? null,
    publishedYear: book.published_year ?? null,
    description: book.description ?? "",
    price: Number(book.price),
    cover: book.cover ?? "",
    stock: Number(book.stock),
    weight: book.weight ?? null,
    dimensions: book.dimensions ?? null,
    pages: book.pages ?? null,
    format: book.format ?? null,
    createdAt: new Date(book.created_at).toISOString(),
  };
}

async function columnExists(tableName: string, columnName: string) {
  const rawResult = await pool.execute(
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

  const rows = getRows(rawResult);
  return rows.length > 0;
}

async function ensureColumn(
  tableName: string,
  columnName: string,
  statement: string,
) {
  if (!(await columnExists(tableName, columnName))) {
    await pool.execute(statement);
  }
}

async function setupDatabase() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NULL,
      email VARCHAR(150) NULL,
      role ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn(
    "users",
    "is_deleted",
    "ALTER TABLE users ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false AFTER role",
  );

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

  await pool.execute(`
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

  // Categories table (must exist before adding category_id FK to books)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description TEXT NULL
    )
  `);

  // New book columns added for extended book info
  await ensureColumn(
    "books",
    "category_id",
    "ALTER TABLE books ADD COLUMN category_id INT NULL AFTER id",
  );
  await ensureColumn(
    "books",
    "book_code",
    "ALTER TABLE books ADD COLUMN book_code VARCHAR(100) NULL AFTER category_id",
  );
  await ensureColumn(
    "books",
    "translator",
    "ALTER TABLE books ADD COLUMN translator VARCHAR(150) NULL AFTER author",
  );
  await ensureColumn(
    "books",
    "publisher",
    "ALTER TABLE books ADD COLUMN publisher VARCHAR(150) NULL AFTER translator",
  );
  await ensureColumn(
    "books",
    "published_year",
    "ALTER TABLE books ADD COLUMN published_year INT NULL AFTER publisher",
  );
  await ensureColumn(
    "books",
    "weight",
    "ALTER TABLE books ADD COLUMN weight DECIMAL(10, 2) NULL AFTER stock",
  );
  await ensureColumn(
    "books",
    "dimensions",
    "ALTER TABLE books ADD COLUMN dimensions VARCHAR(100) NULL AFTER weight",
  );
  await ensureColumn(
    "books",
    "pages",
    "ALTER TABLE books ADD COLUMN pages INT NULL AFTER dimensions",
  );
  await ensureColumn(
    "books",
    "format",
    "ALTER TABLE books ADD COLUMN format VARCHAR(100) NULL AFTER pages",
  );

  await pool.execute(`
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

  await pool.execute(`
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

  const rawAdmin = await pool.execute(
    "SELECT id FROM users WHERE username = 'admin' LIMIT 1",
  );
  const adminRows = getRows(rawAdmin);

  if (adminRows.length === 0) {
    await pool.execute(
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
  const rawResult = await pool.execute(
    `
      SELECT id, username, password, full_name, email, role, created_at
      FROM users
      WHERE id = ? AND is_deleted = false
      LIMIT 1
    `,
    [userId],
  );
  const rows = getRows<UserRow>(rawResult);
  return rows[0] ?? null;
}

async function requireAuth(req: express.Request, res: express.Response) {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ message: "Missing token" });
    return null;
  }

  const payload = parseAuthToken(token);

  if (!payload) {
    res.status(401).json({ message: "Invalid token" });
    return null;
  }

  const user = await getUserById(payload.id);

  if (!user) {
    res.status(401).json({ message: "User not found" });
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
    res.status(403).json({ message: "Admin access required" });
    return null;
  }

  return user;
}

async function fetchBooks() {
  const rawResult = await pool.execute(
    `
      SELECT b.id, b.category_id, c.name AS category_name, b.book_code, b.title, b.author, b.translator, b.publisher, b.published_year, b.description, b.price, b.cover, b.stock, b.weight, b.dimensions, b.pages, b.format, b.created_at
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      ORDER BY b.created_at DESC, b.id DESC
    `,
  );
  const rows = getRows<BookRow>(rawResult);
  return rows.map(serializeBook);
}

async function fetchOrders(whereClause = "1 = 1", params: unknown[] = []) {
  const rawResult = await pool.execute(
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
        oi.quantity,
        b.book_code,
        b.format
      FROM orders o
      INNER JOIN users u ON u.id = o.user_id
      INNER JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN books b ON b.id = oi.book_id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC, o.id DESC, oi.id ASC
    `,
    params,
  );

  const rows = getRows<OrderJoinRow>(rawResult);
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
      bookCode: row.book_code ?? null,
      format: row.format ?? null,
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



app.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body.username ?? "").trim();
    const password = String(req.body.password ?? "").trim();
    const fullName = String(req.body.fullName ?? "").trim();
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();

    const validation = validateRegistrationData({ username, password, fullName, email });
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.error });
    }

    const rawUser = await pool.execute(
      "SELECT id FROM users WHERE username = ? AND is_deleted = false LIMIT 1",
      [username],
    );
    if (getRows(rawUser).length > 0) {
      return res.status(400).json({ message: "Username already exists" });
    }

    if (email) {
      const rawEmail = await pool.execute(
        "SELECT id FROM users WHERE email = ? AND is_deleted = false LIMIT 1",
        [email],
      );
      if (getRows(rawEmail).length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }
    }

    const result = (await pool.execute(
      `INSERT INTO users (username, password, full_name, email, role) VALUES (?, ?, ?, ?, 'customer')`,
      [username, password, fullName || username, email || null],
      { fullResult: true }
    )) as any;

    const insertId = Number(result.lastInsertId || result.insertId);
    const user = await getUserById(insertId);

    if (!user) throw new Error("User creation failed");

    res.status(201).json({
      message: "User registered successfully",
      token: createAuthToken({ id: user.id }),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not connect to the database" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body.username ?? "").trim();
    const password = String(req.body.password ?? "").trim();

    const rawResult = await pool.execute(
      `
        SELECT id, username, password, full_name, email, role, created_at
        FROM users
        WHERE username = ? AND password = ? AND is_deleted = false
        LIMIT 1
      `,
      [username, password],
    );

    const rows = getRows<UserRow>(rawResult);

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    res.json({
      message: "Login successful",
      token: createAuthToken({ id: user.id }),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not connect to the database" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    res.json(serializeUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not connect to the database" });
  }
});

app.put("/api/users/me", async (req, res) => {
  try {
    const currentUser = await requireAuth(req, res);
    if (!currentUser) return;

    const username = String(req.body.username ?? currentUser.username).trim();
    const fullName = String(
      req.body.fullName ?? currentUser.full_name ?? currentUser.username,
    ).trim();
    const email = String(req.body.email ?? currentUser.email ?? "")
      .trim()
      .toLowerCase();

    const validation = validateProfileUpdateData({ username, fullName, email });
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.error });
    }

    const rawConflict = await pool.execute(
      `
        SELECT id
        FROM users
        WHERE (username = ? OR (? <> '' AND email = ?))
          AND id <> ? AND is_deleted = false
        LIMIT 1
      `,
      [username, email, email, currentUser.id],
    );

    if (getRows(rawConflict).length > 0) {
      return res
        .status(400)
        .json({
          message: "Username or email is already used by another account",
        });
    }

    await pool.execute(
      `
        UPDATE users
        SET username = ?, full_name = ?, email = ?
        WHERE id = ?
      `,
      [username, fullName || username, email || null, currentUser.id],
    );

    const refreshedUser = await getUserById(currentUser.id);
    if (!refreshedUser) throw new Error("Failed to reload user");

    res.json({
      message: "Profile updated successfully",
      user: serializeUser(refreshedUser),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update profile" });
  }
});

app.get("/api/categories", async (_req, res) => {
  try {
    const rawResult = await pool.execute(`SELECT id, name, description FROM categories ORDER BY name ASC`);
    res.json(getRows(rawResult));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load categories" });
  }
});

app.get("/api/books", async (_req, res) => {
  try {
    res.json(await fetchBooks());
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load books" });
  }
});

app.get("/api/books/:id", async (req, res) => {
  try {
    const bookId = Number(req.params.id);

    if (!Number.isInteger(bookId) || bookId <= 0) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const rawResult = await pool.execute(
      `SELECT b.id, b.category_id, c.name AS category_name, b.book_code, b.title, b.author, b.translator, b.publisher, b.published_year, b.description, b.price, b.cover, b.stock, b.weight, b.dimensions, b.pages, b.format, b.created_at FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ? LIMIT 1`,
      [bookId],
    );

    const rows = getRows<BookRow>(rawResult);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(serializeBook(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load book details" });
  }
});

app.post("/api/orders", async (req, res) => {
  let tx: any = null;
  try {
    const currentUser = await requireAuth(req, res);
    if (!currentUser) return;

    const validation = validateOrderItems(req.body.items);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.error });
    }
    const quantities = validation.quantities!;

    const bookIds = Array.from(quantities.keys());
    const placeholders = bookIds.map(() => "?").join(", ");

    // KIỂU TRANSACTION CHUẨN CỦA TiDB HTTP CLIENT
    tx = await pool.begin();

    const rawBooks = await tx.execute(
      `SELECT b.id, b.category_id, c.name AS category_name, b.book_code, b.title, b.author, b.translator, b.publisher, b.published_year, b.description, b.price, b.cover, b.stock, b.weight, b.dimensions, b.pages, b.format, b.created_at FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id IN (${placeholders})`,
      bookIds,
    );
    const bookRows = getRows<BookRow>(rawBooks);

    const booksById = new Map(bookRows.map((book) => [book.id, book]));
    let totalAmount = 0;
    const orderItems: Array<{
      book: BookRow;
      quantity: number;
      price: number;
    }> = [];

    for (const [bookId, quantity] of quantities.entries()) {
      const book = booksById.get(bookId);
      if (!book) throw new Error(`Book ${bookId} no longer exists`);
      if (book.stock < quantity) {
        throw new Error(`Only ${book.stock} copies left for "${book.title}"`);
      }

      const price = Number(book.price);
      totalAmount += price * quantity;
      orderItems.push({ book, quantity, price });
    }

    const orderResult = (await tx.execute(
      `INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, 'completed')`,
      [currentUser.id, totalAmount],
      { fullResult: true }
    )) as any;

    const insertedOrderId = Number(
      orderResult.lastInsertId || orderResult.insertId,
    );

    for (const item of orderItems) {
      await tx.execute(
        `INSERT INTO order_items (order_id, book_id, title_snapshot, author_snapshot, cover_snapshot, price_at_purchase, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          insertedOrderId,
          item.book.id,
          item.book.title,
          item.book.author ?? null,
          item.book.cover ?? null,
          item.price,
          item.quantity,
        ],
      );
      await tx.execute("UPDATE books SET stock = stock - ? WHERE id = ?", [
        item.quantity,
        item.book.id,
      ]);
    }

    // Cam kết ghi dữ liệu nếu mọi thứ thành công
    await tx.commit();

    const orders = await fetchOrders("o.id = ?", [insertedOrderId]);
    res.status(201).json({
      message: "Order placed successfully",
      order: orders[0] ?? null,
    });
  } catch (error: any) {
    if (tx) {
      await tx.rollback().catch(console.error); // Rollback nếu có lỗi xảy ra
    }
    console.error(error);
    res
      .status(400)
      .json({ message: error.message || "Could not complete checkout" });
  }
});

app.get("/api/orders/me", async (req, res) => {
  try {
    const currentUser = await requireAuth(req, res);
    if (!currentUser) return;
    res.json(await fetchOrders("o.user_id = ?", [currentUser.id]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load orders" });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const rawResult = await pool.execute(
      `
        SELECT
          u.id, u.username, u.full_name, u.email, u.role, u.created_at,
          COUNT(o.id) AS order_count,
          COALESCE(SUM(o.total_amount), 0) AS total_spent
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        WHERE u.is_deleted = false
        GROUP BY u.id, u.username, u.full_name, u.email, u.role, u.created_at
        ORDER BY u.created_at DESC, u.id DESC
      `,
    );

    const rows = getRows<UserSummaryRow>(rawResult);

    res.json(
      rows.map((row) => ({
        ...serializeUser({ ...row, password: "" } as UserRow),
        orderCount: Number(row.order_count),
        totalSpent: Number(row.total_spent),
      })),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load user list" });
  }
});

app.patch("/api/admin/users/:id/role", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const userId = Number(req.params.id);
    const role = req.body.role as UserRole;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (role !== "admin" && role !== "customer") {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (userId === adminUser.id && role !== "admin") {
      return res
        .status(400)
        .json({ message: "You cannot remove your own admin role" });
    }

    await pool.execute("UPDATE users SET role = ? WHERE id = ?", [
      role,
      userId,
    ]);
    const updatedUser = await getUserById(userId);

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User role updated",
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update user role" });
  }
});

app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (userId === adminUser.id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await pool.execute(
      "UPDATE users SET is_deleted = true, username = CONCAT(username, '_deleted_', UNIX_TIMESTAMP()) WHERE id = ?",
      [userId]
    );
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete user" });
  }
});

app.get("/api/admin/orders", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;
    res.json(await fetchOrders());
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load orders" });
  }
});

app.post("/api/admin/books", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const parsed = validateBookData(req.body);
    if (!parsed.isValid) {
      return res.status(400).json({ message: parsed.error });
    }

    const { categoryId, bookCode, title, author, translator, publisher, publishedYear, description, price, cover, stock, weight, dimensions, pages, format } = parsed.value;

    const result = (await pool.execute(
      `INSERT INTO books (category_id, book_code, title, author, translator, publisher, published_year, description, price, cover, stock, weight, dimensions, pages, format) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [categoryId, bookCode, title, author || null, translator, publisher, publishedYear, description || null, price, cover || null, stock, weight, dimensions, pages, format],
      { fullResult: true }
    )) as any;

    const insertId = Number(result.lastInsertId || result.insertId);

    const rawResult = await pool.execute(
      `SELECT b.id, b.category_id, c.name AS category_name, b.book_code, b.title, b.author, b.translator, b.publisher, b.published_year, b.description, b.price, b.cover, b.stock, b.weight, b.dimensions, b.pages, b.format, b.created_at FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?`,
      [insertId],
    );

    const rows = getRows<BookRow>(rawResult);

    res.status(201).json({
      message: "Book created successfully",
      book: serializeBook(rows[0]),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not create book" });
  }
});

app.put("/api/admin/books/:id", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const bookId = Number(req.params.id);
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const parsed = validateBookData(req.body);
    if (!parsed.isValid) {
      return res.status(400).json({ message: parsed.error });
    }

    const { categoryId, bookCode, title, author, translator, publisher, publishedYear, description, price, cover, stock, weight, dimensions, pages, format } = parsed.value;

    await pool.execute(
      `UPDATE books SET category_id = ?, book_code = ?, title = ?, author = ?, translator = ?, publisher = ?, published_year = ?, description = ?, price = ?, cover = ?, stock = ?, weight = ?, dimensions = ?, pages = ?, format = ? WHERE id = ?`,
      [
        categoryId,
        bookCode,
        title,
        author || null,
        translator,
        publisher,
        publishedYear,
        description || null,
        price,
        cover || null,
        stock,
        weight,
        dimensions,
        pages,
        format,
        bookId,
      ],
    );

    const rawResult = await pool.execute(
      `SELECT b.id, b.category_id, c.name AS category_name, b.book_code, b.title, b.author, b.translator, b.publisher, b.published_year, b.description, b.price, b.cover, b.stock, b.weight, b.dimensions, b.pages, b.format, b.created_at FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?`,
      [bookId],
    );

    const rows = getRows<BookRow>(rawResult);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json({
      message: "Book updated successfully",
      book: serializeBook(rows[0]),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update book" });
  }
});

app.delete("/api/admin/books/:id", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const bookId = Number(req.params.id);
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    await pool.execute("DELETE FROM books WHERE id = ?", [bookId]);
    res.json({ message: "Book deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete book" });
  }
});

app.post("/api/admin/categories", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const validation = validateCategoryData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.error });
    }
    const name = String(req.body.name ?? "").trim();
    const description = String(req.body.description ?? "").trim();

    await pool.execute(
      `INSERT INTO categories (name, description) VALUES (?, ?)`,
      [name, description || null],
    );

    const rawResult = await pool.execute(`SELECT id, name, description FROM categories WHERE name = ?`, [name]);
    res.status(201).json({
      message: "Category created successfully",
      category: getRows(rawResult)[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not create category" });
  }
});

app.put("/api/admin/categories/:id", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const catId = Number(req.params.id);
    if (!Number.isInteger(catId) || catId <= 0) return res.status(400).json({ message: "Invalid category id" });

    const validation = validateCategoryData(req.body);
    if (!validation.isValid) return res.status(400).json({ message: validation.error });

    const name = String(req.body.name ?? "").trim();
    const description = String(req.body.description ?? "").trim();

    await pool.execute(`UPDATE categories SET name = ?, description = ? WHERE id = ?`, [name, description || null, catId]);

    const rawResult = await pool.execute(`SELECT id, name, description FROM categories WHERE id = ?`, [catId]);
    res.json({
      message: "Category updated successfully",
      category: getRows(rawResult)[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update category" });
  }
});

app.delete("/api/admin/categories/:id", async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const catId = Number(req.params.id);
    if (!Number.isInteger(catId) || catId <= 0) return res.status(400).json({ message: "Invalid category id" });

    await pool.execute(`DELETE FROM categories WHERE id = ?`, [catId]);
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete category" });
  }
});

async function startServer() {
  await setupDatabase();

  if (process.env.NODE_ENV !== "production") {
    // SỬA: Dùng dynamic import cho vite để Vercel không bao giờ dòm ngó tới
    const { createServer: createViteServer } = await import("vite");
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
  }
}

if (process.env.NODE_ENV !== "production") {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
} else {
  setupDatabase().catch((error) => {
    console.error("Failed to initialize database on Production:", error);
  });
}

export { pool };
export default app;
