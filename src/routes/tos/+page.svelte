<script>
  import { ChevronLeft } from "lucide-svelte";
</script>

<div class="min-h-screen pb-20">
  <!-- Header -->
  <div
    class="glass-panel sticky top-0 z-40 border-b border-white/5 bg-slate-900/80 backdrop-blur-xl"
  >
    <div class="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
      <a
        href="/"
        class="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft size={24} />
      </a>
      <h1 class="font-bold text-lg">利用規約</h1>
    </div>
  </div>

  <div
    class="max-w-3xl mx-auto px-4 py-8 space-y-8 text-slate-300 leading-relaxed"
  >
    <div class="glass-panel p-6 rounded-xl space-y-6">
      <section>
        <h2 class="text-xl font-bold text-white mb-4">1. はじめに</h2>
        <p>
          TriLinesAt（以下、「本アプリ」）は、すいばり（以下、「開発者」）が個人で開発・運営するサービスです。
          本アプリを利用することで、ユーザーは本規約に同意したものとみなされます。
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-white mb-4">2. サービスの提供</h2>
        <p>
          本アプリは現状有姿で提供されます。開発者は、本アプリの機能、性能、安全性、および特定の目的への適合性について、明示的または黙示的を問わず、いかなる保証も行いません。
          開発者は、事前の予告なく、本アプリの仕様変更、提供の停止、または終了を行うことができるものとします。
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-white mb-4">3. データの取り扱い</h2>
        <p>
          本アプリは、Bluesky (AT Protocol)
          の認証システムおよびデータ保存領域（Personal Data Server:
          PDS）を利用します。
          ユーザーが本アプリで作成した日記データは、ユーザー自身のPDSに保存されます。
          本アプリ専用のサーバーに日記データが保存されることはありません。
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-white mb-4">4. 禁止事項</h2>
        <ul class="list-disc list-outside ml-4 space-y-2">
          <li>法令または公序良俗に違反する行為</li>
          <li>他のユーザーまたは第三者の権利を侵害する行為</li>
          <li>本アプリのサーバー、ネットワークシステムに支障を与える行為</li>
          <li>その他、開発者が不適切と判断する行為</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-bold text-white mb-4">5. 免責事項</h2>
        <p>
          本アプリの利用に起因してユーザーに生じた損害について、開発者は一切の責任を負いません。
          データの消失、改ざん、漏洩等を含め、いかなる場合も賠償の責を負わないものとします。
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-white mb-4">6. 規約の変更</h2>
        <p>
          開発者は、必要と判断した場合、ユーザーへの通知なく本規約を変更することができるものとします。
          変更後の規約は、本アプリ内に掲載された時点で効力を生じるものとします。
        </p>
      </section>
    </div>
  </div>
</div>
