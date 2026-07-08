PRD Resto POS v1.1 — Confidential
 
**PRODUCT REQUIREMENT DOCUMENT (PRD)**
 
**Sistem Informasi Resto POS**
 
(Point of Sale) Berbasis Offline-First
 
**Versi 1.1 — Revisi Penambahan Fitur Keuangan ****&**** Costing**
 
Tanggal Revisi: 7 Juli 2026
 
Status: Draft / Revised
 
Target Platform: Cross-Platform (Web & Mobile/Tablet)
 
Arsitektur: Hybrid Cloud / Offline-First Sync
 
# **1. Ringkasan Eksekutif ****&**** Latar Belakang**
 
Dokumen ini merinci kebutuhan produk (PRD) untuk pengembangan aplikasi Resto POS, sebuah sistem kasir dan manajemen operasional restoran terintegrasi. Tantangan utama dalam bisnis retail makanan dan minuman (F&B) adalah ketergantungan penuh pada koneksi internet. Jika internet terputus, operasional kasir dan dapur bisa lumpuh. Oleh karena itu, aplikasi ini dirancang menggunakan pendekatan Offline-First Architecture, memastikan transaksi tetap dapat berjalan 100% lancar secara lokal, dan data akan disinkronisasikan ke pusat (cloud) secara otomatis begitu koneksi internet pulih.
 
Revisi v1.1 menambahkan tiga fitur baru pada Modul Resep, Modul Keuangan, dan Modul Laporan untuk menjawab kebutuhan spesifik: penentuan harga jual yang masih berbasis perkiraan, dan sulitnya melacak sumber kebocoran keuangan pada operasional harian rumah makan.
 
# **2. Spesifikasi Tech Stack ****&**** Arsitektur Sistem**
 
Berdasarkan kebutuhan fungsionalitas dan fleksibilitas platform, berikut adalah keputusan teknologi yang digunakan:
 
- Frontend: Flutter atau React.js (lintas platform untuk tablet kasir, perangkat mobile pelayan, dan dashboard monitor dapur).
 
- Backend Server: Node.js (RESTful API untuk sinkronisasi dan agregasi data).
 
- Database Pusat (Cloud): PostgreSQL (konsistensi data finansial, pelacakan stok, riwayat audit).
 
- Database Lokal (Client-Side): SQLite / Hive / IndexedDB (state lokal selama offline).
 
## **Mekanisme Sinkronisasi Offline-to-Cloud**
 
Aplikasi menggunakan penanda waktu (timestamping) dan antrean lokal (Local Queue) untuk setiap perubahan data (insert/update). Saat koneksi terdeteksi terhubung kembali, modul sinkronisasi melakukan push data antrean lokal ke backend Node.js menggunakan pendekatan Idempotent API guna mencegah duplikasi data transaksi.
 
# **3. Kebutuhan Fungsional (Modul Berdasarkan Mindmap)**
 
## **3.1. Modul Dashboard**
 
| **Fitur Utama** | **Deskripsi ****&**** Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| Ringkasan Hari Ini | Menampilkan metrik utama real-time (atau data lokal terakhir) seperti total pendapatan hari ini, jumlah struk tercetak, dan metode pembayaran terpopuler. | High |
| Akses Kasir Cepat | Tombol pintas langsung menuju halaman transaksi kasir tanpa navigasi berulang, menghemat waktu tunggu pelanggan. | High |
| Grafik Penjualan | Visualisasi tren penjualan per jam atau per kategori menu terlaris untuk melihat performa resto secara sekilas. | Medium |
 
## **3.2. Modul Kasir (Point of Sale)**
 
