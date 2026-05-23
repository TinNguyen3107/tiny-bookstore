import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../api';
import type { AdminUserSummary, Book, Category, Order, User } from '../types';
import { formatCurrency, formatDate } from '../utils';

interface AdminDashboardProps {
  user: User;
  token: string | null;
  books: Book[];
  onBooksChanged: () => Promise<void>;
}

interface BookFormState {
  categoryId: string;
  title: string;
  author: string;
  description: string;
  price: string;
  cover: string;
  stock: string;
}

const emptyBookForm: BookFormState = {
  categoryId: '',
  title: '',
  author: '',
  description: '',
  price: '',
  cover: '',
  stock: '0',
};

interface CategoryFormState {
  name: string;
  description: string;
}

const emptyCategoryForm: CategoryFormState = {
  name: '',
  description: '',
};

export default function AdminDashboard({
  user,
  token,
  books,
  onBooksChanged,
}: AdminDashboardProps) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookForm, setBookForm] = useState<BookFormState>(emptyBookForm);
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [savingBook, setSavingBook] = useState(false);

  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  async function loadAdminData() {
    if (!token) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [userList, orderList, categoryList] = await Promise.all([
        apiRequest<AdminUserSummary[]>('/api/admin/users', { token }),
        apiRequest<Order[]>('/api/admin/orders', { token }),
        apiRequest<Category[]>('/api/categories', { token }),
      ]);

      setUsers(userList);
      setOrders(orderList);
      setCategories(categoryList);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load admin data.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, [token]);

  function startEdit(book: Book) {
    setEditingBookId(book.id);
    setBookForm({
      categoryId: book.categoryId ? String(book.categoryId) : '',
      title: book.title,
      author: book.author,
      description: book.description,
      price: String(book.price),
      cover: book.cover,
      stock: String(book.stock),
    });
  }

  function resetBookForm() {
    setEditingBookId(null);
    setBookForm(emptyBookForm);
  }

  async function handleBookSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBook(true);
    setError('');
    setMessage('');

    try {
      const endpoint = editingBookId
        ? `/api/admin/books/${editingBookId}`
        : '/api/admin/books';

      await apiRequest(endpoint, {
        method: editingBookId ? 'PUT' : 'POST',
        token,
        body: {
          ...bookForm,
          categoryId: bookForm.categoryId ? Number(bookForm.categoryId) : null,
          price: Number(bookForm.price),
          stock: Number(bookForm.stock),
        },
      });

      await onBooksChanged();
      await loadAdminData();
      setMessage(
        editingBookId
          ? 'Book updated successfully.'
          : 'Book added successfully.'
      );
      resetBookForm();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not save book.'
      );
    } finally {
      setSavingBook(false);
    }
  }

  async function handleDeleteBook(bookId: number) {
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/admin/books/${bookId}`, {
        method: 'DELETE',
        token,
      });
      await onBooksChanged();
      await loadAdminData();
      setMessage('Book deleted successfully.');

      if (editingBookId === bookId) {
        resetBookForm();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete book.'
      );
    }
  }

  function startEditCategory(category: Category) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
    });
  }

  function resetCategoryForm() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCategory(true);
    setError('');
    setMessage('');

    try {
      const endpoint = editingCategoryId
        ? `/api/admin/categories/${editingCategoryId}`
        : '/api/admin/categories';

      await apiRequest(endpoint, {
        method: editingCategoryId ? 'PUT' : 'POST',
        token,
        body: categoryForm,
      });

      await loadAdminData();
      setMessage(
        editingCategoryId
          ? 'Category updated successfully.'
          : 'Category added successfully.'
      );
      resetCategoryForm();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not save category.'
      );
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleDeleteCategory(categoryId: number) {
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
        token,
      });
      await loadAdminData();
      setMessage('Category deleted successfully.');

      if (editingCategoryId === categoryId) {
        resetCategoryForm();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete category.'
      );
    }
  }

  async function handleRoleChange(
    targetUser: AdminUserSummary,
    nextRole: 'admin' | 'customer'
  ) {
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        token,
        body: {
          role: nextRole,
        },
      });
      await loadAdminData();
      setMessage(`Updated role for ${targetUser.username}.`);
    } catch (roleError) {
      setError(
        roleError instanceof Error
          ? roleError.message
          : 'Could not update user role.'
      );
    }
  }

  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-700 p-8 text-white shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200">
              Admin dashboard
            </div>
            <h1 className="mt-2 text-4xl font-black">Store control center</h1>
            <p className="mt-3 max-w-2xl text-sm text-stone-200">
              Manage books, inspect customer activity, and review every purchase
              flowing through the bookstore.
            </p>
          </div>
          <div className="rounded-3xl bg-white/10 px-5 py-4 text-sm text-stone-100">
            Logged in as <span className="font-semibold">{user.username}</span>
          </div>
        </div>
      </section>

      {(error || message) && (
        <div className="grid gap-3">
          {message && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-stone-500">Books in catalog</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{books.length}</div>
        </div>
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-stone-500">Registered users</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{users.length}</div>
        </div>
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-stone-500">Total revenue</div>
          <div className="mt-2 text-3xl font-black text-stone-900">
            {formatCurrency(totalRevenue)}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="space-y-6">
          <form
            onSubmit={handleBookSubmit}
            className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-stone-900">
                  {editingBookId ? 'Edit book' : 'Add a new book'}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Update the catalog that customers see on the storefront.
                </p>
              </div>
              {editingBookId && (
                <button
                  type="button"
                  onClick={resetBookForm}
                  className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Title
                </label>
                <input
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                  value={bookForm.title}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Category
                </label>
                <select
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                  value={bookForm.categoryId}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                >
                  <option value="">-- No Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Author
                </label>
                <input
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                  value={bookForm.author}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      author: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Cover URL
                </label>
                <input
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                  value={bookForm.cover}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      cover: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                  value={bookForm.price}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Stock
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                  value={bookForm.stock}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      stock: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Description
                </label>
                <textarea
                  rows={4}
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                  value={bookForm.description}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingBook}
              className="mt-6 w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {savingBook
                ? 'Saving book...'
                : editingBookId
                  ? 'Update book'
                  : 'Create book'}
            </button>
          </form>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-stone-900">Customer management</h2>
            <p className="mt-1 text-sm text-stone-500">
              Review user details, order counts, and update admin access.
            </p>

            <div className="mt-5 max-h-[400px] space-y-4 overflow-y-auto pr-2">
              {loading ? (
                <div className="text-sm text-stone-500">Loading users...</div>
              ) : (
                users.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-3xl border border-stone-200 bg-stone-50 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-lg font-bold text-stone-900">
                          {entry.fullName || entry.username}
                        </div>
                        <div className="text-sm text-stone-500">
                          @{entry.username} {entry.email ? `• ${entry.email}` : ''}
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-[0.2em] text-stone-400">
                          Joined {formatDate(entry.createdAt)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-full bg-white px-3 py-2 text-sm text-stone-700">
                          Orders: <span className="font-semibold">{entry.orderCount}</span>
                        </div>
                        <div className="rounded-full bg-white px-3 py-2 text-sm text-stone-700">
                          Spent: <span className="font-semibold">{formatCurrency(entry.totalSpent)}</span>
                        </div>
                        <button
                          onClick={() =>
                            void handleRoleChange(
                              entry,
                              entry.role === 'admin' ? 'customer' : 'admin'
                            )
                          }
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                            entry.role === 'admin'
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          }`}
                        >
                          {entry.role === 'admin' ? 'Set as customer' : 'Promote to admin'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-stone-900">Categories</h2>
            <p className="mt-1 text-sm text-stone-500">
              Manage product categories for your books.
            </p>

            <form onSubmit={handleCategorySubmit} className="mt-5 space-y-4 border-b border-stone-100 pb-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Name</label>
                  <input
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(curr => ({ ...curr, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Description</label>
                  <input
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm(curr => ({ ...curr, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {savingCategory ? 'Saving...' : editingCategoryId ? 'Update' : 'Add category'}
                </button>
                {editingCategoryId && (
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="mt-6 max-h-[280px] space-y-3 overflow-y-auto pr-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex flex-col gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-bold text-stone-900">{cat.name}</div>
                    {cat.description && <div className="text-sm text-stone-500">{cat.description}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditCategory(cat)}
                      className="rounded-full border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDeleteCategory(cat.id)}
                      className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-stone-900">Inventory</h2>
            <p className="mt-1 text-sm text-stone-500">
              Edit or remove books currently shown in the storefront.
            </p>

            <div className="mt-5 max-h-[400px] space-y-4 overflow-y-auto pr-2">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="flex flex-col gap-4 rounded-3xl border border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-16 overflow-hidden rounded-2xl bg-stone-100">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <div className="font-bold text-stone-900">{book.title}</div>
                      <div className="text-sm text-stone-500">
                        {book.author}
                        {book.categoryName ? ` • ${book.categoryName}` : ''}
                      </div>
                      <div className="mt-2 text-sm text-stone-700">
                        {formatCurrency(book.price)} • Stock {book.stock}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(book)}
                      className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDeleteBook(book.id)}
                      className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-stone-900">Purchased books</h2>
            <p className="mt-1 text-sm text-stone-500">
              Every completed order, grouped by customer and purchase date.
            </p>

            <div className="mt-5 max-h-[500px] space-y-4 overflow-y-auto pr-2">
              {loading ? (
                <div className="text-sm text-stone-500">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
                  No orders yet.
                </div>
              ) : (
                orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-3xl border border-stone-200 bg-stone-50 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
                          Order #{order.id}
                        </div>
                        <div className="mt-1 text-lg font-bold text-stone-900">
                          {order.user.fullName || order.user.username}
                        </div>
                        <div className="text-sm text-stone-500">
                          @{order.user.username}
                          {order.user.email ? ` • ${order.user.email}` : ''}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {order.status}
                        </div>
                        <div className="mt-2 text-lg font-bold text-stone-900">
                          {formatCurrency(order.totalAmount)}
                        </div>
                        <div className="mt-1 text-sm text-stone-500">
                          {formatDate(order.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 max-h-[200px] space-y-3 overflow-y-auto pr-2">
                      {order.items.map((item, index) => (
                        <div
                          key={`${order.id}-${item.bookId ?? index}`}
                          className="flex flex-col gap-3 rounded-2xl bg-white p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-semibold text-stone-900">
                              {item.title}
                            </div>
                            <div className="text-sm text-stone-500">{item.author}</div>
                          </div>
                          <div className="text-sm text-stone-600">
                            {item.quantity} x {formatCurrency(item.price)} ={' '}
                            <span className="font-semibold text-stone-900">
                              {formatCurrency(item.lineTotal)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
