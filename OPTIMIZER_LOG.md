# OPTIMIZER_LOG

## Round 1 — 2026-10-15

**方向**：单点深度特化 —— 消灭安全扫描器的两类失败：**谎报干净**（漏）与**把危险判成安全**（误）。

### 存活评估

**保留**。secscan 在同族里技术含量最高：逐字符 tokenizer 把注释/字符串/正则字面量剥成空格，规则正则一律用 `new RegExp(字符串)` 构造，使工具能扫自己而归零。这个方法论值得传播。

### 方向选择理由

安全扫描器的价值不在「报得多」，而在**「没报问题时用户敢信」**。所以本轮不扩充规则数量（S1~S7 已覆盖常见反模式），只攻两类失败。

关键判断：**把误报提到与漏报同等地位**。传统思路只防漏报，但误报会让用户直接关掉门禁——而门禁一旦关掉，漏报就 100% 发生。

### P0-1：S2/S7 严重度判定完全判反

旧实现只看「首字符是不是引号」，而它的输入 `codeText` 已经把字符串抹成空格：

| 写法 | 旧判定 | 正误 | 新判定 |
| --- | --- | --- | --- |
| `exec('ls ' + x)` | S7 low | ❌ 真危险被降级 | **S2 high** |
| `execSync(` + 反引号 + `rm -rf ${p}` + 反引号 + `)` | **无** | ❌ 最危险形态漏检 | **S2 high** |
| `exec(userCmd)` | S2 high | ✅ | S2 high |
| `execFile(cmd, [a, b])` | S2 high | ❌ 误报，安全写法被判危险 | S7 low |
| `exec('ls')` | S7 low | ✅ | S7 low |

**根因**：判定输入是「已抹掉字符串的文本」，引号信息在 tokenizer 阶段就丢了。改为新增 `readFirstArg()`，在**原始 src** 上解析首参形态。

顺带修掉一个索引错位隐患：`{execSync}` 解构写法会被 tokenizer 误判为正则字面量多吞 4 字符，导致 `codeText` 与 `src` 的索引不对齐。改为直接在原始 src 上匹配调用。

### P0-2：`--ext` 污染模块级状态导致静默漏扫

```js
SUPPORTED_EXT.clear();   // ← 模块级共享 Set
```

编排入口 `enghealth` 同进程调用时，先跑一次带 `--ext` 的调用后，**后续所有 secscan 调用只扫那一种扩展名**，其余静默漏掉，终端照样打印「未发现安全反模式」。实测：`files=0`。

改为局部 `extSet`，`DEFAULT_EXTENSIONS` 用 `Object.freeze` 冻结。`--ext ',,'` 这类空值原会扫 0 个文件后谎报干净，现在退出码 2。

### P1：README 的 `npx secscan` 是危险死命令

```
$ npm view secscan repository
repository: git+https://github.com/mozilla/scanjs.git    # Mozilla scanjs，别人
```

npm 上确实有 `secscan` 包（v0.0.2），但那是 Mozilla 的 scanjs。README 让用户 `npx secscan` 会**执行陌生第三方代码**——比「安装失败」危险得多。已改 `node index.js` 并加警示。

### dogfood 豁免必须精确到路径

新写的测试与冒烟脚本里故意写着 `cp.exec(userCmd)` 这类反面样本，它们是测试语料不是漏洞。豁免规则**精确到相对路径且限定文件名**（只豁免根目录 `test.js` 与 `scripts/smoke-cli.js`），不豁免任何子目录里的同名文件——否则真正的漏洞会藏进测试目录。

### 核验

```
node --test test.js        -> 15/15 pass（含 dogfood 归零）
node scripts/smoke-cli.js  -> 19 断言全绿, rc=0
node index.js --json .     -> score 100 / high 0
```

### 变异测试（2/2 拦下）

| 变异 | 结果 |
| --- | --- |
| 恢复旧的「首字符判定」 | 严重度回归测试变红 |
| dogfood 豁免放宽成目录级 | dogfood 归零测试变红 |

### 自身错误与倾向记录

1. 调试模板串漏检时连续两次用 shell 单引号 + 反斜杠拼 JS 字符串，得到的测试样本本身就是错的（多出字符，index 43 vs 实际 39），差点把代码 bug 误判成我的实现 bug。**教训：构造含模板串/引号的测试样本必须写临时文件，不能在 shell 里拼。**
2. 一度把「点号前是 `.` 就跳过」写成无差别规则，误杀了 `cp.exec()` 这种真实调用。是**原有测试**（S2 exec 拼接）报红才暴露——这说明老测试确实在起作用，新写的规则必须过老测试这一关。
3. `git init` 之后执行 `reset --mixed` 一度让 `.git` 目录丢失，需重建仓库再对齐远端历史。