| **Fitur Utama** | **Deskripsi ****&**** Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| Pilih Menu | Grid/List menu responsif lengkap dengan pencarian cepat dan filter kategori. Mendukung penambahan item ke keranjang dengan satu ketukan. | High |
| Opsi Pembayaran | Mendukung Tunai, QRIS/E-Wallet, dan Kartu Debit/Kredit. Pada mode offline, QRIS dinamis otomatis nonaktif dan menggunakan QRIS statis bawaan. | High |
| Cetak Struk | Integrasi ke printer thermal (Bluetooth/USB/LAN) untuk mencetak bukti transaksi segera setelah status pembayaran sukses atau tersimpan lokal. | High |
 
## **3.3. Modul Menu ****&**** Manajemen Varian**
 
| **Fitur Utama** | **Deskripsi ****&**** Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| Daftar Menu | Katalog induk seluruh makanan dan minuman. Admin dapat mengatur status aktif/nonaktif, harga dasar, gambar, dan kategori produk. | High |
| Kelola Varian | Pengaturan ukuran atau opsi khusus produk (mis. Reguler/Large, Dingin/Normal) dengan penyesuaian harga diferensial. | High |
| Modifier Tambahan | Sistem add-ons/topping tambahan (mis. ekstra keju, tambah telur) yang opsional dipilih konsumen dan menambah biaya langsung pada keranjang. | Medium |
 
## **3.4. Modul Resep ****&**** Manajemen Stok**
 
| **Fitur Utama** | **Deskripsi ****&**** Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| Bahan Baku | Pencatatan inventaris bahan mentah (daging kiloan, minyak literan, telur boks) lengkap dengan satuan ukur baku. | High |
| Komposisi Menu | Menghubungkan menu dengan bahan baku (BOM - Bill of Materials). Contoh: 1 Porsi Nasi Goreng memotong 100gr beras, 1 butir telur, 10ml minyak. | High |
| Pantau Stok | Sistem pengurang stok otomatis setiap kali menu terjual. Notifikasi ambang batas minimum (low stock alert) jika bahan baku menipis. | High |
| **Kalkulasi HPP Otomatis** | Sistem menghitung harga pokok produksi tiap menu berdasarkan komposisi bahan baku (BOM) dikali harga beli bahan terkini. Hasilnya dibandingkan otomatis dengan harga jual saat ini, menampilkan persentase margin per menu. Menjawab kebutuhan penentuan harga jual yang selama ini berbasis perkiraan. | High |
 
***  [REVISI v1.1 — FITUR BARU]***
 
## **3.5. Modul Keuangan**
 
| **Fitur Utama** | **Deskripsi ****&**** Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| Catat Pemasukan | Pencatatan otomatis dari transaksi kasir serta opsi pencatatan manual untuk pendapatan non-penjualan menu (bagi hasil vendor, modal awal kas besar). | High |
| Catat Pengeluaran | Pencatatan biaya operasional kas kecil (petty cash), seperti membeli gas elpiji darurat, es batu tambahan, atau biaya kebersihan harian. | High |
| Riwayat Keuangan | Buku kas harian yang menampilkan arus kas masuk dan keluar secara kronologis untuk mempermudah cash reconciliation di akhir shift. | High |
| **Rekonsiliasi Stok vs Penjualan** | Sistem membandingkan jumlah bahan baku yang seharusnya terpakai (dihitung dari total menu terjual dikali BOM) dengan stok fisik hasil opname manual. Selisih ditampilkan sebagai indikator kebocoran (bahan hilang, porsi tidak konsisten, atau kesalahan pencatatan). Menjawab kebutuhan pelacakan sumber kebocoran keuangan operasional. | High |
 
***  [REVISI v1.1 — FITUR BARU]***
 
## **3.6. Modul Dapur (Kitchen Display System - KDS)**
 
| **Fitur Utama** | **Deskripsi ****&**** Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| Pesanan Masuk | Layar khusus antrean juru masak yang menampilkan antrean pesanan berdasarkan nomor meja/nomor pesanan dan waktu tunggu secara kronologis. | High |
| Tandai Selesai | Tombol interaksi bagi staf dapur untuk mengubah status pesanan dari 'Sedang Dimasak' menjadi 'Siap Disajikan'. Mengirimkan sinyal otomatis ke kasir/pelayan. | High |
 
