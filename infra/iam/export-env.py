"""Export secret stack outputs directly to an ignored, owner-only local file."""
import json
import os
from pathlib import Path
import shlex
import subprocess

directory = Path(__file__).resolve().parent
target = directory / ".env.aws.local"
if target.exists():
    raise SystemExit(f"Refusing to overwrite {target}; move it before exporting a rotated key")
outputs = json.loads(subprocess.check_output(
    ["pulumi", "stack", "output", "--json", "--show-secrets"], cwd=directory, text=True))
values = {"AWS_ACCESS_KEY_ID": outputs["accessKeyId"],
          "AWS_SECRET_ACCESS_KEY": outputs["secretAccessKey"], "AWS_DEFAULT_REGION": outputs["region"]}
content = "# Local only. Never commit or paste these credentials.\nunset AWS_PROFILE AWS_SESSION_TOKEN\n"
content += "".join(f"export {key}={shlex.quote(value)}\n" for key, value in values.items())
with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as handle:
    handle.write(content)
print(f"Saved credentials to {target} (0600); values were not printed")
