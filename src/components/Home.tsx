import { useEffect, useState } from 'react';
import { ShoppingCart, ChevronDown, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book, CartItem, Category } from '../types';
import { formatCurrency } from '../utils';
import { apiRequest } from '../api';

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'recent' | 'all'>('recent');
  const [showCategories, setShowCategories] = useState(false);
  const [showFormats, setShowFormats] = useState(false);
  const [showPublishers, setShowPublishers] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedPublisher, setSelectedPublisher] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | null>(null);

  const availableFormats = Array.from(new Set(books.map(b => b.format).filter(Boolean))) as string[];
  const availablePublishers = Array.from(new Set(books.map(b => b.publisher).filter(Boolean))) as string[];

  useEffect(() => {
    apiRequest<Category[]>('/api/categories')
      .then(setCategories)
      .catch(console.error);
  }, []);

  const renderBookCard = (book: Book) => {
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
                {book.categoryName || 'Uncategorized'}
              </span>
            </div>
            <div className="absolute right-3 bottom-3 z-10">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
                  outOfStock
                    ? 'bg-red-100 text-red-600'
                    : 'bg-sky-100 text-sky-600'
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
                  <div className="mt-1 text-2xl font-black tracking-tight text-stone-950 whitespace-nowrap">
                    {formatCurrency(book.price)}
                  </div>
                </div>

                {!outOfStock && (
                  <div className="rounded-2xl bg-sky-50 px-3 py-2 text-right">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-sky-600">
                      Ready
                    </div>
                    <div className="text-[13px] font-bold text-sky-700">
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-400 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-200"
          >
            <ShoppingCart className="h-4 w-4" />
            {outOfStock ? 'Unavailable' : 'Add to cart'}
          </button>
        </div>
      </article>
    );
  };

  let searchedBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentBooks = [...searchedBooks]
    .sort((a, b) => b.id - a.id)
    .slice(0, 4);

  if (selectedFormat) {
    searchedBooks = searchedBooks.filter(b => b.format === selectedFormat);
  }
  if (selectedPublisher) {
    searchedBooks = searchedBooks.filter(b => b.publisher === selectedPublisher);
  }

  if (sortOrder === 'newest') {
    searchedBooks.sort((a, b) => (b.publishedYear || 0) - (a.publishedYear || 0));
  } else if (sortOrder === 'oldest') {
    searchedBooks.sort((a, b) => (a.publishedYear || 0) - (b.publishedYear || 0));
  } else {
    searchedBooks.sort((a, b) => b.id - a.id);
  }

  return (
    <div className="space-y-8">
      <section 
        className="relative overflow-hidden rounded-[2rem] bg-cover bg-center px-6 py-10 text-white shadow-lg sm:px-10"
        style={{
          backgroundImage: 'url(/logo/background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative max-w-3xl space-y-4">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white drop-shadow-lg">
            Tiny Bookstore Collection
          </div>
          <h1 className="text-4xl font-black leading-tight drop-shadow-lg sm:text-5xl">
            Build your reading stack, then check out in one clean flow.
          </h1>
          <p className="max-w-2xl text-base text-white drop-shadow-lg sm:text-lg">
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
        <>
          <div className="flex flex-col gap-4 border-b border-stone-200 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-6">
              <button
                onClick={() => {
                  setActiveTab('recent');
                  setSelectedCategory(null);
                  setShowCategories(false);
                  setVisibleCount(8);
                  setSearchQuery('');
                  setSelectedFormat(null);
                  setSelectedPublisher(null);
                  setSortOrder(null);
                }}
                className={`pb-2 text-lg font-bold transition-colors ${
                  activeTab === 'recent'
                    ? 'border-b-2 border-sky-500 text-sky-600'
                    : 'border-b-2 border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => {
                  setActiveTab('all');
                  setVisibleCount(8);
                }}
                className={`pb-2 text-lg font-bold transition-colors ${
                  activeTab === 'all'
                    ? 'border-b-2 border-sky-500 text-sky-600'
                    : 'border-b-2 border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                All Books
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search by title or author..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab === 'recent' && e.target.value) {
                    setActiveTab('all');
                  }
                  setVisibleCount(8);
                }}
                className="w-full rounded-full border border-stone-400 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {activeTab === 'recent' && (
            <div className="space-y-6">
              {recentBooks.length > 0 ? (
                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                  {recentBooks.map(renderBookCard)}
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-dashed border-stone-300 py-12 text-center text-stone-500">
                  No recent books found.
                </div>
              )}
            </div>
          )}

          {activeTab === 'all' && (
            <div className="mt-6 space-y-8">
              <div className="flex flex-wrap items-center gap-4">
                {categories.length > 0 && (
                  <div className="relative inline-block w-fit">
                    <button
                      onClick={() => {
                        setShowCategories(!showCategories);
                        setShowFormats(false);
                        setShowPublishers(false);
                        setShowSort(false);
                      }}
                      className="flex items-center gap-2 rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
                    >
                      {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name || 'Categories' : 'All Categories'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${showCategories ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCategories && (
                    <div className="absolute left-0 top-full z-20 mt-2 w-64 max-h-[320px] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                      <button
                        onClick={() => {
                          setSelectedCategory(null);
                          setShowCategories(false);
                          setVisibleCount(8);
                        }}
                        className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${
                          selectedCategory === null ? 'bg-sky-50 text-sky-700' : 'text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        All Books
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setShowCategories(false);
                            setVisibleCount(8);
                          }}
                          className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${
                            selectedCategory === cat.id ? 'bg-sky-50 text-sky-700' : 'text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {availableFormats.length > 0 && (
                <div className="relative inline-block w-fit">
                  <button
                    onClick={() => {
                      setShowFormats(!showFormats);
                      setShowCategories(false);
                      setShowPublishers(false);
                      setShowSort(false);
                    }}
                    className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                  >
                    {selectedFormat || 'All Formats'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${showFormats ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showFormats && (
                    <div className="absolute left-0 top-full z-20 mt-2 w-56 max-h-[320px] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                      <button
                        onClick={() => {
                          setSelectedFormat(null);
                          setShowFormats(false);
                          setVisibleCount(8);
                        }}
                        className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${
                          selectedFormat === null ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        All Formats
                      </button>
                      {availableFormats.map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setSelectedFormat(f);
                            setShowFormats(false);
                            setVisibleCount(8);
                          }}
                          className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${
                            selectedFormat === f ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {availablePublishers.length > 0 && (
                <div className="relative inline-block w-fit">
                  <button
                    onClick={() => {
                      setShowPublishers(!showPublishers);
                      setShowCategories(false);
                      setShowFormats(false);
                      setShowSort(false);
                    }}
                    className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                  >
                    {selectedPublisher || 'All Publishers'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${showPublishers ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showPublishers && (
                    <div className="absolute left-0 top-full z-20 mt-2 w-64 max-h-[320px] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                      <button
                        onClick={() => {
                          setSelectedPublisher(null);
                          setShowPublishers(false);
                          setVisibleCount(8);
                        }}
                        className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${
                          selectedPublisher === null ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        All Publishers
                      </button>
                      {availablePublishers.map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setSelectedPublisher(p);
                            setShowPublishers(false);
                            setVisibleCount(8);
                          }}
                          className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${
                            selectedPublisher === p ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="relative inline-block w-fit">
                <button
                  onClick={() => {
                    setShowSort(!showSort);
                    setShowCategories(false);
                    setShowFormats(false);
                    setShowPublishers(false);
                  }}
                  className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                >
                  {sortOrder === 'newest' ? 'Newest Published' : sortOrder === 'oldest' ? 'Oldest Published' : 'Default Sorting'}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showSort ? 'rotate-180' : ''}`} />
                </button>
                
                {showSort && (
                  <div className="absolute left-0 top-full z-20 mt-2 w-56 max-h-[320px] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                    <button
                      onClick={() => {
                        setSortOrder(null);
                        setShowSort(false);
                      }}
                      className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${
                        sortOrder === null ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      Default Sorting
                    </button>
                    <button
                      onClick={() => {
                        setSortOrder('newest');
                        setShowSort(false);
                      }}
                      className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${
                        sortOrder === 'newest' ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      Newest Published
                    </button>
                    <button
                      onClick={() => {
                        setSortOrder('oldest');
                        setShowSort(false);
                      }}
                      className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${
                        sortOrder === 'oldest' ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      Oldest Published
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-12">
                {selectedCategory === null ? (
                  <div className="space-y-8">
                    {searchedBooks.length > 0 ? (
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                        {searchedBooks
                          .slice(0, visibleCount)
                          .map(renderBookCard)}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-stone-300 py-12 text-center text-stone-500">
                        No books match your search.
                      </div>
                    )}
                    
                    {visibleCount < searchedBooks.length && (
                      <div className="flex justify-center">
                        <button
                          onClick={() => setVisibleCount((prev) => prev + 8)}
                          className="rounded-full border border-stone-200 bg-white px-8 py-3 text-sm font-semibold text-stone-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:text-stone-900 hover:shadow-md"
                        >
                          See more
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  categories
                    .filter((cat) => selectedCategory === cat.id)
                    .map((cat) => {
                      const catBooks = searchedBooks.filter((b) => b.categoryId === cat.id);
                      
                      return (
                        <div key={cat.id} className="space-y-6">
                          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 shadow-sm">
                            <h3 className="mb-2 text-2xl font-black text-stone-900">
                              {cat.name}
                            </h3>
                            <p className="text-stone-600">
                              {cat.description || 'No description available for this category.'}
                            </p>
                          </div>
                          {catBooks.length > 0 ? (
                            <div className="space-y-8">
                              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                                {catBooks
                                  .slice(0, visibleCount)
                                  .map(renderBookCard)}
                              </div>
                              
                              {visibleCount < catBooks.length && (
                                <div className="flex justify-center">
                                  <button
                                    onClick={() => setVisibleCount((prev) => prev + 8)}
                                    className="rounded-full border border-stone-200 bg-white px-8 py-3 text-sm font-semibold text-stone-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:text-stone-900 hover:shadow-md"
                                  >
                                    See more
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-3xl border border-dashed border-stone-300 py-12 text-center text-stone-500">
                              No books found matching your search in this category.
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