## **3.7. Modul Laporan (Reporting ****&**** Analytics)**
 
| **Fitur Utama** | **Deskripsi ****&**** Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| Laporan Harian | Rangkuman menyeluruh performa toko penutupan hari (Z-Report), mencakup total penjualan, metode pembayaran bersih, dan kalkulasi sisa stok fisik. | High |
| **Ringkasan Margin Harian** | Menampilkan total pendapatan dikurangi estimasi HPP dari seluruh transaksi hari itu, sehingga owner dapat langsung melihat estimasi profit kotor harian tanpa menunggu rekap akhir bulan. Ditarik langsung dari data Kalkulasi HPP Otomatis pada Modul Resep. | High |
| Cetak Laporan | Ekspor laporan penjualan ke format fisik (Thermal Printer) atau format digital universal (spreadsheet/PDF) untuk kebutuhan arsip manajemen. | Medium |
| Filter Tanggal | Kemampuan analisis mendalam untuk melihat performa historis mingguan, bulanan, atau kustom rentang waktu tertentu. | High |
 
***  [REVISI v1.1 — FITUR BARU]***
 
## **3.8. Modul Pengaturan ****&**** Manajemen Akun**
 
| **Fitur Utama** | **Deskripsi ****&**** Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| Login & Logout | Autentikasi akun pengguna. Mendukung validasi PIN lokal cepat khusus staf kasir untuk mempermudah pergantian shift tanpa mengetik email panjang. | High |
| Ganti Kata Sandi | Fitur keamanan mandiri bagi pengguna untuk memperbarui kredensial akun secara periodik guna meminimalkan risiko kebocoran akses. | Medium |
| Manajemen Akun | Pengaturan Role-Based Access Control (RBAC) oleh Owner/Admin untuk membatasi hak akses (Kasir hanya transaksi; Juru masak hanya modul dapur; Owner melihat keuangan). | High |
 
# **4. Kebutuhan Non-Fungsional (Non-Functional Requirements)**
 
- Keandalan Offline: Aplikasi klien harus dapat menyimpan setidaknya 5.000 data transaksi lokal tanpa degradasi performa sebelum sinkronisasi ke cloud pusat.
 
- Keamanan Data: Password wajib di-hash menggunakan Bcrypt/Argon2 di backend. Kredensial lokal (state token) disimpan menggunakan enkripsi aman pada storage internal perangkat.
 
- Performa: Respon cetak struk lokal dan pemrosesan kalkulasi keranjang belanja harus di bawah 200 milidetik demi menjaga ritme kecepatan pelayanan kasir.
 
- Akurasi Kalkulasi Biaya: Kalkulasi HPP dan rekonsiliasi stok harus konsisten menggunakan satuan ukur baku yang sama antara Modul Resep dan Modul Keuangan untuk menghindari selisih akibat konversi satuan.
 
# **5. Ringkasan Perubahan (Changelog v1.0 → v1.1)**
 
| **Fitur Utama** | **Deskripsi ****&**** Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| **Kalkulasi HPP Otomatis** | Ditambahkan pada Modul Resep & Manajemen Stok. Menjawab masalah penentuan harga jual yang masih berbasis perkiraan. | High |
| **Rekonsiliasi Stok vs Penjualan** | Ditambahkan pada Modul Keuangan. Menjawab masalah pelacakan sumber kebocoran keuangan operasional harian. | High |
| **Ringkasan Margin Harian** | Ditambahkan pada Modul Laporan. Memberi gambaran profit kotor harian secara instan. | High |
## 3.9. Modul Resep & Manajemen Stok

