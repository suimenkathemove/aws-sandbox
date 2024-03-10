import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import { CidrBlock } from "@/models/network";
import { tags } from "@/models/tags";

const DOMAIN_NAME = "minimum-network";

export class MinimumNetworkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ((): cdk.aws_ec2.CfnVPC => {
      const vpcId = `${DOMAIN_NAME}-vpc`;
      const vpc = new cdk.aws_ec2.CfnVPC(this, vpcId, {
        cidrBlock: "10.0.0.0/16" satisfies CidrBlock,
        tags: tags(vpcId),
      });

      return vpc;
    })();

    const igw = ((): cdk.aws_ec2.CfnInternetGateway => {
      const igwId = `${DOMAIN_NAME}-igw`;
      const igw = new cdk.aws_ec2.CfnInternetGateway(this, igwId, {
        tags: tags(igwId),
      });

      new cdk.aws_ec2.CfnVPCGatewayAttachment(this, `${igwId}-attachment`, {
        vpcId: vpc.ref,
        internetGatewayId: igw.ref,
      });

      return igw;
    })();

    const _ingressSubnetAndRouteTable = ((): {
      subnet: cdk.aws_ec2.CfnSubnet;
      routeTable: cdk.aws_ec2.CfnRouteTable;
    } => {
      const subnetId = `${DOMAIN_NAME}-ingress-subnet`;
      const subnet = new cdk.aws_ec2.CfnSubnet(this, subnetId, {
        vpcId: vpc.ref,
        cidrBlock: "10.0.0.0/24" satisfies CidrBlock,
        tags: tags(subnetId),
      });

      const routeTable = ((): cdk.aws_ec2.CfnRouteTable => {
        const routeTableId = `${subnetId}-route-table`;
        const routeTable = new cdk.aws_ec2.CfnRouteTable(this, routeTableId, {
          vpcId: vpc.ref,
          tags: tags(routeTableId),
        });

        new cdk.aws_ec2.CfnSubnetRouteTableAssociation(
          this,
          `${routeTableId}-association`,
          {
            subnetId: subnet.ref,
            routeTableId: routeTable.ref,
          },
        );

        new cdk.aws_ec2.CfnRoute(this, `${DOMAIN_NAME}-default-gateway-route`, {
          routeTableId: routeTable.ref,
          destinationCidrBlock: "0.0.0.0/0" satisfies CidrBlock,
          gatewayId: igw.ref,
        });

        return routeTable;
      })();

      return { subnet, routeTable };
    })();
  }
}
