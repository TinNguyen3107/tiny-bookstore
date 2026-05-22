import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import type { AuthResponse, User } from '../types';

interface AuthProps {
  isRegister: boolean;
  onAuthSuccess: (user: User) => void;
}

export default function Auth({ isRegister, onAuthSuccess }: AuthProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const response = await apiRequest<AuthResponse>(endpoint, {
        method: 'POST',
        body: {
          username,
          password,
          fullName,
          email,
        },
      });

      localStorage.setItem('token', response.token);
      onAuthSuccess(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
      <div className="mb-8 space-y-2 text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
          Tiny Bookstore
        </div>
        <h1 className="text-3xl font-black text-stone-900">
          {isRegister ? 'Create your reader account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-stone-500">
          {isRegister
            ? 'Sign up to save your purchases, profile, and order history.'
            : 'Log in to continue shopping and managing your account.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegister && (
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        {isRegister && (
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none transition focus:border-emerald-500"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {loading
            ? 'Processing...'
            : isRegister
              ? 'Create account'
              : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
        <Link
          to={isRegister ? '/login' : '/register'}
          className="font-semibold text-emerald-700 hover:text-emerald-800"
        >
          {isRegister ? 'Log in here' : 'Register here'}
        </Link>
      </p>
    </div>
  );
}
