/**
 * Next.js Frontend
 *
 * Deploys the Next.js app to AWS (CloudFront + S3/Lambda).
 */

import { api } from "./api";

export const web = new sst.aws.Nextjs("Web", {
  path: "apps/web",
  environment: {
    NEXT_PUBLIC_API_URL: api.url,
  },
  link: [api],
  transform: {
    server: {
      url: {
        authorization: "iam", // Lambda URL 需要 IAM 认证，阻止直接访问
      },
    },
  },
});
