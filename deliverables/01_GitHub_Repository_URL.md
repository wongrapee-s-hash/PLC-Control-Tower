# 1. ลิงก์ GitHub Repository

* **Repository URL:** https://github.com/wongrapee-s-hash/PLC-Control-Tower
* **Clone:** `git clone https://github.com/wongrapee-s-hash/PLC-Control-Tower.git`
* **Default Branch:** `main`
* **Visibility:** Public
* **CI/CD Status:** **ผ่าน** — https://github.com/wongrapee-s-hash/PLC-Control-Tower/actions/runs/36680273972
  มี GitHub Actions (`.github/workflows/ci.yml`) รัน type-check, lint, unit test 37 เคส และ production build ทุกครั้งที่ push เข้า `main` หรือเปิด Pull Request

## การตั้งค่าในเครื่อง

โปรเจกต์อยู่ที่ `C:\Users\mpalg\OneDrive\เดสก์ท็อป\pic\PLC-Control-Tower`
ตั้ง remote แล้ว และ commit ทั้งหมดอยู่ที่ branch `main`

```bash
git remote -v
# origin  https://github.com/wongrapee-s-hash/PLC-Control-Tower.git (fetch)
# origin  https://github.com/wongrapee-s-hash/PLC-Control-Tower.git (push)
```

> ไฟล์ที่ไม่ถูก commit: `node_modules/`, `.next/`, `.env*`, `*.tsbuildinfo`, `deliverables/Slides/assets/`
> ไฟล์ `.env.example` **ต้อง**อยู่ใน repo เพราะเป็นต้นแบบของตัวแปรที่ต้องตั้งค่า แต่ตัว `.env.local` จริงจะไม่ถูก commit
> ไม่มี secret, token หรือรหัสผ่านอยู่ในประวัติ git

## สิ่งที่อยู่ใน Repository

| ส่วน | ไฟล์ |
| --- | --- |
| โค้ดแอปพลิเคชัน | `src/` |
| เทสต์ | `tests/domain.test.ts`, `tests/sync.test.ts` |
| ฐานข้อมูล | `supabase/schema.sql`, `supabase/seed.sql`, `supabase/reset.sql` |
| ทดสอบกับฐานข้อมูลจริง | `supabase/tests/shim.sql`, `supabase/tests/rls.sql`, `scripts/db-test.mjs` |
| เอกสาร | `README.md` |
| ภาพหน้าจอ | `docs/screenshots/` |
| สไลด์นำเสนอ | `deliverables/Slides/` |
| Pipeline | `.github/workflows/ci.yml` |
| ผลส่งมอบ | `deliverables/` |

## รายการ Commit ที่ใช้

ตามรูปแบบ Conventional Commits:

1. `feat` — ระบบ Production Control Tower ครบทุกโมดูล
2. `docs` — บันทึกข้อจำกัดที่ทราบ และแก้จำนวนเทสต์เป็น 37
3. `fix` — แก้บั๊ก SQL 3 จุดที่เจอจากการรันกับ PostgreSQL จริง
4. `feat` — สไลด์นำเสนอ 15 หน้า สร้างจากตัวเลขจริงในชุดข้อมูล
