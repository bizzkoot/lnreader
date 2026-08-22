import { createSerialLock } from '@utils/serialLock';

const { withLock: withPluginMutationLock, __resetQueueForTests } =
  createSerialLock();

export { withPluginMutationLock, __resetQueueForTests };
