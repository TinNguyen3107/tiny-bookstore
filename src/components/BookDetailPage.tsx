import { ShoppingCart } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { Book } from '../types';
import { formatCurrency } from '../utils';

interface BookDetailPageProps {
  books: Book[];
  onAddToCart: (book: Book) => void;
}

export default function BookDetailPage({
  books,
  onAddToCart,
}: BookDetailPageProps) {
  const { id } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const bookId = Number(id);

    if (!Number.isInteger(bookId) || bookId <= 0) {
      setError('Invalid book.');
      setLoading(false);
      return;
    }

    const existingBook = books.find((entry) => entry.id === bookId);

    if (existingBook) {
      setBook(existingBook);
      setLoading(false);
      return;
    }

    apiRequest<Book>(`/api/books/${bookId}`)
      .then((data) => {
        setBook(data);
      })
      .catch((detailError) => {
        setError(
          detailError instanceof Error
            ? detailError.message
            : 'Could not load book details.'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [books, id]);

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-stone-200 bg-white p-10 text-center text-stone-500 shadow-sm">
        Loading book details...
      </div>
    );
  }

  if (!book || error) {
    return (
      <div className="space-y-4 rounded-[2rem] border border-stone-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-black text-stone-900">
          Book not found
        </h1>
        <p className="text-sm text-stone-500">
          {error || 'This book no longer exists in the catalog.'}
        </p>
        <Link
          to="/"
          className="inline-flex rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-700"
        >
          Back to catalog
        </Link>
      </div>
    );
  }

  const outOfStock = book.stock <= 0;

  return (
    <div className="space-y-8">
      <Link
        to="/"
        className="inline-flex items-center rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-sm transition-colors hover:bg-stone-100 hover:text-stone-900"
      >
        Back to catalog
      </Link>

      <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[0.84fr_1.16fr]">
          <div className="relative min-h-[340px] bg-stone-100">
            {book.cover ? (
              <img
                src={book.cover}
                alt={book.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[340px] items-center justify-center text-stone-400">
                No cover
              </div>
            )}
          </div>

          <div className="flex flex-col p-6 lg:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
                  Book details
                </div>
                <h1 className="mt-3 text-3xl font-black leading-tight text-stone-950 lg:text-[2rem]">
                  {book.title}
                </h1>
                <p className="mt-2 text-base text-stone-500">{book.author}</p>
              </div>

              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  outOfStock
                    ? 'bg-red-100 text-red-600'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {outOfStock ? 'Out of stock' : `${book.stock} in stock`}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-stone-50 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-stone-400">
                  Price
                </div>
                <div className="mt-2 text-2xl font-black text-stone-950">
                  {formatCurrency(book.price)}
                </div>
              </div>
              <div className="rounded-3xl bg-stone-50 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-stone-400">
                  Stock
                </div>
                <div className="mt-2 text-2xl font-black text-stone-950">
                  {book.stock}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-stone-400">
                Description
              </h2>
              <div className="mt-3 max-h-52 overflow-y-auto rounded-3xl border border-stone-200 bg-stone-50 p-4">
                <p className="whitespace-pre-line pr-2 text-base leading-8 text-stone-600">
                  {book.description || 'This book does not have a description yet.'}
                </p>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button
                onClick={() => onAddToCart(book)}
                disabled={outOfStock}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                <ShoppingCart className="h-4 w-4" />
                {outOfStock ? 'Unavailable' : 'Add to cart'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
