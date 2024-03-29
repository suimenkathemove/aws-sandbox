import * as cdk from "aws-cdk-lib";
import { InstanceClass, InstanceSize } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

import { CidrBlock, IpV4 } from "@/models/network";
import { tags } from "@/models/tags";

const DOMAIN_NAME = "minimum-network";

export class MinimumNetworkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const instanceImageId =
      cdk.aws_ec2.MachineImage.latestAmazonLinux2023().getImage(this).imageId;
    const instanceType = cdk.aws_ec2.InstanceType.of(
      InstanceClass.T2,
      InstanceSize.MICRO,
    ).toString();

    const vpc = ((): cdk.aws_ec2.CfnVPC => {
      const vpcId = `${DOMAIN_NAME}-vpc`;
      const vpc = new cdk.aws_ec2.CfnVPC(this, vpcId, {
        cidrBlock: "10.0.0.0/16" satisfies CidrBlock,
        // option: EC2インスタンスなどのリソースにホスト名が割り当てられるようになる
        // enableDnsHostnames: true,
        // enableDnsSupport: true,
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

    const webServerSubnetAndRouteTable = ((): {
      subnet: cdk.aws_ec2.CfnSubnet;
      routeTable: cdk.aws_ec2.CfnRouteTable;
    } => {
      const subnetId = `${DOMAIN_NAME}-web-server-subnet`;
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

        new cdk.aws_ec2.CfnRoute(this, `${subnetId}-default-gateway-route`, {
          routeTableId: routeTable.ref,
          destinationCidrBlock: "0.0.0.0/0" satisfies CidrBlock,
          gatewayId: igw.ref,
        });

        return routeTable;
      })();

      return { subnet, routeTable };
    })();

    const webServerSecurityGroup = ((): cdk.aws_ec2.CfnSecurityGroup => {
      const securityGroupId = `${DOMAIN_NAME}-web-server-security-group`;
      const securityGroup = new cdk.aws_ec2.CfnSecurityGroup(
        this,
        securityGroupId,
        {
          groupDescription: "security group for web server",
          vpcId: vpc.ref,
          securityGroupIngress: [
            {
              ipProtocol: "tcp",
              // TODO: クライアントのIPアドレスにする。環境変数にする
              cidrIp: "0.0.0.0/0" satisfies CidrBlock,
              fromPort: 22,
              toPort: 22,
            },
            {
              ipProtocol: "icmp",
              fromPort: -1,
              toPort: -1,
              cidrIp: "0.0.0.0/0" satisfies CidrBlock,
            },
            {
              ipProtocol: "tcp",
              cidrIp: "0.0.0.0/0" satisfies CidrBlock,
              fromPort: 80,
              toPort: 80,
            },
          ],
          tags: tags(securityGroupId),
        },
      );

      return securityGroup;
    })();

    const _webServer = ((): cdk.aws_ec2.CfnInstance => {
      const instanceId = `${DOMAIN_NAME}-web-server`;
      const instance = new cdk.aws_ec2.CfnInstance(this, instanceId, {
        networkInterfaces: [
          {
            deviceIndex: "0",
            subnetId: webServerSubnetAndRouteTable.subnet.ref,
            // MEMO: x.x.x.0~x.x.x.3は予約されている
            privateIpAddress: "10.0.0.10" satisfies IpV4,
            associatePublicIpAddress: true,
            groupSet: [webServerSecurityGroup.ref],
          },
        ],
        imageId: instanceImageId,
        instanceType,
        // TODO: 環境変数
        keyName: "MyKeyPair",
        userData: cdk.Fn.base64(
          `#!/bin/bash
          sudo dnf update -y
          sudo dnf install -y httpd
          sudo systemctl start httpd
          sudo systemctl enable httpd`,
        ),
        tags: tags(instanceId),
      });

      const _eip = new cdk.aws_ec2.CfnEIP(this, `${instanceId}-eip`, {
        instanceId: instance.ref,
      });

      return instance;
    })();

    const natGateway = ((): cdk.aws_ec2.CfnNatGateway => {
      const natGatewayId = `${DOMAIN_NAME}-nat-gateway`;

      const eip = new cdk.aws_ec2.CfnEIP(this, `${natGatewayId}-eip`);

      const natGateway = new cdk.aws_ec2.CfnNatGateway(this, natGatewayId, {
        subnetId: webServerSubnetAndRouteTable.subnet.ref,
        allocationId: eip.attrAllocationId,
      });

      return natGateway;
    })();

    const dbServerSubnetAndRouteTable = ((): {
      subnet: cdk.aws_ec2.CfnSubnet;
      routeTable: cdk.aws_ec2.CfnRouteTable;
    } => {
      const subnetId = `${DOMAIN_NAME}-db-server-subnet`;
      const subnet = new cdk.aws_ec2.CfnSubnet(this, subnetId, {
        vpcId: vpc.ref,
        cidrBlock: "10.0.1.0/24" satisfies CidrBlock,
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

        new cdk.aws_ec2.CfnRoute(this, `${subnetId}-nat-gateway-route`, {
          routeTableId: routeTable.ref,
          destinationCidrBlock: "0.0.0.0/0" satisfies CidrBlock,
          natGatewayId: natGateway.ref,
        });

        return routeTable;
      })();

      return { subnet, routeTable };
    })();

    const dbServerSecurityGroup = ((): cdk.aws_ec2.CfnSecurityGroup => {
      const securityGroupId = `${DOMAIN_NAME}-db-server-security-group`;
      const securityGroup = new cdk.aws_ec2.CfnSecurityGroup(
        this,
        securityGroupId,
        {
          groupDescription: "security group for db server",
          vpcId: vpc.ref,
          securityGroupIngress: [
            {
              ipProtocol: "tcp",
              // TODO: クライアントのIPアドレスにする。環境変数にする
              cidrIp: "0.0.0.0/0" satisfies CidrBlock,
              fromPort: 22,
              toPort: 22,
            },
            {
              ipProtocol: "icmp",
              fromPort: -1,
              toPort: -1,
              cidrIp: "0.0.0.0/0" satisfies CidrBlock,
            },
            {
              ipProtocol: "tcp",
              cidrIp: "0.0.0.0/0" satisfies CidrBlock,
              fromPort: 3306,
              toPort: 3306,
            },
          ],
          tags: tags(securityGroupId),
        },
      );

      return securityGroup;
    })();

    const _dbServer = ((): cdk.aws_ec2.CfnInstance => {
      const instanceId = `${DOMAIN_NAME}-db-server`;
      const instance = new cdk.aws_ec2.CfnInstance(this, instanceId, {
        networkInterfaces: [
          {
            deviceIndex: "0",
            subnetId: dbServerSubnetAndRouteTable.subnet.ref,
            privateIpAddress: "10.0.1.10" satisfies IpV4,
            groupSet: [dbServerSecurityGroup.ref],
          },
        ],
        imageId: instanceImageId,
        instanceType,
        // TODO: 環境変数
        keyName: "MyKeyPair",
        tags: tags(instanceId),
      });

      return instance;
    })();
  }
}
