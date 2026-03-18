/**
 * DEXTER'S LAB — NextAuth API Route
 * Handles Google OAuth callbacks
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
