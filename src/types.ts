export type UserRole = 'admin' | 'customer';

export interface Book {
  id: number;
  categoryId?: number | null;
  categoryName?: string | null;
  title: string;
  author: string;
  description: string;
  price: number;
  cover: string;
  stock: number;
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
  title: string;
  author: string;
  price: number;
  cover: string;
  stock: number;
  quantity: number;
}

export interface OrderItem {
  bookId: number | null;
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
