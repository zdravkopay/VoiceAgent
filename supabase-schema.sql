-- Run this in your Supabase SQL Editor to create the agent_config table
-- and set up the default Row Level Security (RLS) policies.

-- 1. Create the table
CREATE TABLE agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL DEFAULT 'Alex',
  company_name text NOT NULL DEFAULT 'Acme Corp',
  voice_id text NOT NULL DEFAULT 'Aoede',
  tone text NOT NULL DEFAULT 'Casual & Warm',
  company_knowledge text,
  custom_instructions text,
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Insert a default row so the app has something to load immediately
INSERT INTO agent_config (id, agent_name, company_name, voice_id, tone, company_knowledge) 
VALUES (
  '11111111-1111-1111-1111-111111111111', 
  'Alex', 
  'Acme Corp', 
  'Aoede', 
  'Professional yet conversational', 
  'We provide AI voice agents that automate inbound and outbound phone calls for sales teams.'
);

-- 3. Enable RLS
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;

-- 4. Create policies to allow the public anon key to read and update the config
CREATE POLICY "Enable read access for all users" ON agent_config FOR SELECT USING (true);
CREATE POLICY "Enable update for all users" ON agent_config FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON agent_config FOR INSERT WITH CHECK (true);
