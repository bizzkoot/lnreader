import { createSerialLock } from '@utils/serialLock';

const { withLock: withWriteLock, __resetQueueForTests } = createSerialLock();

export { withWriteLock, __resetQueueForTests };
