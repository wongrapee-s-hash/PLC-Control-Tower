# 3. โครงสร้างฐานข้อมูล PostgreSQL / Supabase

ไฟล์ในโฟลเดอร์นี้คือสำเนาของ `supabase/schema.sql` และ `supabase/seed.sql` ในโปรเจกต์
ใช้รันตามลำดับนี้ใน Supabase Dashboard → SQL Editor

| ไฟล์ | สิ่งที่ทำ |
| --- | --- |
| `03_Supabase_Database_Schema.sql` | ตาราง, enum, trigger, view, RLS policy, grant |
| `03_Supabase_Seed_Data.sql` | ข้อมูลตัวอย่างชุดเดียวกับที่แอปใช้ตอนออฟไลน์ |

> `schema.sql` เป็น **additive เท่านั้น** — ไม่มี `drop schema` และไม่ลบตารางเดิม จึงรันซ้ำบนโปรเจกต์ที่มีข้อมูลอยู่แล้วได้อย่างปลอดภัย
> ถ้าต้องการเริ่มต้นใหม่ทั้งหมด ให้ใช้ `supabase/reset.sql` (ลบข้อมูลทั้งหมด) แล้วรัน schema และ seed ใหม่

---

## โครงสร้างข้อมูล

```
sites ──< production_lines ──< assets ──┬──< work_orders ──< work_order_parts
                                         │         │                    │
                                         │         └──< downtime_events │
                                         └──< production_runs >── spare_parts
                                                                          ▲
                                                            work_order_parts ┘

app_users          : โปรไฟล์ผู้ใช้ที่ผูกกับ auth.users
demo_principals    : บัญชีสาธิตสำหรับโหมดออฟไลน์ (มี plaintext password — ลบทิ้งเมื่อใช้จริง)
activity_trail     : บันทึกกิจกรรม append-only เขียนโดย trigger เท่านั้น
```

### ตารางหลัก 11 ตาราง

| ตาราง | หน้าที่ | ข้อมูลสำคัญ |
| --- | --- | --- |
| `app_users` | โปรไฟล์ผู้ใช้ | `user_id` (อ้าง `auth.users`), `role`, `site_code` |
| `sites` | ข้อมูลพื้นที่ | `code`, `timezone` |
| `production_lines` | สายการผลิต | `takt_seconds`, `shifts_per_day` — ใช้คำนวณ OEE |
| `assets` | เครื่องจักร | `asset_tag` (unique), `state`, `criticality`, `target_oee`, `next_pm_due` |
| `spare_parts` | คลังอะไหล่ | `sku` (unique), `on_hand`, `reserved`, `reorder_point`, `unit_cost` |
| `work_orders` | ใบงานซ่อมบำรุง | `wo_number` (unique), `kind`, `state`, `priority`, `labour_minutes` |
| `work_order_parts` | อะไหล่ที่ผูกกับใบงาน | `qty_required`, `qty_reserved`, `qty_issued` |
| `production_runs` | ผลผลิตรายกะ (จาก MES) | `planned_minutes`, `running_minutes`, `good_units`, `scrap_units` |
| `downtime_events` | เหตุหยุดเครื่อง | `cause`, `started_at`, `ended_at`, `minutes` |
| `activity_trail` | บันทึกกิจกรรม | `actor_email`, `action`, `table_name`, `row_key`, `diff` |
| `demo_principals` | บัญชีสาธิต | ใช้เฉพาะโหมดออฟไลน์ |

### View 3 ตัว

| View | ใช้ทำอะไร |
| --- | --- |
| `asset_oee` | คำนวณ Availability / Performance / Quality และ OEE รวมรายเครื่องจักร |
| `workload_summary` | สรุปจำนวนงานค้างแยกตามสถานะและความเร่งด่วน |
| `reorder_queue` | รายการอะไหล่ที่ต้องสั่งซื้อ พร้อมปริมาณที่ขาด |

ทั้งสาม view ใช้ `security_invoker = true` เพื่อให้ RLS ของตารางหลักยังมีผล — ถ้าไม่ใส่ จะกลายเป็นการอ่านข้อมูลข้ามสิทธิ์โดยอัตโนมัติ

---

## กฎความปลอดภัยที่บังคับในระดับฐานข้อมูล

สิทธิ์ทั้งหมดถูกบังคับด้วย Row Level Security 25 policy
การตรวจสิทธิ์ฝั่ง client เป็นแค่เรื่อง UX เท่านั้น — แม้เรียก API ตรง ๆ ก็ถูกบล็อกที่นี่

