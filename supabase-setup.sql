-- Supabase 访问申请表初始化脚本
-- 使用方法：
-- 1. 打开 Supabase 项目
-- 2. 左侧点击 SQL Editor
-- 3. 新建 Query
-- 4. 粘贴并运行本文件全部内容

create table if not exists public.access_applications (
  id text primary key,
  name text not null,
  name_key text not null unique,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at bigint not null,
  updated_at bigint not null
);

alter table public.access_applications enable row level security;

drop policy if exists "允许公开读取访问申请" on public.access_applications;
create policy "允许公开读取访问申请"
on public.access_applications
for select
to anon
using (true);

drop policy if exists "允许公开提交访问申请" on public.access_applications;
create policy "允许公开提交访问申请"
on public.access_applications
for insert
to anon
with check (true);

drop policy if exists "允许公开更新访问申请" on public.access_applications;
create policy "允许公开更新访问申请"
on public.access_applications
for update
to anon
using (true)
with check (true);
