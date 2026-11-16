# Simple TodoList — Doscom University 2026

Aplikasi demo untuk bab **Cara deploy tradisional** pada kelas DevOps Doscom University 2026. Fitur: daftar akun, masuk, keluar, tambah tugas, edit, tandai selesai, hapus dengan konfirmasi, serta filter tugas. Setiap akun memiliki daftar tugas sendiri dan data disimpan di PostgreSQL.

## Kebutuhan

- Bun 1.4.2 atau lebih baru, tersedia pada `PATH` pengguna yang menjalankan aplikasi.
- PostgreSQL yang berjalan langsung di server. Contoh instalasi di bawah menggunakan Ubuntu Server 24.04 dengan PostgreSQL 16.
- `curl` untuk memeriksa endpoint aplikasi.

Server dan kode browser ditulis dalam TypeScript dengan API bawaan Bun. Dependensi pengembangan `typescript` dan `@types/bun` dipakai untuk pemeriksaan tipe. Bun menjalankan server TypeScript langsung dan menyiapkan JavaScript untuk browser saat startup, sehingga tidak perlu menjalankan build secara terpisah.

## 1. Siapkan PostgreSQL

Pada Ubuntu Server:

```bash
sudo apt update
sudo apt install -y postgresql postgresql-client curl unzip
sudo systemctl enable --now postgresql
```

Jika Bun belum terpasang, ikuti [panduan instalasi resmi Bun](https://bun.com/docs/installation), lalu periksa `bun --version` di terminal yang akan dipakai menjalankan aplikasi.

Buat role dan database khusus untuk demo pada instalasi PostgreSQL baru:

```bash
sudo -u postgres createuser --pwprompt todo
sudo -u postgres createdb --owner=todo todolist
```

Masukkan password untuk role `todo` saat diminta. Role ini merupakan pemilik database `todolist`; aplikasi tidak memerlukan hak superuser atau `CREATEDB`. Tabel `todos`, `users`, dan `sessions` dibuat otomatis saat aplikasi pertama kali dimulai. Gunakan database khusus demo karena aplikasi juga melakukan penyesuaian skema saat startup.

Periksa koneksi melalui TCP dengan password yang baru dibuat:

```bash
psql -h 127.0.0.1 -p 5432 -U todo -d todolist -W -c 'SELECT current_user, current_database();'
```

Opsi `-h 127.0.0.1` memastikan koneksi menggunakan TCP, sama seperti aplikasi. PostgreSQL cukup diakses dari server aplikasi melalui loopback.

## 2. Atur aplikasi

Dari root repo:

```bash
bun install --frozen-lockfile
cp .env.example .env
nano .env
```

Isi konfigurasi dengan password role `todo` yang dibuat sebelumnya:

```dotenv
HOST=0.0.0.0
PORT=3000
DATABASE_URL=postgres://todo:ganti_password_demo@127.0.0.1:5432/todolist
```

Ganti `ganti_password_demo` dengan password database. Jika password mengandung karakter khusus dalam URL seperti `@`, `:`, `/`, `#`, atau `%`, gunakan percent-encoding pada bagian password. `.env` diabaikan oleh Git; gunakan `.env.example` sebagai template yang dibagikan ke peserta.

`HOST=0.0.0.0` membuat aplikasi dapat diakses dari laptop peserta melalui IP server/VM. Untuk akses dari komputer yang sama saja, gunakan `HOST=127.0.0.1`. Bun otomatis membaca `.env` ketika perintah dijalankan dari root repo.

## 3. Jalankan secara manual

```bash
bun run start
```

Biarkan terminal tetap terbuka. Pada terminal kedua di server, periksa:

```bash
curl --fail http://127.0.0.1:3000/api/health
```

Hasil yang diharapkan:

```json
{"status":"ok","database":"postgres"}
```

Buka `http://<IP-SERVER>:3000` dari laptop peserta, atau `http://localhost:3000` jika browser dan aplikasi berada di komputer yang sama. Pastikan jaringan VM dan firewall server mengizinkan akses peserta ke port 3000. Buat akun melalui tombol **Daftar sekarang**, lalu tambahkan tugas pertama.

Tekan `Ctrl+C` di terminal aplikasi untuk menghentikannya. Menjalankan `bun run start` kembali tetap memakai data PostgreSQL yang sama. Proses aplikasi dalam demo ini mengikuti terminal dan perlu dijalankan lagi setelah server reboot. Untuk pengembangan lokal dengan restart otomatis saat kode server berubah, gunakan `bun run dev`. Setelah mengubah `src/client.ts`, mulai ulang server agar JavaScript browser dibuat kembali, lalu muat ulang halaman.

## Struktur

```text
.
├── .env.example
├── .gitignore
├── bun.lock
├── package.json
├── tsconfig.json
├── README.md
├── public/
│   ├── index.html
│   └── style.css
└── src/
    ├── client.ts
    ├── server.ts
    └── types.ts
```

## API

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/health` | Memeriksa koneksi PostgreSQL |
| POST | `/api/auth/register` | Daftar dan langsung masuk: `{"name":"Peserta","email":"peserta@example.com","password":"password-minimal-8-karakter"}` |
| POST | `/api/auth/login` | Masuk dengan email dan password |
| GET | `/api/auth/me` | Informasi akun yang sedang masuk |
| POST | `/api/auth/logout` | Keluar dan menghapus sesi aktif |
| GET | `/api/todos` | Daftar tugas akun yang sedang masuk |
| POST | `/api/todos` | Tambah tugas: `{"title":"Belajar deploy tradisional"}` |
| PATCH | `/api/todos/:id` | Edit judul dan/atau status: `{"completed":true}` |
| DELETE | `/api/todos/:id` | Hapus tugas |

Judul wajib diisi, maksimal 255 karakter. Semua endpoint tugas memerlukan login dan hanya mengakses tugas milik pengguna tersebut. Query menggunakan parameter melalui `Bun.SQL`. Password sepanjang 8–128 karakter disimpan sebagai hash Argon2id. Email dinormalisasi ke huruf kecil dan harus unik.

Sesi disimpan di PostgreSQL dengan token acak pada cookie HttpOnly dan SameSite=Lax selama tujuh hari. Cookie menggunakan Secure saat aplikasi menerima HTTPS. Logout membatalkan sesi di database. Permintaan tulis dari origin situs lain ditolak. Font Google bersifat opsional; saat offline, tampilan memakai font sistem.

## Pemeriksaan tipe

Dari root repo:

```bash
bun run typecheck
```

Perintah ini memeriksa kode server dan browser dengan TypeScript `strict` tanpa menghasilkan file build dan tanpa membutuhkan koneksi PostgreSQL. Untuk memeriksa aplikasi yang sudah berjalan, gunakan endpoint `/api/health`, lalu uji daftar akun dan tambah/edit/hapus tugas melalui browser.

## Sumber

Diadaptasi dari [aplikasi Simple TodoList](https://github.com/akmmp241/sistem-operasi-4302-16458/tree/8b558798afadb26cf3ac7c568630f4b2273ef79a/app). Referensi runtime: [Bun SQL](https://bun.com/docs/runtime/sql), [Bun HTTP server](https://bun.com/docs/runtime/http/server), dan [Bun environment variables](https://bun.com/docs/runtime/environment-variables).
