import ky from "ky";

export const neonApi = ky.create({
  prefixUrl: "https://console.neon.tech/api/v2",
  headers: {
    Authorization: `Bearer ${process.env.NEON_API_KEY}`,
  },
});

export const createDatabase = async (name: string) => {
  const response: { connection_uris: { connection_uri: string }[] } =
    await neonApi
      .post("projects", {
        json: {
          project: {
            name,
          },
        },
      })
      .json();

  const connectionString = response.connection_uris[0].connection_uri;
  return connectionString;
};
