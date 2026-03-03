const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function keepActive() {
  const { data, error } = await supabase
    .from('heartbeat')
    .upsert({ id: 1, last_ping: new Date().toISOString() });

  if (error) {
    console.error('保活失败:', error.message);
  } else {
    console.log('心跳同步成功，项目已激活:', new Date().toLocaleString());
  }
}

keepActive();
