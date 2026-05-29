import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { apiRequest } from './api';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';
import BookDetailPage from './components/BookDetailPage';
import CartPage from './components/CartPage';
import Home from './components/Home';
import Navbar from './components/Navbar';
import ProfilePage from './components/ProfilePage';
import type { Book, CartItem, Order, User } from './types';
import { getSaleInfo } from './utils';

function readStoredCart() {
  try {
    const raw = localStorage.getItem('cart');

    if (!raw) {
      return [] as CartItem[];
    }

    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksError, setBooksError] = useState('');
  const [cart, setCart] = useState<CartItem[]>(() => readStoredCart());

  async function loadBooks() {
    try {
      setBooksLoading(true);
      setBooksError('');
      const response = await apiRequest<Book[]>('/api/books');
      setBooks(response);
    } catch (error) {
      setBooksError(
        error instanceof Error ? error.message : 'Could not load books.'
      );
    } finally {
      setBooksLoading(false);
    }
  }

  useEffect(() => {
    void loadBooks();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    apiRequest<User>('/api/auth/me', {
      token,
    })
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    setCart((currentCart) =>
      currentCart.flatMap((item) => {
        const latestBook = books.find((book) => book.id === item.bookId);

        if (!latestBook || latestBook.stock <= 0) {
          return [];
        }

        return [
          {
            ...item,
            bookCode: latestBook.bookCode,
            format: latestBook.format,
            title: latestBook.title,
            author: latestBook.author,
            price: getSaleInfo(latestBook).salePrice,
            originalPrice: latestBook.price,
            discountPercent: getSaleInfo(latestBook).isActive
              ? getSaleInfo(latestBook).discountPercent
              : null,
            cover: latestBook.cover,
            stock: latestBook.stock,
            quantity: Math.min(item.quantity, latestBook.stock),
          },
        ];
      })
    );
  }, [books]);

  function handleAuthSuccess(nextUser: User) {
    setUser(nextUser);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  function addToCart(book: Book) {
    if (book.stock <= 0) {
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.bookId === book.id);

      if (!existing) {
        const saleInfo = getSaleInfo(book);
        return [
          ...currentCart,
          {
            bookId: book.id,
            bookCode: book.bookCode,
            format: book.format,
            title: book.title,
            author: book.author,
            price: saleInfo.salePrice,
            originalPrice: book.price,
            discountPercent: saleInfo.isActive ? saleInfo.discountPercent : null,
            cover: book.cover,
            stock: book.stock,
            quantity: 1,
          },
        ];
      }

      return currentCart.map((item) =>
        item.bookId === book.id
          ? {
              ...item,
              price: getSaleInfo(book).salePrice,
              originalPrice: book.price,
              discountPercent: getSaleInfo(book).isActive ? getSaleInfo(book).discountPercent : null,
              stock: book.stock,
              quantity: Math.min(item.quantity + 1, book.stock),
            }
          : item
      );
    });
  }

  function updateCartQuantity(bookId: number, quantity: number) {
    setCart((currentCart) =>
      currentCart.flatMap((item) => {
        if (item.bookId !== bookId) {
          return [item];
        }

        const nextQuantity = Math.min(Math.max(quantity, 0), item.stock);

        if (nextQuantity <= 0) {
          return [];
        }

        return [
          {
            ...item,
            quantity: nextQuantity,
          },
        ];
      })
    );
  }

  function removeFromCart(bookId: number) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.bookId !== bookId)
    );
  }

  async function checkoutCart() {
    const token = localStorage.getItem('token');

    if (!token) {
      throw new Error('Please log in before checking out.');
    }

    const response = await apiRequest<{ message: string; order: Order }>(
      '/api/orders',
      {
        method: 'POST',
        token,
        body: {
          items: cart.map((item) => ({
            bookId: item.bookId,
            quantity: item.quantity,
          })),
        },
      }
    );

    setCart([]);
    await loadBooks();

    return response.order;
  }

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <Router>
      <div className="min-h-screen bg-stone-100 text-stone-900">
        <Navbar
          cartItemCount={cartItemCount}
          onLogout={handleLogout}
          user={user}
        />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  books={books}
                  cart={cart}
                  error={booksError}
                  loading={booksLoading}
                  onAddToCart={addToCart}
                />
              }
            />
            <Route
              path="/books/:id"
              element={
                <BookDetailPage
                  books={books}
                  onAddToCart={addToCart}
                />
              }
            />
            <Route
              path="/cart"
              element={
                <CartPage
                  cart={cart}
                  user={user}
                  onCheckout={checkoutCart}
                  onQuantityChange={updateCartQuantity}
                  onRemove={removeFromCart}
                />
              }
            />
            <Route
              path="/profile"
              element={
                user ? (
                  <ProfilePage
                    onUserUpdate={setUser}
                    token={localStorage.getItem('token')}
                    user={user}
                  />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/admin"
              element={
                user?.role === 'admin' ? (
                  <AdminDashboard
                    books={books}
                    token={localStorage.getItem('token')}
                    user={user}
                    onBooksChanged={loadBooks}
                  />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/login"
              element={
                !user ? (
                  <Auth isRegister={false} onAuthSuccess={handleAuthSuccess} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/register"
              element={
                !user ? (
                  <Auth isRegister={true} onAuthSuccess={handleAuthSuccess} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
