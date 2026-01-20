/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "crypto-dashboard",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          region: "ap-southeast-1",
        },
      },
    };
  },
  async run() {
    // =========================================================================
    // Lambda OAC Workaround - 限制 Lambda Function URL 只能通过 CloudFront 访问
    // https://github.com/sst/sst/issues/4483
    // =========================================================================
    const LAMBDA_OAC_DISABLED = /originAccessControlConfig:\s*{\s*enabled: false.*?}/s;
    const LAMBDA_OAC_ENABLED = `
      originAccessControlConfig: urlHost.includes(".lambda-url.") ? {
        enabled: true,
        signingBehavior: "always",
        signingProtocol: "sigv4",
        originType: "lambda",
      } : { enabled: false }
    `;

    $transform(aws.cloudfront.Function, (args, _opts, name) => {
      if (name.includes("CloudfrontFunctionRequest")) {
        args.code = $util.output(args.code).apply((code) => {
          return code.replace(LAMBDA_OAC_DISABLED, LAMBDA_OAC_ENABLED);
        });
      }
    });

    // Import infrastructure definitions
    const { database } = await import("./infra/database");
    const { queue } = await import("./infra/queue");
    const { api } = await import("./infra/api");
    const { web } = await import("./infra/web");
    const { cron } = await import("./infra/cron");

    // 添加 CloudFront 调用 Lambda 的权限（仅在非 dev 模式下）
    // sst dev 模式下 $dev 为 true，此时 CDN 结构可能不完整
    if (!$dev) {
      new aws.lambda.Permission("CloudfrontLambdaPermission", {
        action: "lambda:InvokeFunctionUrl",
        function: web.nodes.server.name,
        principal: "cloudfront.amazonaws.com",
        sourceArn: web.nodes.cdn.nodes.distribution.arn,
        statementId: "AllowCloudFrontServicePrincipal",
      });
    }

    return {
      api: api.url,
      web: web.url,
    };
  },
});
