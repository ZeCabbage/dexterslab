'use client';

/**
 * DEXTER'S LAB — Session Provider Wrapper
 * Wraps inbox-buddy pages with NextAuth session context
 */

import { SessionProvider } from 'next-auth/react';

export default function InboxBuddySessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
