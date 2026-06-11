/*
 * Supabase 云端配置
 * 这里只放 anon public key，允许放在前端页面中。
 * 不要把 service_role key 或数据库密码放到这里。
 */
(function () {
  window.SUPABASE_CONFIG = {
    url: 'https://poyxqpjpmvijricjxmeu.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveXhxcGpwbXZpanJpY2p4bWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDMyNjUsImV4cCI6MjA5NjcxOTI2NX0.EUu4WemLymOWV-mllrZDxfrSpRDXwp6htEd8c6NvnnI',
    table: 'access_applications'
  };
})();
