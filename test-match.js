const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')).split('=')[1].trim();
const key = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY=')).split('=')[1].trim();

async function run() {
  const res = await fetch(`${url}/rest/v1/matches?select=*&order=created_at.desc&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
