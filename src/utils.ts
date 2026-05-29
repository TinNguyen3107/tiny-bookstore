import type { Book } from './types';

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function getSaleInfo(book: Pick<Book, 'price' | 'discountPercent' | 'saleEndsAt'>) {
  const discountPercent = Number(book.discountPercent ?? 0);
  const saleEndsAt = book.saleEndsAt ? new Date(book.saleEndsAt).getTime() : 0;
  const isActive =
    discountPercent > 0 &&
    discountPercent < 100 &&
    Number.isFinite(saleEndsAt) &&
    saleEndsAt > Date.now();

  if (!isActive) {
    return {
      isActive: false,
      discountPercent: 0,
      salePrice: book.price,
      remainingMs: 0,
    };
  }

  return {
    isActive: true,
    discountPercent,
    salePrice: Math.round((book.price * (100 - discountPercent)) / 100),
    remainingMs: saleEndsAt - Date.now(),
  };
}

export function formatSaleCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
