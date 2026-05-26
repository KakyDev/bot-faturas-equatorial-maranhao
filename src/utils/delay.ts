export const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export const randomInt = (min: number, max: number): number => {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);

  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
};

export const randomDelay = async (minMs: number, maxMs: number): Promise<void> => {
  await sleep(randomInt(minMs, maxMs));
};
