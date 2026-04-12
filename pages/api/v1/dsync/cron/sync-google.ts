import type { NextApiRequest, NextApiResponse } from 'next';

import jackson from '@lib/jackson';

// Sync Google Workspace with Jackson
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { directorySyncController } = await jackson();

    directorySyncController.sync();

    return res.json({ message: 'Sync started' });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || 'Sync failed' });
  }
};

export default handler;
