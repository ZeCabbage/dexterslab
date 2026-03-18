/**
 * DEXTER'S LAB — Inbox Buddy Layout
 * Wraps inbox-buddy pages with auth session context
 */

import InboxBuddySessionProvider from './SessionProvider';

export default function InboxBuddyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InboxBuddySessionProvider>{children}</InboxBuddySessionProvider>;
}
