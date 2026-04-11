-- ============================================================
-- VisualAI Editor — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ─── Storage Bucket ─────────────────────────────────────────────────────────
-- Run in Storage settings OR via SQL:
-- insert into storage.buckets (id, name, public) values ('videos', 'videos', false);

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table if not exists video_projects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  title             text not null,
  original_filename text not null,
  storage_path      text not null,
  thumbnail_path    text,
  duration_seconds  float,
  resolution        text,                        -- "1920x1080"
  fps               float,
  file_size_bytes   bigint,
  status            text not null default 'uploading'
                      check (status in ('uploading','processing','ready','error')),
  transcription     jsonb,                        -- { segments: [{start, end, text}] }
  metadata          jsonb,                        -- bitrate, codec, etc.
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists edit_operations (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references video_projects(id) on delete cascade not null,
  user_id             uuid references auth.users(id) not null,
  instruction         text not null,
  ai_interpretation   jsonb not null default '{}'::jsonb,
  ffmpeg_commands     jsonb not null default '{}'::jsonb,
  status              text not null default 'pending'
                        check (status in ('pending','processing','completed','failed','needs_clarification')),
  output_path         text,
  error_message       text,
  processing_time_ms  integer,
  created_at          timestamptz not null default now()
);

create table if not exists video_exports (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references video_projects(id) on delete cascade not null,
  operation_id     uuid references edit_operations(id) on delete set null,
  export_type      text not null
                     check (export_type in ('clip','trim','reel','summary','subtitled','audio','resized')),
  storage_path     text not null,
  duration_seconds float,
  file_size_bytes  bigint,
  download_url     text,
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists edit_presets (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete cascade not null,
  name                 text not null,
  description          text,
  template_instruction text not null,
  ai_config            jsonb,
  is_public            boolean not null default false,
  usage_count          integer not null default 0,
  created_at           timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_video_projects_user_id on video_projects(user_id);
create index if not exists idx_edit_operations_project_id on edit_operations(project_id);
create index if not exists idx_edit_operations_user_id on edit_operations(user_id);
create index if not exists idx_video_exports_project_id on video_exports(project_id);
create index if not exists idx_edit_presets_user_id on edit_presets(user_id);

-- ─── Updated At Trigger ───────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger video_projects_updated_at
  before update on video_projects
  for each row execute function update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table video_projects  enable row level security;
alter table edit_operations enable row level security;
alter table video_exports   enable row level security;
alter table edit_presets    enable row level security;

-- video_projects: users can only see/modify their own
create policy "Users can view their own projects"
  on video_projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on video_projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on video_projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on video_projects for delete
  using (auth.uid() = user_id);

-- edit_operations: users can only see/modify their own
create policy "Users can view their own operations"
  on edit_operations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own operations"
  on edit_operations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own operations"
  on edit_operations for update
  using (auth.uid() = user_id);

-- video_exports: tied to projects user owns
create policy "Users can view exports of their projects"
  on video_exports for select
  using (
    exists (
      select 1 from video_projects
      where video_projects.id = video_exports.project_id
        and video_projects.user_id = auth.uid()
    )
  );

create policy "Users can insert exports for their projects"
  on video_exports for insert
  with check (
    exists (
      select 1 from video_projects
      where video_projects.id = video_exports.project_id
        and video_projects.user_id = auth.uid()
    )
  );

-- edit_presets: own + public ones are visible
create policy "Users can view own and public presets"
  on edit_presets for select
  using (auth.uid() = user_id or is_public = true);

create policy "Users can insert their own presets"
  on edit_presets for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own presets"
  on edit_presets for update
  using (auth.uid() = user_id);

create policy "Users can delete their own presets"
  on edit_presets for delete
  using (auth.uid() = user_id);

-- ─── Storage Policies ─────────────────────────────────────────────────────────
-- After creating the 'videos' bucket in Supabase Storage dashboard, add:

-- Allow authenticated users to upload to their own folder:
-- create policy "Authenticated users can upload videos"
--   on storage.objects for insert
--   with check (bucket_id = 'videos' and auth.role() = 'authenticated');

-- Allow users to read their own files (or use service role):
-- create policy "Users can read their own videos"
--   on storage.objects for select
--   using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─── Carousels ───────────────────────────────────────────────────────────────

create table if not exists carousels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  topic       text not null default '',
  slides      jsonb not null default '[]',
  theme_key   text not null default 'dark',
  slide_count int not null default 0,
  created_at  timestamptz default now()
);

alter table carousels enable row level security;

create policy "Users can manage their own carousels"
  on carousels for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists carousels_user_id_idx on carousels(user_id);
