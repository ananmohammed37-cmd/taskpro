-- =====================================
-- TaskPro Freelance Marketplace Schema
-- =====================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- =========================
-- USERS
-- =========================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text unique not null,
  role text default 'worker' check (role in ('worker','admin')),
  avatar_url text,
  wallet_address text,
  balance numeric(12,2) default 0,
  total_earned numeric(12,2) default 0,
  completed_tasks integer default 0,
  rating numeric(3,2) default 5.0,
  created_at timestamptz default now()
);

-- =========================
-- TASKS
-- =========================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text check (category in ('design','code','write','marketing')),
  reward numeric(10,2) not null,
  level text check (level in ('easy','medium','hard')),
  duration_days integer not null,
  requirements text[],
  tags text[],
  status text default 'open'
    check (status in ('open','assigned','review','done','cancelled')),
  created_by uuid references public.users(id),
  assigned_to uuid references public.users(id),
  created_at timestamptz default now(),
  deadline timestamptz
);

-- =========================
-- APPLICATIONS
-- =========================

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  worker_id uuid references public.users(id) on delete cascade,
  cover_note text,
  status text default 'pending'
    check (status in ('pending','accepted','rejected')),
  applied_at timestamptz default now(),
  unique(task_id, worker_id)
);

-- =========================
-- SUBMISSIONS
-- =========================

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  worker_id uuid references public.users(id) on delete cascade,
  content text not null,
  files text[],
  status text default 'pending'
    check (status in ('pending','approved','rejected')),
  feedback text,
  submitted_at timestamptz default now()
);

-- =========================
-- PAYMENTS
-- =========================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.users(id),
  task_id uuid references public.tasks(id),
  amount numeric(10,2) not null,
  wallet_address text,
  network text default 'TRC20',
  tx_hash text,
  status text default 'pending'
    check (status in ('pending','processing','completed','failed')),
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- =========================
-- NOTIFICATIONS
-- =========================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info',
  is_read boolean default false,
  created_at timestamptz default now()
);

-- =========================
-- ENABLE SECURITY
-- =========================

alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.applications enable row level security;
alter table public.submissions enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

-- =========================
-- USERS POLICIES
-- =========================

create policy "Public profiles"
on public.users
for select
using (true);

create policy "Users update own profile"
on public.users
for update
using (auth.uid() = id);

create policy "Users insert own profile"
on public.users
for insert
with check (auth.uid() = id);

-- =========================
-- TASKS POLICIES
-- =========================

create policy "Anyone can read tasks"
on public.tasks
for select
using (true);

create policy "Admin create tasks"
on public.tasks
for insert
with check (
  exists(
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Admin update tasks"
on public.tasks
for update
using (
  exists(
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  )
);

-- =========================
-- APPLICATIONS POLICIES
-- =========================

create policy "Worker see own applications"
on public.applications
for select
using (worker_id = auth.uid());

create policy "Worker apply"
on public.applications
for insert
with check (worker_id = auth.uid());

create policy "Admin see all applications"
on public.applications
for select
using (
  exists(
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  )
);

-- =========================
-- SUBMISSIONS POLICIES
-- =========================

create policy "Worker see own submissions"
on public.submissions
for select
using (worker_id = auth.uid());

create policy "Worker submit"
on public.submissions
for insert
with check (worker_id = auth.uid());

create policy "Admin see submissions"
on public.submissions
for select
using (
  exists(
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  )
);

-- =========================
-- PAYMENTS POLICIES
-- =========================

create policy "Worker see payments"
on public.payments
for select
using (worker_id = auth.uid());

create policy "Admin see payments"
on public.payments
for select
using (
  exists(
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  )
);

-- =========================
-- NOTIFICATIONS POLICIES
-- =========================

create policy "User see notifications"
on public.notifications
for select
using (user_id = auth.uid());

-- =========================
-- AUTO CREATE USER PROFILE
-- =========================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, username)
  values (
    new.id,
    new.email,
    split_part(new.email,'@',1)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- =========================
-- COMPLETE PAYMENT FUNCTION
-- =========================

create or replace function public.complete_payment(payment_id uuid)
returns void
language plpgsql
as $$
declare
  p public.payments%rowtype;
begin

  select * into p from public.payments where id = payment_id;

  update public.users
  set
    balance = balance + p.amount,
    total_earned = total_earned + p.amount,
    completed_tasks = completed_tasks + 1
  where id = p.worker_id;

  update public.payments
  set
    status = 'completed',
    completed_at = now()
  where id = payment_id;

end;
$$;