
/* --------------------------------------------------------------- helpers */

function fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

function fmtMs(n) {
  n = Number(n) || 0;
  if (n <= 0) return 'n/a';
  if (n < 1000) return Math.round(n) + ' ms';
  return (n / 1000).toFixed(2) + ' s';
}

function statusCls(s) {
  s = Number(s) || 0;
  if (!s) return '';
  if (s >= 500) return 'err';
  if (s >= 400) return 'warn';
  if (s >= 300) return 'info';
  if (s >= 200) return 'ok';
  return '';
}

