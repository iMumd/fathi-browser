'use strict';
const proxyMgr = require('./proxy');
const TOR_SOCKS = ['socks5://127.0.0.1:9050','socks5://127.0.0.1:9150'];
function isOnion(url){ try{const u=new URL(url);return u.hostname.toLowerCase().endsWith('.onion');}catch(e){return false;} }
function isEth(url){ try{const u=new URL(url);return u.hostname.toLowerCase().endsWith('.eth');}catch(e){return false;} }
function isI2P(url){ try{const u=new URL(url);const h=u.hostname.toLowerCase();return h.endsWith('.i2p');}catch(e){return false;} }
function shouldRouteThroughTor(url){ return isOnion(url)||isEth(url)||isI2P(url); }
function getTorEntry(){ for(const raw of TOR_SOCKS){ const entry=proxyMgr.parseEntry?proxyMgr.parseEntry(raw):null; if(entry)return entry; } return null; }
module.exports={isOnion,isEth,isI2P,shouldRouteThroughTor,getTorEntry,TOR_SOCKS};

