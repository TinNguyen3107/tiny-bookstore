import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../api';
import type { Order, User } from '../types';
import { formatCurrency, formatDate } from '../utils';

interface ProfilePageProps {
  user: User;
  token: string | null;
  onUserUpdate: (user: User) => void;
}

export default function ProfilePage({
  user,
  token,
  onUserUpdate,
}: ProfilePageProps) {
  const [username, setUsername] = useState(user.username);
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUsername(user.username);
    setFullName(user.fullName);
    setEmail(user.email);
  }, [user]);

  useEffect(() => {
    if (!token) {
      setLoadingOrders(false);
      return;
    }

    apiRequest<Order[]>('/api/orders/me', { token })
      .then((data) => {
        setOrders(data);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load order history.'
        );
      })
      .finally(() => {
        setLoadingOrders(false);
      });
  }, [token]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);

    try {
      const response = await apiRequest<{ message: string; user: User }>(
        '/api/users/me',
        {
          method: 'PUT',
          token,
          body: {
            username,
            fullName,
            email,
          },
        }
      );

      onUserUpdate(response.user);
      setMessage(response.message);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not save profile.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
      <section className="space-y-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
            Account
          </div>
          <h1 className="mt-2 text-3xl font-black text-stone-900">
            Profile information
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Update your public profile and contact details.
          </p>
        </div>

        <div className="rounded-3xl bg-stone-50 p-4 text-sm text-stone-600">
          <div>Role: <span className="font-semibold text-stone-900">{user.role}</span></div>
          <div className="mt-2">
            Joined: <span className="font-semibold text-stone-900">{formatDate(user.createdAt)}</span>
          </div>
        </div>

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

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="profile-full-name">
              Full name
            </label>
            <input
              id="profile-full-name"
              className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="profile-username">
              Username
            </label>
            <input
              id="profile-username"
              className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="profile-email">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {saving ? 'Saving profile...' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-3xl font-black text-stone-900">Purchase history</h2>
          <p className="mt-2 text-sm text-stone-500">
            Review every completed order and the books included in each purchase.
          </p>
        </div>

        {loadingOrders ? (
          <div className="rounded-[2rem] border border-stone-200 bg-white p-8 text-center text-stone-500 shadow-sm">
            Loading order history...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500 shadow-sm">
            You have not purchased any books yet.
          </div>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
                    Order #{order.id}
                  </div>
                  <div className="mt-1 text-sm text-stone-500">
                    {formatDate(order.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {order.status}
                  </div>
                  <div className="mt-2 text-lg font-bold text-stone-900">
                    {formatCurrency(order.totalAmount)}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {order.items.map((item, index) => (
                  <div
                    key={`${order.id}-${item.bookId ?? index}`}
                    className="flex flex-col gap-3 rounded-3xl bg-stone-50 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-12 overflow-hidden rounded-xl bg-stone-200">
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
      </section>
    </div>
  );
}
