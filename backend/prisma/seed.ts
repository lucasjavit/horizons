import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { systemDesignTrack } from './seed/system-design';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL nao definida — copie .env.example para .env');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEFAULT_USER_EMAIL = process.env.DEFAULT_USER_EMAIL ?? 'eu@horizons.local';

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: { email: DEFAULT_USER_EMAIL, name: 'Eu' },
  });
  console.log(`usuario padrao: ${user.email}`);

  const { modules, ...trackData } = systemDesignTrack;

  const track = await prisma.track.upsert({
    where: { slug: trackData.slug },
    update: trackData,
    create: trackData,
  });

  let lessonCount = 0;
  let withContent = 0;

  for (const [modulePosition, mod] of modules.entries()) {
    const saved = await prisma.module.upsert({
      where: { trackId_slug: { trackId: track.id, slug: mod.slug } },
      update: { title: mod.title, goal: mod.goal, position: modulePosition },
      create: {
        trackId: track.id,
        slug: mod.slug,
        title: mod.title,
        goal: mod.goal,
        position: modulePosition,
      },
    });

    const slugsDoModulo: string[] = [];

    for (const [lessonPosition, lesson] of mod.lessons.entries()) {
      const data = {
        title: lesson.title,
        kind: lesson.kind ?? 'ARTICLE',
        summary: lesson.summary,
        sourceUrl: lesson.sourceUrl ?? null,
        // Prisma exige DbNull explícito para gravar NULL em coluna Json —
        // `null` puro seria ambíguo com o valor JSON `null`.
        content: lesson.content
          ? (lesson.content as unknown as Prisma.InputJsonObject)
          : Prisma.DbNull,
        position: lessonPosition,
      };

      await prisma.lesson.upsert({
        where: { moduleId_slug: { moduleId: saved.id, slug: lesson.slug } },
        update: data,
        create: { moduleId: saved.id, slug: lesson.slug, ...data },
      });

      slugsDoModulo.push(lesson.slug);
      lessonCount += 1;
      if (lesson.content) withContent += 1;
    }

    // Aulas que sairam do seed (renomeadas ou removidas) nao devem ficar
    // orfas no banco — o seed e a fonte de verdade da estrutura da trilha.
    const removidas = await prisma.lesson.deleteMany({
      where: { moduleId: saved.id, slug: { notIn: slugsDoModulo } },
    });
    if (removidas.count > 0) {
      console.log(`  ${mod.slug}: ${removidas.count} aula(s) obsoleta(s) removida(s)`);
    }
  }

  // O mesmo vale para modulos inteiros que deixaram de existir.
  const modulosRemovidos = await prisma.module.deleteMany({
    where: { trackId: track.id, slug: { notIn: modules.map((m) => m.slug) } },
  });
  if (modulosRemovidos.count > 0) {
    console.log(`${modulosRemovidos.count} modulo(s) obsoleto(s) removido(s)`);
  }

  console.log(
    `trilha "${track.slug}": ${modules.length} modulos, ${lessonCount} aulas ` +
      `(${withContent} com conteudo, ${lessonCount - withContent} pendentes)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
