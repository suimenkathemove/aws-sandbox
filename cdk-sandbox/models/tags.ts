import * as cdk from "aws-cdk-lib";

export const tags = (id: string): cdk.CfnTag[] => [{ key: "Name", value: id }];
