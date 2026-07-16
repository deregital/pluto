import {
  GITHUB_REPO_ID,
  GITHUB_REPO_NAME,
  GITHUB_REPO_OWNER,
  GITHUB_REPO_SLUG,
  GITHUB_REPO_URL,
} from "@/server/config";
import {
  ENV_TO_INPUT_KEY,
  PUBLIC_ENVS,
  UPDATABLE_ENVS,
} from "@/server/schemas/enviroment";
import {
  createInstanceSchema,
  updateProjectSchema,
} from "@/server/schemas/project";
import { getPlanetaProjects } from "@/server/services/planeta-projects";
import { addInstanceOriginToS3Cors } from "@/server/services/s3-cors";
import { vercel, vercelApi } from "@/server/services/vercel-client";
import { generateSodiumKey } from "@/server/sodium";
import { Octokit } from "@octokit/rest";
import { revalidatePath } from "next/cache";
import z from "zod";
import { publicProcedure, router } from "../trpc";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const vercelRouter = router({
  getProjects: publicProcedure.query(async () => {
    return getPlanetaProjects();
  }),
  getPublicEnv: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        envs: z
          .object({
            id: z.string(),
            key: z.string(),
          })
          .array(),
      }),
    )
    .query(async ({ input }) => {
      const envEntries = await Promise.all(
        PUBLIC_ENVS.map(async (env) => {
          const envId = input.envs.find((e) => e.key === env)?.id;
          if (!envId) {
            return [env, ""] as const;
          }
          const resEnv = await vercelApi
            .get<{
              value: string;
            }>(`v1/projects/${input.projectId}/env/${envId}`)
            .json();
          return [env, resEnv.value] as const;
        }),
      );

      const envs = Object.fromEntries(envEntries) as Record<
        (typeof PUBLIC_ENVS)[number],
        string
      >;

      return envs;
    }),
  getDecryptedEnv: publicProcedure
    .input(
      z.object({
        envId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      if (!input.envId || input.envId === "undefined") {
        return { value: "null" };
      }
      const env = await vercelApi
        .get<{
          value: string;
        }>(`v1/projects/${input.projectId}/env/${input.envId}`)
        .json();

      return env;
    }),
  getDeployments: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { deployments } = await vercel.deployments.getDeployments(
        {
          projectId: input.projectId,
          limit: 10,
          teamId: process.env.VERCEL_TEAM_ID,
          branch: "master",
        },
        { next: { tags: ["deployments"], revalidate: 2 } },
      );

      return deployments;
    }),
  getMasterDeployment: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { deployments } = await vercel.deployments.getDeployments(
        {
          projectId: input.projectId,
          limit: 1,
          teamId: process.env.VERCEL_TEAM_ID,
          branch: "master",
        },
        { next: { tags: ["deployments"], revalidate: 2 } },
      );

      return deployments[0];
    }),
  updateProject: publicProcedure
    .input(
      updateProjectSchema.extend({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const project = await vercelApi
        .get<{
          env: { id: string; key: string }[];
        }>(`v1/projects/${input.projectId}`)
        .json();

      // TODO Guardar todas las variables en un record con UPDATABLE_ENVS y despues hacer el map con eso (nos ahorramos tiempo de ejecucion (creo))

      try {
        for (const key of UPDATABLE_ENVS) {
          const inputKey = ENV_TO_INPUT_KEY[key];
          const value = input[inputKey];
          if (value) {
            await vercel.projects.editProjectEnv({
              idOrName: input.projectId,
              id: project.env.find((e) => e.key === key)?.id ?? "",
              teamId: process.env.VERCEL_TEAM_ID,
              requestBody: {
                key,
                value: String(value),
              },
            });
          }
        }
      } catch (e) {
        console.log(e);
      }

      // Redeploy
      try {
        const lastDeployment = await vercel.deployments.getDeployments({
          projectId: input.projectId,
          limit: 1,
          teamId: process.env.VERCEL_TEAM_ID,
          branch: "master",
        });

        if (lastDeployment.deployments.length === 0) {
          throw new Error("No se encontró el último despliegue");
        }

        await vercel.deployments.createDeployment({
          teamId: process.env.VERCEL_TEAM_ID,
          forceNew: "1",
          requestBody: {
            deploymentId: lastDeployment.deployments[0].uid,
            project: input.projectId,
            name: input.projectId,
            target: "production",
          },
        });
      } catch (e) {
        console.log(e);
      }

      revalidatePath("/");
      return { success: true };
    }),
  redeployProject: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const lastDeployment = await vercel.deployments.getDeployments({
        projectId: input.projectId,
        limit: 1,
        teamId: process.env.VERCEL_TEAM_ID,
        branch: "master",
      });

      if (lastDeployment.deployments.length === 0) {
        throw new Error("No se encontró el último despliegue");
      }

      const deployment = await vercel.deployments.createDeployment({
        teamId: process.env.VERCEL_TEAM_ID,
        forceNew: "1",
        requestBody: {
          deploymentId: lastDeployment.deployments[0].uid,
          project: input.projectId,
          name: input.projectId,
          target: "production",
        },
      });

      return deployment;
    }),
  createInstance: publicProcedure
    .input(createInstanceSchema)
    .mutation(async ({ input }) => {
      const newInstance = await vercel.projects.createProject({
        teamId: process.env.VERCEL_TEAM_ID,
        requestBody: {
          gitRepository: {
            repo: GITHUB_REPO_SLUG,
            type: "github",
          },
          name: input.name,
          environmentVariables: [
            {
              key: "NEXT_PUBLIC_INSTANCE_NAME",
              target: ["production", "preview"],
              value: input.envs.instanceName,
              type: "plain",
            },
            {
              key: "NEXT_PUBLIC_INSTANCE_DESCRIPTION",
              target: ["production", "preview"],
              value: input.envs.instanceDescription,
              type: "plain",
            },
            {
              key: "INSTANCE_CONTACT_EMAIL",
              target: ["production", "preview"],
              value: input.envs.instanceContactEmail,
              type: "plain",
            },
            {
              key: "NEXT_PUBLIC_HUE",
              target: ["production", "preview"],
              value: String(input.envs.hue),
              type: "plain",
            },
            {
              key: "NEXT_PUBLIC_SATURATION",
              target: ["production", "preview"],
              value: String(input.envs.saturation),
              type: "plain",
            },
            {
              key: "MP_ACCESS_TOKEN",
              target: ["production", "preview"],
              value: input.envs.mpAccessToken,
              type: "encrypted",
            },
            {
              key: "MP_SECRET_KEY",
              target: ["production", "preview"],
              value: input.envs.mpSecretKey,
              type: "encrypted",
            },
            {
              key: "DATABASE_URL",
              target: ["production", "preview"],
              value: input.envs.databaseUrl,
              type: "encrypted",
            },
            {
              key: "INSTANCE_WEB_URL",
              target: ["production", "preview"],
              value: input.envs.instanceWebUrl,
              type: "plain",
            },
            {
              key: "NEXT_PUBLIC_FAVICON_URL",
              target: ["production", "preview"],
              value: "",
              type: "plain",
            },
          ],
          framework: "nextjs",
        },
      });

      // Link custom domain to the newly created project from INSTANCE_WEB_URL
      try {
        const rawUrl = input.envs.instanceWebUrl?.trim();
        if (rawUrl) {
          const hostname = rawUrl
            .replace(/^https?:\/\//i, "")
            .replace(/\/.*/, "");

          if (hostname) {
            await vercel.projects.addProjectDomain({
              idOrName: newInstance.id,
              teamId: process.env.VERCEL_TEAM_ID,
              requestBody: {
                name: hostname,
                // default to production target; Vercel infers aliases from this
              },
            });
          }
        }
      } catch (error) {
        console.error("Failed to add domain to project:", error);
      }

      try {
        const rawUrl = input.envs.instanceWebUrl?.trim();
        if (rawUrl) {
          await addInstanceOriginToS3Cors(rawUrl);
        }
      } catch (error) {
        console.error("Failed to add instance URL to S3 CORS:", error);
      }

      // Get all shared environment variables from team and link them to the project
      try {
        const sharedEnvsResponse = await vercelApi
          .get<{
            data: Array<{
              id: string;
              key: string;
              value: string;
              type: string;
            }>;
          }>("v1/env")
          .json();

        // Get decrypted values and add shared environment variables to the project
        if (sharedEnvsResponse.data?.length > 0) {
          const decryptedEnvs = await Promise.all(
            sharedEnvsResponse.data.map(async (sharedEnv) => {
              try {
                const decryptedEnv = await vercelApi
                  .get<{ value: string }>(`v1/env/${sharedEnv.id}`)
                  .json();
                return {
                  ...sharedEnv,
                  value: decryptedEnv.value,
                };
              } catch (error) {
                console.error(`Failed to decrypt env ${sharedEnv.key}:`, error);
                return {
                  ...sharedEnv,
                  value: sharedEnv.value, // fallback to encrypted value
                };
              }
            }),
          );

          await Promise.all(
            decryptedEnvs.map((sharedEnv) =>
              vercel.projects.createProjectEnv({
                idOrName: newInstance.id,
                teamId: process.env.VERCEL_TEAM_ID,
                requestBody: {
                  key: sharedEnv.key,
                  value: sharedEnv.value,
                  type: sharedEnv.type === "encrypted" ? "encrypted" : "plain",
                  target: ["production", "preview"],
                },
              }),
            ),
          );
        }
      } catch (error) {
        console.error("Failed to link shared environment variables:", error);
      }

      const repoKey = await octokit.request(
        "GET /repos/{owner}/{repo}/actions/secrets/public-key",
        {
          owner: GITHUB_REPO_OWNER,
          repo: GITHUB_REPO_NAME,
        },
      );

      // Create environment variables for github actions
      const parsedName = newInstance.name.replace(/-/g, "_").toUpperCase();
      const secretName = `PROD_DATABASE_URL_${parsedName}`;
      const secretValue = input.envs.databaseUrl;
      const encryptedValue = await generateSodiumKey(
        secretValue,
        repoKey.data.key,
      );
      if (!encryptedValue) {
        throw new Error("Failed to encrypt secret");
      }

      const res = await octokit.request(
        `PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}`,
        {
          owner: GITHUB_REPO_OWNER,
          repo: GITHUB_REPO_NAME,
          secret_name: secretName,
          encrypted_value: encryptedValue,
          key_id: repoKey.data.key_id,
        },
      );

      console.log(res);
      // Create prisma migrate workflow dispatch event
      await octokit.request(
        "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        {
          owner: GITHUB_REPO_OWNER,
          repo: GITHUB_REPO_NAME,
          workflow_id: "prisma-migrate.yml",
          ref: "master",
        },
      );

      // Wait for prisma-migrate to complete
      await new Promise((resolve) => setTimeout(resolve, 3000));

      let completed = false;
      while (!completed) {
        const runs = await octokit.request(
          "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
          {
            owner: GITHUB_REPO_OWNER,
            repo: GITHUB_REPO_NAME,
            workflow_id: "prisma-migrate.yml",
            per_page: 1,
          },
        );

        const latestRun = runs.data.workflow_runs[0];
        if (latestRun?.status === "completed") {
          completed = true;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      // Create seed workflow dispatch event
      await octokit.request(
        "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        {
          owner: GITHUB_REPO_OWNER,
          repo: GITHUB_REPO_NAME,
          workflow_id: "seed.yml",
          ref: "master",
          inputs: {
            name: input.seed.name,
            password: input.seed.password,
            email: input.seed.email,
            fullName: input.seed.fullName,
            environment: "prod",
            database: parsedName,
          },
        },
      );

      // Get latest commit and create a deployment with it
      const lastCommit = await octokit.request(
        "GET /repos/{owner}/{repo}/branches/{branch}",
        {
          owner: GITHUB_REPO_OWNER,
          repo: GITHUB_REPO_NAME,
          branch: "master",
        },
      );

      await vercel.deployments.createDeployment({
        teamId: process.env.VERCEL_TEAM_ID,
        requestBody: {
          name: "first deployment",
          project: newInstance.id,
          target: "production",
          files: [],
          gitSource: {
            type: "github",
            ref: "master",
            sha: lastCommit.data.commit.sha,
            org: GITHUB_REPO_OWNER,
            repoId: GITHUB_REPO_ID,
          },
        },
      });

      return newInstance;
    }),
  getDomains: publicProcedure.query(async () => {
    const domains = await vercel.domains.getDomains({
      teamId: process.env.VERCEL_TEAM_ID,
    });
    return domains;
  }),
  getAvailableDomains: publicProcedure.query(async () => {
    const projectsResponse = await vercel.projects.getProjects(
      {
        teamId: process.env.VERCEL_TEAM_ID,
        repoUrl: GITHUB_REPO_URL,
      },
      {
        next: {
          tags: ["projects"],
        },
      },
    );

    const projectItems = Array.isArray(projectsResponse)
      ? projectsResponse
      : projectsResponse.projects;

    const projectsWithDomains = await Promise.all(
      projectItems.map(async (project) => {
        const domains = await vercel.projects.getProjectDomains({
          idOrName: project.id,
          teamId: process.env.VERCEL_TEAM_ID,
          production: "true",
          verified: "true",
        });
        return {
          ...project,
          domain: `https://${domains.domains?.[0]?.name}`,
        };
      }),
    );

    const { domains } = await vercel.domains.getDomains({
      teamId: process.env.VERCEL_TEAM_ID,
    });

    const availableDomains = domains.filter(
      (domain) =>
        !projectsWithDomains.some(
          (project) => project.domain === `https://${domain.name}`,
        ),
    );
    return availableDomains;
  }),
  updateMercadoPagoCredentials: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        accessToken: z.string(),
        refreshToken: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { projectId, accessToken, refreshToken } = input;

      const fullProject = await vercelApi
        .get<{
          env: { id: string; key: string }[];
          name: string;
        }>(`v1/projects/${projectId}`)
        .json();

      const upsertEnv = async (
        key: "MP_ACCESS_TOKEN" | "MP_REFRESH_TOKEN",
        value: string,
      ) => {
        const existingEnv = fullProject.env.find((env) => env.key === key);
        if (existingEnv) {
          await vercel.projects.editProjectEnv({
            idOrName: projectId,
            id: existingEnv.id,
            teamId: process.env.VERCEL_TEAM_ID,
            requestBody: {
              key,
              value,
              type: "encrypted",
              target: ["production", "preview"],
            },
          });
          return;
        }

        await vercel.projects.createProjectEnv({
          idOrName: projectId,
          teamId: process.env.VERCEL_TEAM_ID,
          requestBody: {
            key,
            value,
            type: "encrypted",
            target: ["production", "preview"],
          },
        });
      };

      await upsertEnv("MP_ACCESS_TOKEN", accessToken);
      await upsertEnv("MP_REFRESH_TOKEN", refreshToken);

      const lastDeployment = await vercel.deployments.getDeployments({
        projectId,
        limit: 1,
        teamId: process.env.VERCEL_TEAM_ID,
        branch: "master",
      });

      if (lastDeployment.deployments.length > 0) {
        await vercel.deployments.createDeployment({
          teamId: process.env.VERCEL_TEAM_ID,
          forceNew: "1",
          requestBody: {
            deploymentId: lastDeployment.deployments[0].uid,
            project: projectId,
            name: fullProject.name,
            target: "production",
          },
        });
      }

      return { success: true };
    }),
});
