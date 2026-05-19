export const options = {
  extraHTTPHeaders: {
    Authorization: `Api-Key ${process.env.API_KEYS}`,
    'Content-Type': 'application/json',
  },
};
