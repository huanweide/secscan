# 选题纪要 · secscan（Overlord 2026-08-14 单项目深耕）

## 决策背景
- `active-project.md` 状态：`next_action: select` / `maturity: mature`（cycscan 已上架 github.com/huanweide/cycscan）。
- core-memory 第 140/142 条裁定：「零依赖切口枯竭 → 转质量深化/家族叙事」。
- family 现状（11 个项目，代码健康六件套）：devdoctor(依赖四维) / testlite(测试) / debtlens(技术债) / a11ydoctor(a11y) / awaitscan(异步性能) / cycscan(结构复杂度)。
- 候选池落选萃取 nono/Book-to-Skill/formlite/Jay/SkillForge 均偏离零依赖基线，不采纳、保留。

## 五人格并行调研（主代理亲做 · 本环境 Agent 派发不可靠，按第9条降级）
- **PG（极简/local-first 共识）**：安全扫描工具是开发者刚需，但 Semgrep/snyk 偏重配置与账号，轻量确定性切口仍有空间。
- **Naval（杠杆缝隙）**：巨头嫌小（真安全平台做全栈）、OSS 嫌重（ESLint 插件要配置），零依赖单文件是「巨头嫌小、OSS 嫌重」缝隙。
- **张雪峰（落地可行性）**：一个上午可确定性交付；静态正则扫描无需运行时依赖，CI 门禁即插即用。
- **乔布斯（体验缺口）**：开发者要的是「开箱扫出不安全写法」而非「装一堆规则引擎」，体验入口必须零配置。
- **马斯克（终裁，给每人理由）**：
  - 采纳 **secscan**：devdoctor 仅扫明文密钥（secrets），不安全 API 使用模式（eval/exec/TLS禁用/明文http/SQL拼接/弱随机）是独立切面，六件套未覆盖；零依赖单文件 + CI 门禁差异化成立。
  - 否决 nono/Book-to-Skill/formlite/Jay：偏离零依赖基线，且 narrow 品类有上游收编风险，按第 140/142 条不采纳，保留为落选萃取。

## 三维硬标准过检（马斯克终裁门槛）
1. **受众量（大）**：任何写 JS/TS 后端/CLI/工具的项目都可能误用 eval/exec/http/TLS，全生态适用。
2. **新机会实用性（高）**：零依赖开箱扫 6 类安全反模式 + 严重度加权健康分 + `--json` + CI 门禁，确定性可复现。
3. **比竞品更好或市场无（更好）**：Semgrep 需 Python/规则 yaml、eslint-plugin-security 需 ESLint 配置、snyk code 需账号；我们纯源码层零依赖单文件确定性静态扫描，无配置无账号。

## 落点
- slug: secscan
- path: forge/projects/2026-08-14/ol-secscan/
- 家族第七轴：安全反模式静态扫描（与 devdoctor 拼成「代码健康 family」七件套）。
- 规则集：S1 eval/new Function(high) / S2 exec 危险拼接(high) / S3 TLS 禁用(high) / S4 http:// 明文(medium) / S5 SQL 拼接(medium) / S6 Math.random 安全上下文(medium) / S7 exec 常量命令(low 审查)。
