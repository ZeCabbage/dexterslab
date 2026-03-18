/**
 * DEXTER'S LAB — VIP Management API Route
 * GET:  Returns approved VIP list
 * POST: Approve or dismiss a VIP suggestion
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const VIPS_FILE = path.join(DATA_DIR, 'inbox-buddy-vips.json');

interface StoredVIP {
  email: string;
  name: string;
  reason: string;
  addedAt: string;
}

async function loadVIPs(): Promise<StoredVIP[]> {
  try {
    const raw = await fs.readFile(VIPS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveVIPs(vips: StoredVIP[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(VIPS_FILE, JSON.stringify(vips, null, 2));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const vips = await loadVIPs();
    return NextResponse.json({ success: true, vips });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { action, email, name, reason } = await request.json();

    if (action === 'approve' && email) {
      const vips = await loadVIPs();
      // Don't add duplicates
      if (!vips.find((v) => v.email === email)) {
        vips.push({
          email,
          name: name || email.split('@')[0],
          reason: reason || 'Manually approved',
          addedAt: new Date().toISOString(),
        });
        await saveVIPs(vips);
      }
      return NextResponse.json({ success: true, vips });
    }

    if (action === 'dismiss' && email) {
      // Just acknowledge — dismissed VIPs aren't stored
      return NextResponse.json({ success: true, dismissed: email });
    }

    if (action === 'remove' && email) {
      const vips = await loadVIPs();
      const filtered = vips.filter((v) => v.email !== email);
      await saveVIPs(filtered);
      return NextResponse.json({ success: true, vips: filtered });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
