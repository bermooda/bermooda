import Queue from '@sturmfrei/litequu';

import logger from '#/utils/logger.server';

const queue = new Queue({
  dbPath: process.env.QUEUE_DATABASE_PATH,
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, waiting for jobs to complete...');
  await queue.close();
  process.exit(0);
});

export default queue;
