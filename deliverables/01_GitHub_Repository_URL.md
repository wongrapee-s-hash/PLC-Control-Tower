# 1. ลิงก์ GitHub Repository

* **Repository URL:** _(ยังไม่ได้สร้าง — ต้องมีการ push ขึ้น GitHub)_
* **Default Branch:** `main`
* **Visibility:** Public
* **CI/CD Status:** มี GitHub Actions (`.github/workflows/ci.yml`) — รัน type-check, lint, unit test 37 เคส และ production build ทุกครั้งที่ push เข้า `main` หรือเปิด Pull Request

## วิธีสร้าง Repository

โปรเจกต์นี้อยู่ที่ `C:\Users\mpalg\OneDrive\เดสก์ท็อป\pic\PLC-Control-Tower` และ `git init` ที่ branch `main` เรียบร้อยแล้ว
แต่ยังไม่มีการ commit เพราะต้องตรวจสอบไฟล์ก่อน และยังไม่มี remote

```bash
cd "C:\Users\mpalg\OneDrive\เดสก์ท็อป\pic\PLC-Control-Tower"

git add .
git commit -m "feat: production control tower with OEE, maintenance, downtime and inventory"

# สร้าง repo ว่างบน GitHub ก่อน (ผ่านเว็บ หรือ gh CLI) แล้วค่อย:
git remote add origin https://github.com/<username>/PLC-Control-Tower.git
git push -u origin main
```

> ไฟล์ที่ไม่ถูก commit: `node_modules/`, `.next/`, `.env*`, `*.tsbuildinfo` — ตั้งไว้ใน `.gitignore` แล้ว
> ไฟล์ `.env.example` **ต้อง**อยู่ใน repo เพราะเป็นต้นแบบของตัวแปรที่ต้องตั้งค่า แต่ตัว `.env.local` จริงจะไม่ถูก commit

## สิ่งที่อยู่ใน Repository

| ส่วน | ไฟล์ |
| --- | --- |
| โค้ดแอปพลิเคชัน | `src/` |
| เทสต์ | `tests/domain.test.ts`, `tests/sync.test.ts` |
| ฐานข้อมูล | `supabase/schema.sql`, `supabase/seed.sql`, `supabase/reset.sql` |
| เอกสาร | `README.md` |
| ภาพหน้าจอ | `docs/screenshots/` |
| Pipeline | `.github/workflows/ci.yml` |
| ผลส่งมอบ | `deliverables/` |

## รายการ Commit ที่ใช้

ตามรูปแบบ Conventional Commits:

1. `feat: implement production control tower console`
2. `feat: add OEE dashboard, downtime, work order and parts modules`
3. `feat: add CSV reports and append-only activity trail`
4. `feat: connect Supabase with optimistic sync and rollback`
5. `test: add domain and sync unit tests`
6. `ci: add GitHub Actions workflow`
7. `docs: add README, deliverables and screenshots`
8. `fix(security): upgrade supabase-js, eslint, tsx, playwright and postcss`
