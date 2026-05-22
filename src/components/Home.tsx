import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book, CartItem } from '../types';
import { formatCurrency } from '../utils';

interface HomeProps {
  books: Book[];
  cart: CartItem[];
  loading: boolean;
  error: string;
  onAddToCart: (book: Book) => void;
}

export default function Home({
  books,
  cart,
  loading,
  error,
  onAddToCart,
}: HomeProps) {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-600 via-emerald-500 to-lime-400 px-6 py-10 text-white shadow-lg sm:px-10">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-50/80">
            Tiny Bookstore Collection
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Build your reading stack, then check out in one clean flow.
          </h1>
          <p className="max-w-2xl text-base text-emerald-50/90 sm:text-lg">
            Browse the catalog, add books to cart, adjust quantities, review your
            purchase history, and manage inventory from the same app.
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center text-stone-500 shadow-sm">
          Loading books...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {books.map((book) => {
            const cartQuantity =
              cart.find((item) => item.bookId === book.id)?.quantity ?? 0;
            const outOfStock = book.stock <= 0;

            return (
              <article
                key={book.id}
                className="group flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-stone-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-xl"
              >
                <Link to={`/books/${book.id}`} className="flex flex-1 flex-col">
                  <div className="relative aspect-[4/4.35] overflow-hidden bg-stone-100">
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 backdrop-blur">
                        Classic pick
                      </span>
                    </div>
                    <div className="absolute right-3 top-3 z-10">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
                          outOfStock
                            ? 'bg-red-100 text-red-600'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {outOfStock ? 'Out of stock' : `${book.stock} in stock`}
                      </span>
                    </div>

                    {book.cover ? (
                      <img
                        src={book.cover}
                        alt={book.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-400">
                        No cover
                      </div>
                    )}

                    {cartQuantity > 0 && (
                      <div className="absolute bottom-3 left-3 z-10 rounded-full bg-stone-950 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
                        In cart: {cartQuantity}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="space-y-2.5">
                      <div>
                        <h2 className="line-clamp-2 text-xl font-black leading-tight text-stone-900">
                          {book.title}
                        </h2>
                        <p className="mt-1 text-[15px] font-medium text-stone-500">
                          {book.author}
                        </p>
                      </div>

                      <p className="line-clamp-3 text-[14px] leading-6 text-stone-600">
                        {book.description || 'A book ready for your next reading session.'}
                      </p>
                    </div>

                    <div className="mt-auto pt-5">
                      <div className="mb-3 flex items-end justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.24em] text-stone-400">
                            Price
                          </div>
                          <div className="mt-1 text-[2rem] font-black tracking-tight text-stone-950">
                            {formatCurrency(book.price)}
                          </div>
                        </div>

                        {!outOfStock && (
                          <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right">
                            <div className="text-[9px] uppercase tracking-[0.2em] text-emerald-600">
                              Ready
                            </div>
                            <div className="text-[13px] font-bold text-emerald-800">
                              View detail
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="px-4 pb-4">
                  <button
                    onClick={() => onAddToCart(book)}
                    disabled={outOfStock}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {outOfStock ? 'Unavailable' : 'Add to cart'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
