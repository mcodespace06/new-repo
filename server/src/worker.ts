import PgBoss from 'pg-boss';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

export async function startWorker() {
  if (!connectionString) {
    console.warn('[CampusVoice Worker] DATABASE_URL not configured. Worker not started.');
    return;
  }

  const boss = new PgBoss({
    connectionString,
    max: 10,
  });

  boss.on('error', (error) => console.error('[PgBoss Error]:', error));

  try {
    await boss.start();
    console.log('[CampusVoice Worker] pg-boss queue initialized and running.');

    // Register job queues (Skeleton for Phase 0)
    await boss.work('analyze-complaint', async (jobs) => {
      for (const job of jobs) {
        console.log(`[Job: analyze-complaint] Processing job ${job.id} for complaint ${job.data.complaintId}`);
      }
    });

    await boss.work('sla-escalation', async () => {
      console.log('[Job: sla-escalation] Checking SLA status across open complaints.');
    });

    await boss.work('sos-dispatch', async (jobs) => {
      for (const job of jobs) {
        console.log(`[Job: sos-dispatch] Dispatching emergency alert for SOS event ${job.data.sosId}`);
      }
    });

    await boss.work('embed-rules', async (jobs) => {
      for (const job of jobs) {
        console.log(`[Job: embed-rules] Chunking & embedding rule document ${job.data.ruleId}`);
      }
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('[CampusVoice Worker] Stopping pg-boss workers...');
      await boss.stop({ graceful: true, timeout: 5000 });
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return boss;
  } catch (err) {
    console.error('[CampusVoice Worker] Failed to start pg-boss:', err);
  }
}

if (require.main === module) {
  startWorker();
}
