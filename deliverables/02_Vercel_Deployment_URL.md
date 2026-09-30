# 2. ลิงก์ Vercel Deployment

* **Live Deployment URL:** _(ยังไม่ได้ deploy — ต้องเชื่อม repo กับบัญชี Vercel)_
* **Framework:** Next.js 15.5.26 (App Router)
* **สถานะ:** ผ่าน `npm run build` แล้ว แต่ยังไม่ได้ deploy จริง

## วิธี Deploy

1. นำเข้า repository จาก GitHub ที่ <https://vercel.com/new>
2. Framework Preset: **Next.js** (ตรวจพบอัตโนมัติ)
3. **ไม่ต้องตั้งค่า Environment Variables** เพื่อให้ระบบทำงานได้ทันที
   ถ้าไม่ตั้งค่า ระบบจะรันในโหมดออฟไลน์ด้วยชุดข้อมูลตัวอย่างที่ตรึงวันที่ `2026-09-30`
4. กด Deploy และรอ build ผ่าน

### ถ้าต้องการเชื่อม Supabase จริง

เพิ่ม Environment Variables ใน Vercel (Settings → Environment Variables) แล้ว Redeploy

| ตัวแปร | ค่า |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key จาก Project Settings → API |

ป้ายสถานะบนแถบด้านบนจะเปลี่ยนจาก "ข้อมูลตัวอย่าง" เป็น "เชื่อมต่อฐานข้อมูล" โดยอัตโนมัติ

## บัญชีทดสอบ (โหมดออฟไลน์)

บัญชีเหล่านี้มีผลเฉพาะเมื่อ **ไม่ได้** ตั้งค่า Supabase
เมื่อเชื่อมฐานข้อมูลจริง ปุ่มเลือกบัญชีจะถูกซ่อนและระบบจะใช้ Supabase Auth แทน

| บทบาท (Role) | อีเมล (Username) | รหัสผ่าน (Password) | ขอบเขตการใช้งาน |
|---|---|---|---|
| **ผู้ควบคุมการผลิต** (Admin) | `supervisor@factory.th` | `supervisor2026` | **ทุกฟังก์ชัน:** เครื่องจักร, ใบงานทุกชนิด, อะไหล่, เวลาหยุด, รายงาน, **บันทึกกิจกรรม**, ลบใบงาน |
| **วิศวกรเครื่องจักร** (Engineer) | `engineer@factory.th` | `engineer2026` | **ปฏิบัติงาน:** แก้เครื่องจักร, เดินสถานะใบงาน, จอง/เบิกอะไหล่, บันทึกเวลาหยุด, ส่งออกรายงาน (ดูแต่บันทึกกิจกรรมไม่ได้) |
| **นักวางแผนงาน** (Planner) | `planner@factory.th` | `planner2026` | **ดูและวางแผน:** Dashboard, เครื่องจักร, ใบงาน, รายงาน — เปิดใบงานได้เฉพาะงานบำรุงป้องกัน (PM) เท่านั้น |

## รายละเอียดการ Deploy

* **สถาปัตยกรรม:** Next.js 15.5.26 App Router (12 routes: 10 static + 2 dynamic)
* **Data Layer:** โหมดคู่ — อ่าน/เขียน Supabase เมื่อตั้งค่า env vars, ใช้ข้อมูลตัวอย่างในเบราว์เซอร์เมื่อไม่ได้ตั้ง
* **Design:** ธีม Control Tower สว่างเป็นหลัก พร้อมโหมดมืด รองรับมือถือ
* **CI/CD:** GitHub Actions ตรวจ type-check, lint, test และ build ก่อน deploy อัตโนมัติ
