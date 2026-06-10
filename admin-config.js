/**
 * 管理员后台外部配置
 * --------------------------------------------------
 * 出于安全考虑，admin.html 内不再保存任何明文密码。
 * 这里仅保存密码的 SHA-256 哈希值，登录时会对输入做同样
 * 的哈希再与下面的常量做比对。
 *
 * 默认密码：admin123
 * 对应 SHA-256：240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
 *
 * 修改密码的方法：
 *   1) 在控制台执行（任意现代浏览器均支持 crypto.subtle）：
 *        async function sha256(text){
 *          const buf  = new TextEncoder().encode(text);
 *          const hash = await crypto.subtle.digest('SHA-256', buf);
 *          return Array.from(new Uint8Array(hash))
 *                   .map(b => b.toString(16).padStart(2,'0')).join('');
 *        }
 *        sha256('你的新密码').then(console.log);
 *   2) 把控制台打印出的字符串覆盖下面的 ADMIN_PASSWORD_SHA256 即可。
 */
(function () {
  window.ADMIN_PASSWORD_SHA256 =
    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
})();
