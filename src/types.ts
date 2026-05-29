export type UserRole = 'admin' | 'customer';

export interface Book {
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
  discountPercent?: number | null;
  saleEndsAt?: string | null;
  cover: string;
  stock: number;
  weight?: number | null;
  dimensions?: string | null;
  pages?: number | null;
  format?: string | null;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface CartItem {
  bookId: number;
  bookCode?: string | null;
  format?: string | null;
  title: string;
  author: string;
  price: number;
  originalPrice?: number | null;
  discountPercent?: number | null;
  cover: string;
  stock: number;
  quantity: number;
}

export interface OrderItem {
  bookId: number | null;
  bookCode?: string | null;
  format?: string | null;
  title: string;
  author: string;
  cover: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  user: User;
  items: OrderItem[];
}

export interface AdminUserSummary extends User {
  orderCount: number;
  totalSpent: number;
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}
