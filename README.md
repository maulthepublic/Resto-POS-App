# Resto POS App - Offline-First

Sistem Informasi Resto POS (Point of Sale) Berbasis Offline-First dengan Kalkulasi HPP Otomatis & Rekonsiliasi Keuangan.

---

## Deskripsi Singkat

Aplikasi POS ini dirancang dengan arsitektur **Offline-First**, yang memungkinkan kelancaran operasional kasir 100% tanpa internet. Sinkronisasi data ke cloud dilakukan secara otomatis setelah terdeteksi koneksi internet kembali.

- **Offline-First Sync:** Menggunakan antrean lokal client-side (IndexedDB) dan Idempotent API backend untuk mencegah duplikasi transaksi.
- **Kalkulasi HPP Otomatis:** Perhitungan harga pokok produksi otomatis berdasarkan BOM (Bill of Materials) menu.
- **Rekonsiliasi Stok & Penjualan:** Membandingkan konsumsi bahan baku teoritis vs opname fisik untuk mendeteksi kebocoran finansial.
- **Ringkasan Margin Harian:** Laporan profit kotor langsung setelah tutup hari.
- **Kitchen Display System (KDS):** Memantau pesanan masuk secara kronologis di dapur.
- **Role-Based Access Control (RBAC):** Pembagian akses bagi Owner, Admin, Kasir, dan Chef.

---

## Struktur Direktori Proyek

Proyek ini menggunakan struktur monorepo multi-folder yang tertata rapi:

```
resto-pos-app/
├── backend/                  # Node.js + Express + TypeScript Backend API
│   ├── src/                  # Source code server backend
│   └── prisma/               # Skema PostgreSQL ORM
├── frontend/                 # React.js + Vite + TypeScript Client App
│   ├── src/                  # React components, pages, hooks, & IndexedDB store
│   └── public/               # Asset publik client
├── database/                 # Skrip database & migrasi SQL pusat
│   └── schema.sql            # File DDL SQL PostgreSQL
└── docs/                     # PRD & Dokumen teknis pendukung
```

---

## Persyaratan Awal (Prerequisites)

- **Node.js** (versi >= 18.0.0)
- **PostgreSQL** Database Server
- **npm** (atau yarn/pnpm)

---

## Cara Memulai (Setup & Run)

### 1. Inisialisasi Database PostgreSQL
Jalankan script skema di folder `database/schema.sql` pada PostgreSQL database client Anda:
```bash
psql -U postgres -d nama_database_anda -f database/schema.sql
```

### 2. Jalankan Backend Server
1. Pindah ke direktori backend:
   ```bash
   cd backend
   ```
2. Pasang semua dependensi:
   ```bash
   npm install
   ```
3. Buat file `.env` dari salinan `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *(Sesuaikan isi `DATABASE_URL` dengan credential postgres lokal Anda)*
4. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
5. Jalankan server dalam mode pengembangan:
   ```bash
   npm run dev
   ```

### 3. Jalankan Frontend Client
1. Pindah ke direktori frontend:
   ```bash
   cd frontend
   ```
2. Pasang semua dependensi:
   ```bash
   npm install
   ```
3. Jalankan aplikasi web:
   ```bash
   npm run dev
   ```
4. Buka tautan server lokal di browser Anda (default: `http://localhost:3000`).