| การกระทำ | Admin | Engineer | Planner | บันทึกกิจกรรม |
| --- | :---: | :---: | :---: | :---: |
| อ่านข้อมูลทั้งหมด | ✓ | ✓ | ✓ | — |
| แก้เครื่องจักร / อะไหล่ | ✓ | ✓ | — | ✓ |
| เดินสถานะใบงาน | ✓ | ✓ | — | ✓ |
| เปิดใบงาน | ✓ | ✓ | เฉพาะ PM | ✓ |
| ลบใบงาน | ✓ | — | — | ✓ |
| บันทึกเวลาหยุดเครื่อง | ✓ | ✓ | — | ✓ |
| แก้ข้อมูลอ้างอิง (site/line) | ✓ | — | — | ✓ |
| อ่านบันทึกกิจกรรม | ✓ | — | — | — |
| แก้/ลบบันทึกกิจกรรม | — | — | — | — |

จุดที่ตั้งใจออกแบบมาเป็นพิเศษ:

* **`activity_trail` เขียนได้จาก trigger เท่านั้น** — policy ปิด insert/update/delete ทั้งหมด แม้ admin ก็แก้ย้อนหลังไม่ได้
* **ผู้ใช้แก้โปรไฟล์ตัวเองได้ แต่เปลี่ยนบทบาทไม่ได้** — ใช้ `authz.owns_role()` ตรวจ role เดิมก่อนบันทึก
  (ถ้า query `app_users` ใน policy ตรง ๆ RLS จะเรียกตัวเองวนจนเกิด infinite recursion จึงต้องผ่าน `security definer` function)
* **ลบข้อมูลอ้างอิงถูกปิด** — `sites` และ `production_lines` ใช้ `ON DELETE RESTRICT` เพื่อไม่ให้ลบสายที่ยังมีเครื่องจักรผูกอยู่
* **ลบเครื่องจักรที่มีประวัติไม่ได้** — `assets` ใช้ `ON DELETE RESTRICT` และ store ปฏิเสธการลบใน UI
* **`anon` อ่านได้แต่เขียนไม่ได้** — grant เขียนเฉพาะ `authenticated`
* **ไม่ใช้ `grant on all tables`** — เพราะจะเปิดให้ `anon` อ่าน `demo_principals` (ที่มีรหัสผ่าน) และ `app_users` โดยไม่ตั้งใจ

---

## Trigger และ Function

| ชื่อ | ทำอะไร |
| --- | --- |
| `public.touch_updated_at()` | อัปเดต `updated_at` อัตโนมัติ — client ไม่ต้องส่งคอลัมน์นี้ |
| `public.sync_downtime_minutes()` | คำนวณ `minutes` จาก `ended_at - started_at` ให้ตรงกันเสมอ |
| `public.record_activity()` | บันทึกลง `activity_trail` ทุกครั้งที่มี insert/update/delete |
| `public.work_order_transition_allowed()` | ตารางการเคลื่อนสถานะที่อนุญาต (ตรงกับ `src/lib/workflow.ts`) |
| `public.guard_work_order_state()` | บล็อกการข้ามสถานะ แม้จะส่งคำขอมาจาก client ที่ค้างอยู่ |
| `authz.current_role()` | อ่าน role ของผู้เรียก ครั้งเดียว เป็น `security definer` |
| `authz.is_admin()` / `authz.can_write()` | ตัวช่วยตรวจสิทธิ์ที่ policy เรียกใช้ |
| `authz.owns_role()` | ป้องกันผู้ใช้เปลี่ยน role ของตัวเอง โดยไม่เข้าสู่ recursion |

---

## หลังรัน Schema เสร็จ

ต้องสร้างผู้ใช้จริงก่อนจึงจะเข้าสู่ระบบผ่าน Supabase ได้

1. Authentication → Users → Add user (สร้างอีเมลและรหัสผ่าน)
2. เพิ่มแถวใน `app_users` ให้ตรงกับ `user_id` ที่ได้

```sql
insert into public.app_users (user_id, email, display_name, role, site_code)
values (
  '<user_id จาก Authentication>',
  'your@email.com',
  'ชื่อที่แสดง',
  'engineer',              -- admin | engineer | planner
  'SMT-01'
);
```

ถ้าไม่มีแถวนี้ ระบบจะปฏิเสธการเข้า เพราะ RLS อ่านสิทธิ์ทั้งหมดจากตารางนี้
และ `authz.current_role()` จะคืนค่า `planner` (สิทธิ์ต่ำสุด) เมื่อหาโปรไฟล์ไม่เจอ — ระบบจึง fail closed

## ข้อควรระวังก่อนขึ้นใช้งานจริง

* ลบตาราง `demo_principals` ทิ้ง เพราะเก็บรหัสผ่านแบบข้อความธรรมดา
* ตั้งรหัสผ่านจริงที่แข็งแรง และเปิดการยืนยันอีเมล
* ตรวจสอบว่า Supabase ไม่ได้เปิด Data API ให้ `anon` เขียนได้โดยไม่มี policy คุม
