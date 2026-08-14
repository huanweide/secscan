'use strict';

// secscan 单测 —— 同时承担 dogfood 归零强制校验：
// test.js 源文件自身不得包含会触发规则的裸字面量（http:// / 引号内 SELECT 拼接等），
// 否则扫描自身目录会失败。S4/S5 用临时文件 + 字符串拼接构造样本，避免自污染。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanText, scanDir, computeScore, parseArgs } = require('./index');

const ids = (issues) => issues.map((i) => i.id);

test('S1 检测 eval / new Function', () => {
  const r = scanText('const x = eval(userInput);');
  assert.ok(ids(r).includes('S1'), '应检出 eval');
  const r2 = scanText('const f = new Function("return 1");');
  assert.ok(ids(r2).includes('S1'), '应检出 new Function');
});

test('字符串内的 eval 不误报', () => {
  const r = scanText('const note = "use eval() carefully";');
  assert.ok(!ids(r).includes('S1'));
});

test('S2 exec 拼接(high) 与 S7 exec 常量(low)', () => {
  const inj = scanText('const cp = require("child_process"); cp.exec(userCmd);');
  assert.ok(ids(inj).includes('S2'), '命令拼接应报 S2');
  const con = scanText('const cp = require("child_process"); cp.exec("ls -la");');
  assert.ok(ids(con).includes('S7'), '常量命令应报 S7');
  assert.ok(!ids(con).includes('S2'), '常量命令不应报 S2');
});

test('S3 TLS 验证禁用（rejectUnauthorized / 环境变量）', () => {
  const r = scanText('const agent = new https.Agent({ rejectUnauthorized: false });');
  assert.ok(ids(r).includes('S3'));
  const r2 = scanText('process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";');
  assert.ok(ids(r2).includes('S3'));
});

test('S4 明文 http 传输（临时文件，避免自污染）', () => {
  const httpContent = 'const u = "http:' + '//' + 'example.com";';
  const tmp = path.join(os.tmpdir(), 'secscan-http-' + Date.now() + '.js');
  fs.writeFileSync(tmp, httpContent);
  const r = scanText(httpContent);
  assert.ok(ids(r).includes('S4'), '应检出明文 http');
  const safe = scanText('const u = "https://example.com";');
  assert.ok(!ids(safe).includes('S4'), 'https 不应报');
  fs.unlinkSync(tmp);
});

test('S5 SQL 拼接（临时文件，避免自污染）', () => {
  const sel = 'SELECT';
  const sqlContent = 'const q = "' + sel + ' * FROM users WHERE id = " + userId;';
  const tmp = path.join(os.tmpdir(), 'secscan-sql-' + Date.now() + '.js');
  fs.writeFileSync(tmp, sqlContent);
  const r = scanText(sqlContent);
  assert.ok(ids(r).includes('S5'), '应检出 SQL 拼接');
  const constSql = scanText('const q = "SELECT * FROM users";');
  assert.ok(!ids(constSql).includes('S5'), '常量 SQL 不应报');
  fs.unlinkSync(tmp);
});

test('S6 Math.random 安全上下文', () => {
  const r = scanText('const token = Math.random().toString(36);');
  assert.ok(ids(r).includes('S6'), '安全上下文应报 S6');
  const r2 = scanText('const x = Math.random();');
  assert.ok(!ids(r2).includes('S6'), '非安全上下文不应报');
});

test('computeScore 健康分', () => {
  assert.strictEqual(computeScore([], 1000), 100);
  assert.ok(computeScore([{ severity: 'high' }], 10) < 100);
});

test('去重：不同行同规则分别计数', () => {
  const r = scanText('eval(a);\neval(b);');
  assert.strictEqual(r.filter((i) => i.id === 'S1').length, 2);
});

test('parseArgs 三类分离：--root 不被 parseInt 成 NaN', () => {
  const opts = parseArgs(['--root', 'C:\\projects\\foo', '--max-high', '0']);
  assert.strictEqual(opts.root, 'C:\\projects\\foo');
  assert.strictEqual(opts.maxHigh, 0);
});

test('dogfood：扫描自身目录应 0 问题（归零纪律）', () => {
  const { issues } = scanDir(__dirname);
  if (issues.length > 0) {
    console.log('dogfood 未归零:', JSON.stringify(issues, null, 2));
  }
  assert.strictEqual(issues.length, 0, 'secscan 自身仓库必须扫描归零');
});
