# PintAR Mobile — Lab Sains Virtual

Laboratorium Sains Virtual berbasis WebAR untuk siswa **SMP/SMA Indonesia**.  
Dioptimasi untuk HP budget — ringan, cepat, bisa offline.

## Fitur Utama

- **Mobile-First** — Didesain khusus untuk HP, bukan laptop
- **Dual Mode** — Mode AR (kamera + marker) ATAU mode Simulasi 2D (tanpa kamera)
- **PWA / Offline** — Install di home screen, bisa dipakai tanpa internet
- **LKS Digital** — Lembar Kerja Siswa dengan fitur share ke WhatsApp/Classroom
- **Guided Tutorial** — Panduan langkah demi langkah untuk siswa yang baru pertama pakai
- **Sensor HP** — Giroskop untuk mengatur sudut, akselerometer untuk interaksi (goyangkan HP)
- **Light Theme Default** — Kontras tinggi, mudah dibaca di luar ruangan
- **Performa Ringan** — AR di-load hanya saat dibutuhkan (lazy-load), tanpa particle effects berat

## Eksperimen

| No | Eksperimen | Mapel | Sensor |
|----|-----------|-------|--------|
| 1 | Bandul (Pendulum) | Fisika | Giroskop |
| 2 | Gerak Jatuh Bebas | Fisika | Akselerometer (shake) |
| 3 | Reaksi Kimia | Kimia | Akselerometer (shake) |

## Cara Pakai

1. Buka website di HP (Chrome/Safari)
2. Pilih eksperimen
3. Pilih mode: **Simulasi** (langsung pakai) atau **AR** (butuh marker Hiro)
4. Atur parameter dan jalankan eksperimen
5. Isi LKS Digital (📋) → Share ke guru

## Tech Stack

- Vanilla HTML/CSS/JS (ES Modules)
- A-Frame + AR.js (lazy-loaded)
- Canvas 2D API (simulasi fallback)
- Service Worker (PWA/offline)
- Web Share API (kirim ke WA)
- Web Sensors API (akselerometer, giroskop)

## Struktur Folder

```
PintAR-Mobile/
├── index.html              # Landing page
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── css/styles.css          # Design system (mobile-first)
├── js/
│   ├── app.js              # Main app (toast, theme, PWA)
│   ├── modules/
│   │   ├── sensors.js      # Sensor abstraction
│   │   ├── lks.js          # LKS Digital + Web Share
│   │   ├── tutorial.js     # Onboarding system
│   │   ├── ar-loader.js    # Lazy AR loading + SimCanvas
│   │   └── graph.js        # Real-time graph
│   └── experiments/
│       ├── pendulum.js     # Bandul experiment
│       ├── freefall.js     # Gerak Jatuh Bebas
│       └── chemistry.js    # Reaksi Kimia
├── experiments/
│   ├── pendulum.html
│   ├── freefall.html
│   └── chemistry.html
└── assets/icons/           # PWA icons
```

## Target Pengguna

- **Siswa SMP/SMA** (usia 13-18 tahun)
- **HP budget** (RAM 2-3GB, Android Go, browser bawaan)
- **Sekolah tanpa lab** atau dengan jam praktikum terbatas
- **Koneksi internet tidak stabil** (bisa offline setelah first load)

## Perbedaan dengan PintAR Original

| Aspek | PintAR (Original) | PintAR Mobile (Ini) |
|-------|-------------------|---------------------|
| Target device | Desktop/HP flagship | HP budget SMP-SMA |
| Theme | Dark glassmorphism | Light default, high contrast |
| AR | Wajib (marker-only) | Opsional (ada mode simulasi 2D) |
| Loading | Semua di-load sekaligus | Lazy-load AR saat dibutuhkan |
| Particles/effects | 30 animated particles | Tidak ada (hemat RAM) |
| Export LKS | Download .txt | Web Share API (WA/Classroom) |
| Offline | Tidak | PWA + Service Worker |
| Tutorial | Tidak ada | Step-by-step onboarding |
| Font loading | Google Fonts (network) | System fonts (instant) |

## License

Educational use — dibuat untuk membantu siswa Indonesia belajar sains.
