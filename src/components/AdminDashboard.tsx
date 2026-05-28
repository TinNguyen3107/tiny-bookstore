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
  bookCode: string;
  title: string;
  author: string;
  translator: string;
  publisher: string;
  publishedYear: string;
  description: string;
  price: string;
  cover: string;
  stock: string;
  weight: string;
  dimensions: string;
  pages: string;
  format: string;
}

const emptyBookForm: BookFormState = {
  categoryId: '',
  bookCode: '',
  title: '',
  author: '',
  translator: '',
  publisher: '',
  publishedYear: '',
  description: '',
  price: '',
  cover: '',
  stock: '0',
  weight: '',
  dimensions: '',
  pages: '',
  format: '',
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
  const [adminTab, setAdminTab] = useState<'management' | 'inventory' | 'orders'>('management');

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
      bookCode: book.bookCode || '',
      title: book.title,
      author: book.author,
      translator: book.translator || '',
      publisher: book.publisher || '',
      publishedYear: book.publishedYear ? String(book.publishedYear) : '',
      description: book.description,
      price: String(book.price),
      cover: book.cover,
      stock: String(book.stock),
      weight: book.weight ? String(book.weight) : '',
      dimensions: book.dimensions || '',
      pages: book.pages ? String(book.pages) : '',
      format: book.format || '',
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
          categoryId: bookForm.categoryId ? Number(bookForm.categoryId) : null,
          bookCode: bookForm.bookCode || null,
          title: bookForm.title,
          author: bookForm.author || null,
          translator: bookForm.translator || null,
          publisher: bookForm.publisher || null,
          publishedYear: bookForm.publishedYear ? Number(bookForm.publishedYear) : null,
          description: bookForm.description,

          price: Number(bookForm.price.toString().replace(/[.,\s]/g, '')),
          cover: bookForm.cover || null,
          stock: Number(bookForm.stock),
          weight: bookForm.weight ? Number(bookForm.weight) : null,
          dimensions: bookForm.dimensions || null,
          pages: bookForm.pages ? Number(bookForm.pages) : null,
          format: bookForm.format || null,
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

  async function handleDeleteUser(userId: number, username: string) {
    if (!window.confirm(`Are you sure you want to delete user ${username}?`)) return;
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        token,
      });
      await loadAdminData();
      setMessage(`User ${username} deleted successfully.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete user.'
      );
    }
  }

  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <div className="space-y-6">
      <section 
        className="relative overflow-hidden rounded-[2rem] bg-cover bg-center p-8 text-white shadow-lg"
        style={{
          backgroundImage: 'url(/logo/background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white drop-shadow-lg">
              Admin dashboard
            </div>
            <h1 className="mt-2 text-4xl font-black drop-shadow-lg">Store control center</h1>
            <p className="mt-3 max-w-2xl text-sm text-white drop-shadow-lg">
              Manage books, inspect customer activity, and review every purchase
              flowing through the bookstore.
            </p>
          </div>
          <div className="rounded-3xl border border-white/40 bg-white/10 px-5 py-4 text-sm text-white drop-shadow-lg">
            Logged in as <span className="font-semibold">{user.username}</span>
          </div>
        </div>
      </section>

      {(error || message) && (
        <div className="grid gap-3">
          {message && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-600">
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
          <div className="mt-2 text-3xl font-black text-stone-900 whitespace-nowrap">
            {formatCurrency(totalRevenue)}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-6 border-b border-stone-200 pb-1">
        <button
          onClick={() => setAdminTab('management')}
          className={`pb-2 text-lg font-bold transition-colors ${
            adminTab === 'management'
              ? 'border-b-2 border-sky-500 text-sky-600'
              : 'border-b-2 border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Management
        </button>
        <button
          onClick={() => setAdminTab('inventory')}
          className={`pb-2 text-lg font-bold transition-colors ${
            adminTab === 'inventory'
              ? 'border-b-2 border-sky-500 text-sky-600'
              : 'border-b-2 border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Inventory
        </button>
        <button
          onClick={() => setAdminTab('orders')}
          className={`pb-2 text-lg font-bold transition-colors ${
            adminTab === 'orders'
              ? 'border-b-2 border-sky-500 text-sky-600'
              : 'border-b-2 border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Orders
        </button>
      </div>

      {adminTab === 'management' && (
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
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
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
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
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
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
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
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
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
                  Book Code
                </label>
                <input
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  value={bookForm.bookCode}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      bookCode: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Translator
                </label>
                <input
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  value={bookForm.translator}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      translator: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Publisher
                </label>
                <input
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  value={bookForm.publisher}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      publisher: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Published Year
                </label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  value={bookForm.publishedYear}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      publishedYear: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Weight (g)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  value={bookForm.weight}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      weight: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Dimensions
                </label>
                <input
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  placeholder="e.g., 24 x 15.5 x 2.5 cm"
                  value={bookForm.dimensions}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      dimensions: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Pages
                </label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  value={bookForm.pages}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      pages: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Format
                </label>
                <input
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                  placeholder="e.g., Bìa mềm"
                  value={bookForm.format}
                  onChange={(event) =>
                    setBookForm((current) => ({
                      ...current,
                      format: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Price
                </label>
                <input
                  type="text"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
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
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
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
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
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
              className="mt-6 w-full rounded-full bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {savingBook
                ? 'Saving book...'
                : editingBookId
                  ? 'Update book'
                  : 'Create book'}
            </button>
          </form>
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
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(curr => ({ ...curr, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Description</label>
                  <input
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-sky-500"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm(curr => ({ ...curr, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
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
                              : 'bg-sky-100 text-sky-600 hover:bg-sky-200'
                          }`}
                        >
                          {entry.role === 'admin' ? 'Set as customer' : 'Promote to admin'}
                        </button>
                        {user.id !== entry.id && (
                          <button
                            onClick={() => void handleDeleteUser(entry.id, entry.username)}
                            className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {adminTab === 'inventory' && (
      <section>
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
                      <div className="font-bold text-stone-900">
                        {book.title}
                        {book.bookCode && (
                          <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                            {book.bookCode}
                          </span>
                        )}
                      </div>
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
      </section>
      )}

      {adminTab === 'orders' && (
      <section>
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
                        <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-600">
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
                          className="flex flex-col gap-3 rounded-2xl border border-stone-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md md:flex-row md:items-center md:justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-100 shadow-sm">
                              {item.cover ? (
                                <img
                                  src={item.cover}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div>
                              <div className="font-semibold text-stone-900">
                                {item.title}
                              </div>
                              <div className="text-sm text-stone-500">{item.author}</div>
                            </div>
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
      </section>
      )}
    </div>
  );
}
