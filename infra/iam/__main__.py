"""No console password or administrator rights. AWS credentials are external."""
import json
import pulumi
import pulumi_aws as aws
from policies import policies

region = aws.config.region or "us-east-1"
account = aws.get_caller_identity().account_id
user = aws.iam.User("general-user", name="nphunter-site-general-iam-user",
    force_destroy=False, tags={"Purpose": "personal-site-operations"},
    opts=pulumi.ResourceOptions(protect=True))
aws.iam.UserPolicy("game-publishing", user=user.name, policy=json.dumps({
    "Version": "2012-10-17", "Statement": [
        {"Sid": "RegistryLogin", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*"},
        {"Sid": "GameImages", "Effect": "Allow", "Action": [
            "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer",
            "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage",
            "ecr:DescribeImages", "ecr:DescribeRepositories"],
         "Resource": f"arn:aws:ecr:{region}:{account}:repository/1gp-games-*"},
        {"Sid": "RunShellDocument", "Effect": "Allow", "Action": "ssm:SendCommand",
         "Resource": f"arn:aws:ssm:{region}::document/AWS-RunShellScript"},
        {"Sid": "GameHostsOnly", "Effect": "Allow", "Action": "ssm:SendCommand",
         "Resource": f"arn:aws:ec2:{region}:{account}:instance/*",
         "Condition": {"StringEquals": {"ssm:resourceTag/Service": "1gp-game-host"}}},
        {"Sid": "DeploymentResult", "Effect": "Allow", "Action": "ssm:GetCommandInvocation", "Resource": "*"}
    ]}))
zone_id = pulumi.Config().require("hostedZoneId")
for name, document in policies(account, region, zone_id).items():
    document_json = json.dumps(document, separators=(",", ":"))
    if len(document_json) > 6144:
        raise ValueError(f"{name} exceeds the IAM managed-policy size limit")
    policy = aws.iam.Policy(name, description="Personal nphunter site operations; not an application runtime policy",
        policy=document_json)
    aws.iam.UserPolicyAttachment(name, user=user.name, policy_arn=policy.arn)
# Pulumi encrypts secret outputs/state. Never export a decrypted state into Git.
key = aws.iam.AccessKey("local-api-key", user=user.name)
pulumi.export("userName", user.name)
pulumi.export("userArn", user.arn)
pulumi.export("accessKeyId", pulumi.Output.secret(key.id))
pulumi.export("secretAccessKey", pulumi.Output.secret(key.secret))
pulumi.export("region", region)