| **Fitur Utama** | **Deskripsi & Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| **Kalkulasi HPP Otomatis** | Sistem menghitung harga pokok produksi tiap menu berdasarkan komposisi bahan baku (BOM) dikali harga beli bahan terkini. Hasilnya dibandingkan otomatis dengan harga jual saat ini, menampilkan persentase margin per menu. Menjawab kebutuhan penentuan harga jual yang selama ini berbasis perkiraan. | High |

***  [REVISI v1.1 — FITUR BARU]***

## 3.10. Modul Keuangan

| **Fitur Utama** | **Deskripsi & Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| **Rekonsiliasi Stok vs Penjualan** | Sistem membandingkan jumlah bahan baku yang seharusnya terpakai (dihitung dari total menu terjual dikali BOM) dengan stok fisik hasil opname manual. Selisih ditampilkan sebagai indikator kebocoran (bahan hilang, porsi tidak konsisten, atau kesalahan pencatatan). Menjawab kebutuhan pelacakan sumber kebocoran keuangan operasional. | High |

***  [REVISI v1.1 — FITUR BARU]***

## 3.11. Modul Laporan (Reporting & Analytics)

| **Fitur Utama** | **Deskripsi & Alur Kerja** | **Prioritas** |
| --- | --- | --- |
| **Ringkasan Margin Harian** | Menampilkan total pendapatan dikurangi estimasi HPP dari seluruh transaksi hari itu, sehingga owner dapat langsung melihat estimasi profit kotor harian tanpa menunggu rekap akhir bulan. Ditarik langsung dari data Kalkulasi HPP Otomatis pada Modul Resep. | High |
# **5. Database Schema**
# Resto POS Schema v2 (Pangkas Over-Engineering)

Perubahan dari versi awal:
- `stores` dihapus. Single restaurant, `store_id` dicabut dari semua tabel.
- `idempotency_keys` dihapus, dedup cukup pakai unique constraint di `sync_mutations.idempotency_key`.
- `devices` (tabel registrasi) dihapus, `device_id` jadi kolom teks biasa yang di-generate client-side.
- `kds_events` dihapus, status dapur cukup pakai `orders.status` + `orders.updated_at`.
- `sync_status` dipangkas, `conflict` state cuma perlu di app logic untuk master data (menu, bahan baku, user), bukan enum tersendiri di append-only table.
- Timezone dihapus dari database, cukup konstanta `Asia/Jakarta` di app config, ga perlu kolom buat satu resto.

## PostgreSQL Schema

```sql
create extension if not exists pgcrypto;

create type user_role as enum ('owner', 'admin', 'cashier', 'chef');
create type order_status as enum ('draft', 'paid', 'cooking', 'ready', 'served', 'cancelled');
create type payment_method as enum ('cash', 'static_qris', 'dynamic_qris', 'ewallet', 'debit_credit');
create type sync_operation as enum ('insert', 'update', 'delete');
create type sync_status as enum ('pending', 'processing', 'synced', 'failed');
create type ledger_type as enum ('income', 'expense');

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  password_hash text not null,
  pin_hash text,
  role user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),
  name text not null,
  description text,
  base_price numeric(14,2) not null check (base_price >= 0),
  image_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table variant_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,
  is_required boolean not null default false,
  max_selected int not null default 1
);

create table variants (
  id uuid primary key default gen_random_uuid(),
  variant_group_id uuid not null references variant_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(14,2) not null default 0,
  is_active boolean not null default true
);

create table modifiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_delta numeric(14,2) not null default 0,
  is_active boolean not null default true
);

create table raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  unit_cost numeric(14,2) not null default 0, -- dipakai buat kalkulasi HPP
  minimum_quantity numeric(14,3) not null default 0,
  current_quantity numeric(14,3) not null default 0,
  updated_at timestamptz not null default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  raw_material_id uuid not null references raw_materials(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unique (menu_item_id, raw_material_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  device_id text not null, -- ponytail: string biasa, generate uuid di client, tabel devices ga perlu sampai butuh remote device management
  receipt_number text not null unique,
  table_number text,
  status order_status not null default 'paid',
  subtotal numeric(14,2) not null,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null,
  paid_at timestamptz not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now() -- ponytail: dipakai juga buat status dapur, event log terpisah nyusul kalau butuh timeline penuh
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id),
  item_name text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null,
  selected_variants jsonb not null default '[]',
  selected_modifiers jsonb not null default '[]',
  kitchen_note text
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method payment_method not null,
  amount numeric(14,2) not null check (amount >= 0),
  provider_reference text,
  is_offline boolean not null default false,
  created_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  raw_material_id uuid not null references raw_materials(id),
  order_id uuid references orders(id),
  movement_type text not null, -- 'sale_deduction' | 'manual_adjustment' | 'opname_correction'
  quantity_delta numeric(14,3) not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table finance_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  type ledger_type not null,
  category text not null,
  amount numeric(14,2) not null check (amount >= 0),
  payment_method payment_method,
  description text,
  occurred_at timestamptz not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table sync_mutations (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  idempotency_key text not null unique, -- dedup cukup di sini, ga perlu tabel idempotency_keys terpisah
  entity_type text not null,
  entity_id uuid,
  operation sync_operation not null,
  payload jsonb not null,
  client_created_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  status sync_status not null default 'synced'
);

create index idx_orders_paid_at on orders(paid_at desc);
create index idx_payments_order on payments(order_id);
create index idx_stock_movements_material_created on stock_movements(raw_material_id, created_at desc);
create index idx_finance_ledger_occurred on finance_ledger(occurred_at desc);
```

