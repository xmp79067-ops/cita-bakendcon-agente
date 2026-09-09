import 'dotenv/config';
import { initDatabase } from './src/db/index.js';
import app from './src/app.js';

const PORT = Number(process.env.PORT || 3000);

async function main() {
  await initDatabase();
  app.listen(PORT, () =>
    console.log(`🚀 Citas backend v3 escuchando en el puerto ${PORT}`),
  );
}

main().catch((err) => {
  console.error('Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
