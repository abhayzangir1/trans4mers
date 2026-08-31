export const runInBackground = (task: () => Promise<void>) => {
  if (typeof process !== 'undefined' && process.nextTick) {
    process.nextTick(() => {
      task().catch(console.error);
    });
  } else {
    setTimeout(() => {
      task().catch(console.error);
    }, 0);
  }
};
