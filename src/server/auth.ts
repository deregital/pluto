import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";

import { isAllowedEmail } from "@/server/security/allowed-users";

const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [Google],
  callbacks: {
    // Google confirma el mail; además tiene que estar en la lista.
    async signIn({ profile }) {
      if (!profile?.email_verified || !isAllowedEmail(profile.email)) {
        console.warn("[auth] Sign-in rejected for an account outside the list");
        return false;
      }
      return true;
    },
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
      // Si alguien sale de la lista, su sesión se corta en el próximo pedido.
      if (!isAllowedEmail(token.email)) return null;
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
