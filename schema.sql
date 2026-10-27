-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create calls table
create table public.calls (
    id uuid primary key default uuid_generate_v4(),
    prospect_name text not null,
    company text not null,
    outcome text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create call_stages table
create table public.call_stages (
    id uuid primary key default uuid_generate_v4(),
    call_id uuid references public.calls(id) on delete cascade not null,
    stage_number int not null,
    button_tapped text,
    prospect_words text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index on call_id for fast retrieval
create index idx_call_stages_call_id on public.call_stages(call_id);
