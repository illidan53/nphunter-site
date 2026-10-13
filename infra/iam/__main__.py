"""No console password or administrator rights. AWS credentials are external."""
import json
import pulumi
import pulumi_aws as aws

region = aws.config.region or "us-east-1"
account = aws.get_caller_identity().account_id
user = aws.iam.User("general-user", name="nphunter-site-general-iam-user",
    force_destroy=False, tags={"Purpose": "1gp-game-publishing"},
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
# Pulumi encrypts secret outputs/state. Never export a decrypted state into Git.
key = aws.iam.AccessKey("local-api-key", user=user.name)
pulumi.export("userName", user.name)
pulumi.export("userArn", user.arn)
pulumi.export("accessKeyId", pulumi.Output.secret(key.id))
pulumi.export("secretAccessKey", pulumi.Output.secret(key.secret))
pulumi.export("region", region)
