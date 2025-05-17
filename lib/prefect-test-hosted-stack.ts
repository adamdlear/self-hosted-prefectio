import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { ContainerImage } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class PrefectTestHostedStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, "PrefectCluster", {
      clusterName: "prefect-cluster",
    });

    const taskRole = new iam.Role(this, "PrefectTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const executionRole = new iam.Role(this, "PrefectExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const service = new ApplicationLoadBalancedFargateService(
      this,
      "PrefectService",
      {
        serviceName: "prefect-service",
        cluster,
        desiredCount: 1,
        cpu: 1024,
        memoryLimitMiB: 2048,
        publicLoadBalancer: true,
        listenerPort: 80, // HTTP only
        taskImageOptions: {
          image: ContainerImage.fromRegistry("prefecthq/prefect:3-latest"),
          taskRole,
          executionRole,
          containerPort: 4200,
          containerName: "prefect-service",
          environment: {
            PREFECT_SERVER_API_HOST: "0.0.0.0",
          },
          command: [
            "prefect",
            "server",
            "start",
            "--host",
            "0.0.0.0",
            "--port",
            "4200",
          ],
        },
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      },
    );

    // Set up health check for ALB
    service.targetGroup.configureHealthCheck({
      path: "/",
      port: "4200",
      healthyHttpCodes: "200-399",
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Add external-facing environment variables after the LB DNS is known
    const lbDns = service.loadBalancer.loadBalancerDnsName;

    const container = service.taskDefinition.defaultContainer;
    if (container) {
      container.addEnvironment("PREFECT_API_URL", `http://${lbDns}/api`);
      container.addEnvironment("PREFECT_UI_URL", `http://${lbDns}`);
    }
  }
}
