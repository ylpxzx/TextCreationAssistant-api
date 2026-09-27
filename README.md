# text-creation-api

`text-creation-api` 是“墨引 · 小说创作助手”的核心业务 API。墨引面向个人小说作者，主要解决通用 AI 对话工具不了解作品设定、长篇上下文容易丢失、生成内容可能覆盖原稿，以及人物和情节前后不一致等问题。

当前产品属于带有上下文编排能力的 AI 创作应用，并非可自主执行任意任务的通用 AI Agent。Core API 是整个系统的数据、权限和业务规则中心；Web 不直接访问数据库，AI Service 也不能直接修改业务数据。

## 功能

### 用户与作品

- 用户注册、登录、退出和当前用户查询
- HttpOnly Cookie + 数据库 Session
- 作品创建、编辑、归档、恢复和软删除
- 用户、作品、章节及资料的所有权隔离

### 章节与正文安全

- 章节创建、编辑、状态、排序和软删除
- TipTap JSON、纯文本和字数同步保存
- 基于版本号的乐观并发控制
- 修改前自动保留章节历史版本
- 历史版本分页、预览和安全恢复

### 创作资料与创作智能

- 自定义资料分类和文字资料条目
- 分类级、条目级 AI 参考开关
- 作者文风画像、偏好表达和禁用表达
- 角色声纹、章节场景卡和情节下一拍
- 修稿标记、剧情分支、状态建议和一致性问题
- 全书正文与资料搜索
- 模板化表达和机械节奏扫描

### 模型与 AI 调用

- OpenAI 和 OpenAI-compatible 模型配置
- 模型连接测试、默认模型切换
- API Key AES-256-GCM 加密保存
- 校验用户、作品、章节版本和模型配置
- 组装作品构想、前文、资料、文风、声纹和场景约束
- 调用 AI Service 并向 Web 转发 SSE
- 生成取消、幂等、状态、引用和 Token 用量记录

### 其他能力

- 外部书稿上传、解析和结构化分析
- Swagger/OpenAPI 文档
- 统一错误结构、健康检查、来源校验、CORS 和基础限流

## 架构

API 采用 NestJS 模块化单体，运行在 Fastify Adapter 上：

```text
Web Browser
    │ JSON / SSE / HttpOnly Session
    ▼
Core API（NestJS + Fastify）
    ├── Auth                   身份与 Session
    ├── Projects               作品与访问控制
    ├── Chapters               正文、乐观锁与历史版本
    ├── Resources              创作资料
    ├── Creative Intelligence  文风、声纹、场景、扫描与搜索
    ├── Models                 模型配置与凭证加密
    ├── AI Orchestrator        上下文选择与 SSE 转发
    ├── Generations            生成记录、引用和用量
    └── Book Analysis          外部书稿解析与分析
         │ 内部 Bearer Token
         ▼
      AI Service

Core API ── Drizzle ORM ── PostgreSQL
```

核心原则：

- **正文安全优先**：版本冲突时拒绝静默覆盖，并保留历史版本。
- **业务与模型解耦**：API 管理数据和上下文，AI Service 管理 Prompt 与模型协议。
- **上下文可追溯**：生成记录保存实际引用的资料摘要和 Token 用量。
- **模型凭证不下发**：API Key 不返回浏览器，只在服务端调用链中使用。
- **渐进式扩展**：当前保持模块化单体，耗时任务可在后续迁移至 Worker。

## 目录

```text
src/
├── auth/                    # 登录、Session 和密码
├── projects/                # 作品与访问控制
├── chapters/                # 章节与历史版本
├── resources/               # 创作资料
├── creative-intelligence/   # 创作智能
├── models/                  # 模型配置与凭证
├── ai/                      # AI 编排和 SSE 转发
├── generations/             # 生成记录和用量
├── book-analysis/           # 书稿解析与分析
├── database/                # Schema、迁移和种子数据
└── common/                  # 校验和公共基础能力
drizzle/                     # PostgreSQL 迁移
```

## AI 生成流程

1. Web 提交作品、章节版本、操作类型、指令和光标上下文。
2. API 校验 Session、数据归属、章节版本、限流和模型配置。
3. API 按优先级选择作品构想、前文、资料和创作智能约束。
4. API 创建生成记录，并通过内部鉴权调用 AI Service。
5. AI Service 的流式事件经 API 转发给 Web。
6. 完成、取消或失败后，API 更新状态、引用和 Token 用量。

## 技术栈

- Node.js 20+、TypeScript
- NestJS 11、Fastify
- PostgreSQL、Drizzle ORM
- Zod、OpenAPI/Swagger
- Vitest

## 本地启动

```powershell
cd D:\code\TextCreationAssistant\api
Copy-Item .env.example .env
pnpm install
pnpm key:generate
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- API：`http://localhost:3000`
- Swagger：`http://localhost:3000/docs`
- 健康检查：`http://localhost:3000/health`

请将 `pnpm key:generate` 的结果写入 `CREDENTIAL_ENCRYPTION_KEY`。`AI_SERVICE_TOKEN` 必须与 AI Service 的 `INTERNAL_API_TOKEN` 一致。

## 验证

```powershell
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:performance
pnpm build
```

## 安全边界

- 数据库只保存 Session Token 的 SHA-256 摘要。
- 密码使用 Node.js `scrypt` 加盐派生。
- 模型凭证使用 AES-256-GCM 加密，接口仅返回末四位提示。
- 写请求校验来源；认证和 AI 接口执行基础限流。
- 日志不得记录密码、API Key、完整正文或完整 Prompt。

