const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5313;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Docwell running:`);
  console.log(`  Help center → http://localhost:${PORT}/`);
  console.log(`  Admin       → http://localhost:${PORT}/admin (password: ${process.env.ADMIN_PASSWORD ? 'from env' : '"admin" — set ADMIN_PASSWORD!'})`);
});
