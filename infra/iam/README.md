# 本地游戏发布身份

独立 Pulumi 项目，不修改主站的 S3、CloudFront 或登录后端。
创建 `nphunter-site-general-iam-user` 和一个 API Access Key，没有控制台密码。

权限：向当前账户当前区域的 `1gp-games-*` ECR 仓库推送镜像，以及通过 SSM 管理
`Service=1gp-game-host` 的实验机器。不能创建 EC2/IAM、修改域名，也不能操作金融工作台。
SSM 的 shell 权限等同于实验机器的管理员权限；这个账号仅供团队本地使用，不能发给游戏开发者或放到浏览器。

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

在专门的发布终端加载环境变量：

```sh
source .env.aws.local
aws sts get-caller-identity
```

代码和 `Pulumi.dev.yaml` 不包含密钥。密钥输出被标记为 Pulumi secret，在状态中加密保存；
`export-env.py` 将它写到 Git 忽略的 `.env.aws.local`，文件权限为 0600，终端不会显示密钥。
不要运行并分享 `pulumi stack output --show-secrets` 或明文状态导出。
Pulumi Cloud 的登录凭据与 AWS 凭据是两套独立身份。

机器基础设施仍由管理员 SSO 在 `1gp-game-platform/infra` 部署。使用 SSO 时先退出上述发布终端，
避免环境变量中的 Access Key 覆盖 AWS_PROFILE。轮换时创建并验证新 key 后再停用旧 key；
不要直接覆盖本地凭据。用户受 Pulumi protect 保护，销毁前须显式解除保护并处理 key。
