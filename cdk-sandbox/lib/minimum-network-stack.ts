import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

const DOMAIN_NAME = "minimum-network";

const tags = (id: string): cdk.CfnTag[] => [{ key: "Name", value: id }];

export class MinimumNetworkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const _vpc = (() => {
      const vpcId = DOMAIN_NAME;

      return new cdk.aws_ec2.CfnVPC(this, vpcId, {
        cidrBlock: "10.0.0.0/16",
        tags: tags(vpcId),
      });
    })();
  }
}
