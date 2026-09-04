/**
 * Crée le bucket MinIO local s'il n'existe pas — à lancer une fois après
 * `docker compose up -d` (MinIO ne crée aucun bucket automatiquement).
 * Exécution : npm run storage:setup
 */
import "dotenv/config";
import { ensureBucketExists } from "../src/lib/storage/client";

ensureBucketExists()
  .then(() => {
    console.log(`Bucket "${process.env.STORAGE_BUCKET}" prêt.`);
  })
  .catch((err) => {
    console.error("Échec de la préparation du bucket :", err);
    process.exit(1);
  });
