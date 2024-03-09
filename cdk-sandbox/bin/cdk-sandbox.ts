#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";

import { CdkSandboxStack } from "@/lib/cdk-sandbox-stack";
import { MinimumNetworkStack } from "@/lib/minimum-network-stack";

const app = new cdk.App();

new CdkSandboxStack(app, "CdkSandboxStack");

new MinimumNetworkStack(app, "MinimumNetworkStack");
