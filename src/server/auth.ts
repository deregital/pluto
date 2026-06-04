import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";

const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [Google],
  callbacks: {
    async session({ session, token, user }) {
      if (user) {
        session.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
        };
      } else {
        session.user = {
          id: token.sub as string,
          name: token.name as string,
          email: token.email as string,
          emailVerified: token.emailVerified as Date | null,
        };
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes
  },
  pages: {
    signIn: "/login",
  },
});

export { auth, handlers, signIn, signOut };

export class CustomError extends CredentialsSignin {
  code = CustomError.CUSTOM_ERROR_CODE;
  static CUSTOM_ERROR_CODE = Symbol("CUSTOM_ERROR_CODE").toString();
  constructor(msg: string) {
    super();
    this.message = msg;
  }
}
