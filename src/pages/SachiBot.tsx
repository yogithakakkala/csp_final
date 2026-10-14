import { Bot } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import ChatPanel from '@/components/ChatPanel';

export default function SachiBot() {
  const { tx } = useLang();
  return (
    <div className="mx-auto flex h-[calc(100dvh-196px)] max-w-3xl flex-col overflow-hidden rounded-[24px] border border-line bg-paper lg:h-[calc(100dvh-80px)]">
      <header className="relative flex items-center gap-3 overflow-hidden bg-ink px-5 py-4 text-white">
        <div className="muggu absolute inset-y-0 right-0 w-1/2 opacity-50 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden />
        <span className="relative grid size-11 place-items-center rounded-full bg-turmeric text-ink">
          <Bot className="size-6" />
        </span>
        <div className="relative">
          <h1 className="text-lg font-semibold leading-tight">SachiBot</h1>
          <p className="text-sm text-white/70">{tx('Ask in Telugu or English. Tap the mic to speak.', 'తెలుగు లేదా ఇంగ్లీష్‌లో అడగండి. మాట్లాడటానికి మైక్ నొక్కండి.')}</p>
        </div>
      </header>
      <ChatPanel className="min-h-0 flex-1" />
    </div>
  );
}
