import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import { CidrBlock } from "@/models/network";
import { tags } from "@/models/tags";

const DOMAIN_NAME = "minimum-network";

export class MinimumNetworkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = (() => {
      const id = DOMAIN_NAME;

      return new cdk.aws_ec2.CfnVPC(this, id, {
        cidrBlock: "10.0.0.0/16" satisfies CidrBlock,
        tags: tags(id),
      });
    })();

    const _ingressSubnet = (() => {
      const id = `${DOMAIN_NAME}-ingress`;

      return new cdk.aws_ec2.CfnSubnet(this, id, {
        vpcId: vpc.ref,
        cidrBlock: "10.0.0.0/24" satisfies CidrBlock,
        tags: tags(id),
      });
    })();
  }
}
