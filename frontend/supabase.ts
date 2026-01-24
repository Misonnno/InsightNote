import { createClient } from '@supabase/supabase-js';

// 👇 填你的 Project URL
const supabaseUrl = 'https://ndwuwthxyrfypogywfuv.supabase.co';

// 👇 填你的 anon public Key
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kd3V3dGh4eXJmeXBvZ3l3ZnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4OTQxMDEsImV4cCI6MjA4NDQ3MDEwMX0.2qIb4VEa9xu98XrXJ5BKUIVSPWV4jSaiDOB-AVVfQBY';

export const supabase = createClient(supabaseUrl, supabaseKey);