## Client IndexedDB Schema

```ts
export const localSchema = {
  users: 'id, role, isActive, updatedAt',
  categories: 'id, name, isActive, updatedAt',
  menuItems: 'id, categoryId, name, isActive, updatedAt',
  variantGroups: 'id, menuItemId',
  variants: 'id, variantGroupId, isActive',
  modifiers: 'id, isActive',
  rawMaterials: 'id, name, unitCost, currentQuantity, minimumQuantity, updatedAt',
  recipes: 'id, menuItemId, rawMaterialId',
  orders: 'id, receiptNumber, status, paidAt, syncStatus',
  orderItems: 'id, orderId, menuItemId',
  payments: 'id, orderId, method, createdAt',
  stockMovements: 'id, rawMaterialId, orderId, createdAt, syncStatus',
  financeLedger: 'id, type, occurredAt, syncStatus',
  syncQueue: '++localSequence, idempotencyKey, entityType, entityId, operation, syncStatus, createdAt',
  appSettings: 'key'
};
```

### Local Sync Queue Record

```ts
type LocalSyncQueueItem = {
  localSequence?: number;
  idempotencyKey: string;
  deviceId: string;
  entityType: 'order' | 'stockMovement' | 'financeLedger' | 'menuItem' | 'rawMaterial';
  entityId: string;
  operation: 'insert' | 'update' | 'delete';
  payload: unknown;
  requestHash: string;
  syncStatus: 'pending' | 'processing' | 'synced' | 'failed';
  retryCount: number;
  createdAt: string;
  lastTriedAt?: string;
  errorMessage?: string;
};
```

### Conflict Handling (App Logic, Bukan Kolom Database)

Cuma relevan buat master data yang bisa diedit dua tempat: `menuItems`, `rawMaterials`, `categories`, `variantGroups`, `variants`, `modifiers`, `users`. Saat sync, bandingkan `updatedAt` lokal vs server, yang lebih baru menang (last-write-wins). Ga perlu tabel `syncConflicts` atau state `conflict` di enum sampai ada kasus nyata yang butuh manual review.

Transaksi (`orders`, `payments`, `stockMovements`, `financeLedger`) append only, insert doang lewat `idempotency_key`, ga akan pernah conflict.

`net: -3 tabel (stores, idempotency_keys, devices), -1 tabel opsional (kds_events), enum sync_status dari 5 jadi 4 state.`