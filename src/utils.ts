export function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
