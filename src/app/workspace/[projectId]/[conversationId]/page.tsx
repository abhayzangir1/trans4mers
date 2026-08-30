import CenterPane from '@/components/workspace/CenterPane';
import GlobalPromptBox from '@/components/workspace/GlobalPromptBox';

export default async function ActiveConversationPage({
  params,
}: {
  params: Promise<{ projectId: string; conversationId: string }>;
}) {
  const { conversationId } = await params;
  
  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-zinc-950">
      <div className="flex-1 overflow-hidden pb-24">
        <CenterPane conversationId={conversationId} />
      </div>
      <GlobalPromptBox conversationId={conversationId} />
    </div>
  );
}
