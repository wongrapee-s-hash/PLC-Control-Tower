# 2. ลิงก์ Vercel Deployment

* **Vercel Project:** https://vercel.com/wongrapee034/plccontroltower
* **Live Deployment URL:** _(ยังไม่มี — โปรเจกต์บน Vercel ถูกสร้างแล้ว แต่ยังไม่เคย deploy สำเร็จ)_
* **Framework:** Next.js 15.5.26 (App Router)
* **สถานะ:** ผ่าน `npm run build` ในเครื่อง และผ่านบน GitHub Actions แต่ยังไม่ได้ deploy จริง

## ตรวจแล้วว่าเป็นอะไร

เช็กโดเมนที่เป็นไปได้ทั้งหมด ตอบกลับมาเป็น 404 ทั้งสิ้น แปลว่า **ยังไม่เคยมี deployment ที่สำเร็จ**

| โดเมน | ผลลัพธ์ |
| --- | --- |
| `plccontroltower.vercel.app` | 404 |
| `plccontroltower-wongrapee034.vercel.app` | 404 |
| `plc-control-tower-wongrapee034.vercel.app` | 404 |

ตัวโปรเจกต์เองไม่ได้มีปัญหา — `next.config.ts` ไม่มี setting แปลก, ไม่มี `postinstall`/`prepare` script,
`engines` กำหนด `node >=20.11.0` และ `npm run build` ผ่านทั้งในเครื่องและบน CI
ดังนั้นสาเหตุที่เป็นไปได้มากที่สุดคือ **ยังไม่ได้เชื่อม GitHub repo เข้ากับโปรเจกต์ Vercel**

## วิธี Deploy

1. เข้า https://vercel.com/wongrapee034/plccontroltower แล้วไปที่แท็บ **Settings → Git**
2. เชื่อม repository `wongrapee-s-hash/PLC-Control-Tower`
   (ถ้ามีปุ่ม *Connect Git Repository* แปลว่ายังไม่ได้เชื่อม)
3. กลับไปแท็บ **Deployments** แล้วกด **Redeploy** หรือ push commit ใหม่เพื่อให้ Vercel เริ่ม build
4. รอ build ผ่าน โดเมนที่ได้จะเป็น `plccontroltower.vercel.app`

Framework Preset ต้องเป็น **Next.js** (ตรวจพบอัตโนมัติ) และ Build Command เป็น `next build` (ค่าเริ่มต้น)

**ไม่ต้องตั้ง Environment Variables** เพื่อให้ระบบทำงานได้ทันที
ถ้าไม่ตั้งค่า ระบบจะรันในโหมดออฟไลน์ด้วยชุดข้อมูลตัวอย่างที่ตรึงวันที่ `2026-09-30`

### ถ้า build ล้มเหลว

เปิด **Deployments** → คลิกที่ build ที่ล้ม → ดูแท็บ **Logs**
สาเหตุที่พบบ่อยที่สุดคือ GitHub App ของ Vercel ยังไม่ได้รับสิทธิ์เข้าถึง repo
แก้ที่ https://vercel.com/account/integrations โดยติ๊กชื่อ repo ให้เป็น *All repositories*

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
