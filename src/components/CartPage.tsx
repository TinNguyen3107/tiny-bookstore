import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CartItem, User } from '../types';
import { formatCurrency } from '../utils';

interface CartPageProps {
  cart: CartItem[];
  user: User | null;
  onQuantityChange: (bookId: number, quantity: number) => void;
  onRemove: (bookId: number) => void;
  onCheckout: () => Promise<unknown>;
}

export default function CartPage({
  cart,
  user,
  onQuantityChange,
  onRemove,
  onCheckout,
}: CartPageProps) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  async function handleCheckout() {
    setMessage('');
    setError('');
    setIsCheckingOut(true);

    try {
      await onCheckout();
      setMessage('Checkout completed successfully.');
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Checkout failed.'
      );
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
      <section className="space-y-4">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black text-stone-900">Your cart</h1>
          <p className="mt-2 text-sm text-stone-500">
            Increase or decrease quantities before checking out.
          </p>
        </div>

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

        {cart.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-stone-900">Cart is empty</h2>
            <p className="mt-2 text-sm text-stone-500">
              Add a few books from the catalog to start your order.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
            >
              Back to catalog
            </Link>
          </div>
        ) : (
          cart.map((item) => (
            <article
              key={item.bookId}
              className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="h-44 w-full overflow-hidden rounded-3xl bg-stone-100 md:w-36">
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-stone-400">
                      No cover
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-stone-900">
                          {item.title}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                          <span>{item.author}</span>
                          {item.bookCode && (
                            <>
                              <span className="text-stone-300">•</span>
                              <span className="font-mono text-xs">{item.bookCode}</span>
                            </>
                          )}
                          {item.format && (
                            <>
                              <span className="text-stone-300">•</span>
                              <span>{item.format}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-stone-400">Unit price</div>
                        <div className="text-lg font-bold text-stone-900">
                          {formatCurrency(item.price)}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-stone-500">
                      Available stock: {item.stock}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50">
                      <button
                        onClick={() =>
                          onQuantityChange(item.bookId, item.quantity - 1)
                        }
                        className="px-4 py-2 text-lg text-stone-600 hover:text-stone-900"
                      >
                        -
                      </button>
                      <span className="min-w-12 px-4 text-center text-sm font-semibold text-stone-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          onQuantityChange(item.bookId, item.quantity + 1)
                        }
                        className="px-4 py-2 text-lg text-stone-600 hover:text-stone-900"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-stone-900">
                        {formatCurrency(item.price * item.quantity)}
                      </div>
                      <button
                        onClick={() => onRemove(item.bookId)}
                        className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <aside className="h-fit rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black text-stone-900">Order summary</h2>
        <div className="mt-6 space-y-4 text-sm text-stone-600">
          <div className="flex items-center justify-between">
            <span>Items</span>
            <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-200 pt-4 text-base font-bold text-stone-900">
            <span>Total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        </div>

        {!user && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Please log in before checking out.
          </div>
        )}

        <button
          onClick={() => void handleCheckout()}
          disabled={cart.length === 0 || !user || isCheckingOut}
          className="mt-6 w-full rounded-full bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          {isCheckingOut ? 'Processing order...' : 'Checkout now'}
        </button>
      </aside>
    </div>
  );
}
