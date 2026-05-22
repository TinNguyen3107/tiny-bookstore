# Tiny Bookstore

Ung dung bookstore nho gom frontend React/Vite va backend Express + MySQL.

## Yeu cau

- Node.js 18+
- MySQL

## Cau hinh

1. Tao CSDL bang file [schema.sql](./schema.sql).
2. Copy `.env.example` thanh `.env` va dien thong tin ket noi MySQL.

## Chay local

```bash
npm install
npm run dev
```

Ung dung mac dinh chay tai `http://localhost:3000`.

## Scripts

- `npm run dev`: chay server Express + Vite dev middleware
- `npm run build`: build frontend va bundle server production
- `npm run start`: chay ban build trong `dist/`
- `npm run lint`: kiem tra TypeScript
- `npm run clean`: xoa output build
