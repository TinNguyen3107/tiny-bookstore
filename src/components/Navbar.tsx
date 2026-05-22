import { BookOpen, LayoutDashboard, LogOut, ShoppingCart, User } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import type { User as UserType } from '../types';

interface NavbarProps {
  cartItemCount: number;
  user: UserType | null;
  onLogout: () => void;
}

export default function Navbar({
  cartItemCount,
  user,
  onLogout,
}: NavbarProps) {
  return (
    <nav className="border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 text-emerald-700 transition-colors hover:text-emerald-800"
          >
            <div className="rounded-2xl bg-emerald-100 p-2">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-stone-900">
                Tiny Bookstore
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-stone-500">
                Read. Collect. Repeat.
              </div>
            </div>
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`
              }
            >
              Catalog
            </NavLink>
            <NavLink
              to="/cart"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`
              }
            >
              <ShoppingCart className="h-4 w-4" />
              Cart
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {cartItemCount}
              </span>
            </NavLink>
            {user && (
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`
                }
              >
                Profile
              </NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-stone-950'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`
                }
              >
                <LayoutDashboard className="h-4 w-4" />
                Admin
              </NavLink>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-700">
                <User className="h-4 w-4" />
                <span className="font-medium">{user.fullName || user.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
