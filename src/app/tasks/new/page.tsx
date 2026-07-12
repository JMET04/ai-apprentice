import { AppShell } from "@/components/app-shell";
import { TaskCreateForm } from "@/components/task-create-form";
import { memoryStore } from "@/server/memory/memory-store";

export default async function NewTaskPage() {
  const apprentices = await memoryStore.listApprentices();

  return (
    <AppShell>
      <TaskCreateForm
        apprentices={apprentices.map((apprentice) => ({
          id: apprentice.id,
          name: apprentice.name,
          domain: apprentice.domain
        }))}
      />
    </AppShell>
  );
}
