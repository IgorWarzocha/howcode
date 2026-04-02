declare module "@pierre/diffs/worker/worker.js?worker" {
  const DiffWorker: {
    new (): Worker;
  };

  export default DiffWorker;
}
