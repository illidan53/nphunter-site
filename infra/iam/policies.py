"""Personal site operations permissions, separate from any application runtime role."""

PREFIXES = ["nphunter-", "nsite-", "kgame-", "msite-", "ggame-", "cgame-", "tgame-", "onegp-", "1gp-"]


def policies(account, region, zone_id):
    def allow(sid, actions, resources, condition=None):
        statement = {"Sid": sid, "Effect": "Allow", "Action": actions, "Resource": resources}
        if condition:
            statement["Condition"] = condition
        return statement

    def named(service, resource):
        return [f"arn:aws:{service}:{region}:{account}:{resource}{p}*" for p in PREFIXES]

    regional = {"StringEquals": {"aws:RequestedRegion": region}}
    data = [
        allow("DiscoverSites", ["s3:ListAllMyBuckets", "ecr:GetAuthorizationToken", "ecr:DescribeRepositories",
            "lambda:ListFunctions", "lambda:ListLayers", "lambda:GetAccountSettings", "dynamodb:ListTables"], "*"),
        allow("SiteBuckets", "s3:*", [f"arn:aws:s3:::{p}*" for p in PREFIXES]),
        allow("SiteImages", "ecr:*", named("ecr", "repository/") +
            [f"arn:aws:ecr:{region}:{account}:repository/{name}" for name in ("ggame", "cgame", "tgame")]),
        allow("SiteFunctions", "lambda:*", named("lambda", "function:") + named("lambda", "layer:")),
        allow("SiteTables", "dynamodb:*", named("dynamodb", "table/")),
        allow("DiscoverLogs", ["logs:DescribeLogGroups", "logs:DescribeQueries", "logs:GetQueryResults", "logs:StopQuery"], "*", regional),
        allow("SiteLogs", "logs:*", [f"arn:aws:logs:{region}:{account}:log-group:{base}{p}*"
            for base in ("/aws/lambda/", "/") for p in PREFIXES]),
        allow("SiteMonitoringAndMail", ["cloudwatch:*", "ses:*"], "*", regional),
    ]
    infrastructure = [
        # Compute/network/certificate operations are regional rather than tag-only:
        # creation and several describe APIs cannot rely on an existing resource tag.
        allow("RegionalComputeAndCertificates", ["ec2:*", "acm:*"], "*", regional),
        allow("SiteCdn", "cloudfront:*", "*"),
        allow("NetDns", "route53:*", f"arn:aws:route53:::hostedzone/{zone_id}"),
        allow("DnsDiscovery", ["route53:ListHostedZones", "route53:ListHostedZonesByName", "route53:GetChange",
            "route53:ListTagsForResources", "route53:GetHostedZoneCount", "route53:TestDNSAnswer"], "*"),
        allow("SiteApiGateway", "apigateway:*", [f"arn:aws:apigateway:{region}::/{path}" for path in
            ("apis", "apis/*", "restapis", "restapis/*", "domainnames", "domainnames/*", "tags/*")]),
        allow("SiteStacks", "cloudformation:*", named("cloudformation", "stack/")),
        allow("StackDiscovery", ["cloudformation:ListStacks", "cloudformation:ValidateTemplate", "cloudformation:GetTemplateSummary"], "*", regional),
        allow("ExistingRoles", ["iam:GetRole", "iam:GetRolePolicy", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies"],
            [f"arn:aws:iam::{account}:role/{p}*" for p in PREFIXES] + [f"arn:aws:iam::{account}:role/game-host-role-*"]),
        allow("PassRuntimeRoles", "iam:PassRole", [f"arn:aws:iam::{account}:role/{p}*" for p in PREFIXES] +
            [f"arn:aws:iam::{account}:role/game-host-role-*"],
            {"StringEquals": {"iam:PassedToService": ["ec2.amazonaws.com", "lambda.amazonaws.com", "apigateway.amazonaws.com", "cloudformation.amazonaws.com"]}}),
        allow("ReadInstanceProfiles", ["iam:GetInstanceProfile", "iam:ListInstanceProfiles", "iam:ListInstanceProfilesForRole"], "*"),
        allow("HostManagement", ["ssm:SendCommand", "ssm:GetCommandInvocation", "ssm:ListCommands", "ssm:ListCommandInvocations",
            "ssm:DescribeInstanceInformation", "ssm:GetConnectionStatus", "ssm:DescribeDocument", "ssm:GetDocument"], "*", regional),
        allow("SiteParameters", ["ssm:GetParameter", "ssm:GetParameters", "ssm:PutParameter", "ssm:DeleteParameter",
            "ssm:DeleteParameters", "ssm:AddTagsToResource", "ssm:ListTagsForResource"], named("ssm", "parameter/") +
            [f"arn:aws:ssm:{region}:{account}:parameter/{p}/*" for p in ("nphunter", "1gp", "onegp", "msite", "nsite", "kgame")]),
        allow("PublicAmiLookup", ["ssm:GetParameter", "ssm:GetParameters"], f"arn:aws:ssm:{region}::parameter/aws/service/*"),
    ]
    return {"site-data": {"Version": "2012-10-17", "Statement": data},
            "site-infrastructure": {"Version": "2012-10-17", "Statement": infrastructure}}
