# 个人站点运维身份

独立 Pulumi 项目，不修改主站的 S3、CloudFront 或登录后端。
创建 `nphunter-site-general-iam-user` 和一个 API Access Key，没有控制台密码。

用于本人管理 nphunter 主站、全球网络、Kube、金融工作台和 1GP 游戏相关服务，不作为 1GP 后台运行身份。

权限分为两份托管策略（`policies.py`）：

- S3、ECR、Lambda、DynamoDB：按 nphunter / nsite / kgame / msite / ggame / cgame / tgame / onegp / 1gp 名称前缀限制；也包含旧游戏的同名 ECR 仓库。
- EC2、网络、ACM、SSM 主机命令、SES、CloudWatch：当前账户 us-east-1 区域级管理权限；这些权限不只限于带游戏标签的主机，包含金融工作台。
- CloudFront：账户内管理权限；Route 53：仅当前 nphunter.net 托管区和必要查询。
- API Gateway：当前区域 API 与域名管理；CloudFormation：站点名称前缀的 stack。
- IAM：读取并传递站点运行角色；不允许创建用户、修改角色策略或账户级管理员权限。

首次建立新项目的 IAM 角色、身份提供方、服务角色以及域名注册/账单等账户级操作仍使用管理员 SSO。
此用户是广权限的个人运维账号，不能发给开发者、放进浏览器，或作为公开平台后台的共享身份。

首次创建用户必须使用已有管理员身份；新用户不能创建自己：

```sh
cd infra/iam
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
AWS_PROFILE=nphunter-sso pulumi stack select dev --create
AWS_PROFILE=nphunter-sso pulumi preview
AWS_PROFILE=nphunter-sso pulumi up
python3 export-env.py
```

如果确实需要用静态 key，在专门的运维终端加载环境变量：

```sh
source .env.aws.local
aws sts get-caller-identity
```

代码和 `Pulumi.dev.yaml` 不包含密钥。密钥输出被标记为 Pulumi secret，在状态中加密保存；
`export-env.py` 将它写到 Git 忽略的 `.env.aws.local`，文件权限为 0600，终端不会显示密钥。
不要运行并分享 `pulumi stack output --show-secrets` 或明文状态导出。
Pulumi Cloud 的登录凭据与 AWS 凭据是两套独立身份。

平时优先用 `aws sso login --profile nphunter-sso` 和 `AWS_PROFILE=nphunter-sso`；无需加载 Access Key。
新机器首次创建 IAM 角色仍使用管理员 SSO。使用 SSO 时先退出上述静态 key 终端，
避免环境变量中的 Access Key 覆盖 AWS_PROFILE。轮换时创建并验证新 key 后再停用旧 key；
不要直接覆盖本地凭据。用户受 Pulumi protect 保护，销毁前须显式解除保护并处理 key。

## 平台后台的身份

1GP 当前部署在 Vercel，优先使用 Vercel OIDC → AWS STS → 独立 IAM role。
角色的 trust policy 应精确限制 team、project 和 production 环境；只给游戏 ECR/主机所需权限。
Vercel 环境变量保留 `AWS_ROLE_ARN` 和显式的目标区域，SDK 自动换取并刷新临时凭据；无需长期 Access Key。
这项 OIDC 接入尚未创建或部署，本目录的广权限用户也没有自动放入 Vercel。

若暂时使用静态 key，应另建平台专用的受限身份，只存服务端环境变量；不要使用本目录的个人运维 key。
在 EC2/Lambda 上运行时使用实例角色/执行角色；GitHub Actions 使用已有 OIDC 机制。
参考：https://vercel.com/docs/oidc/aws 和 https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
